const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

function parseDateOnly(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return null;
}

function formatCOP(num) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(num || 0);
}

/**
 * Realiza el cálculo consolidado de ingresos, recaudos y saldo pendiente por rango de fechas
 */
function generarReporteFinanciero(db, { fechaInicio, fechaFin, periodo = 'personalizado' }) {
  if (!fechaInicio || !fechaFin) {
    throw new Error('Las fechas de inicio y fin son obligatorias');
  }

  const fInicio = parseDateOnly(fechaInicio);
  const fFin = parseDateOnly(fechaFin);

  if (fInicio > fFin) {
    throw new Error('La fecha inicial no puede ser posterior a la fecha final');
  }

  // 1. Filtrar transacciones de pago en el rango de fechas
  const pagos = (db.pagos || []).filter(p => {
    const pDate = parseDateOnly(p.fechaPago);
    return pDate && pDate >= fInicio && pDate <= fFin;
  });

  // 2. Mapear pagos con información detallada de clientes, contratos y motocicletas
  const transacciones = pagos.map(p => {
    const cliente = db.clientes.find(c => c.id === p.clienteId);
    const contrato = db.contratos.find(ct => ct.id === p.contratoId);
    const moto = contrato ? db.motocicletas.find(m => m.id === contrato.motocicletaId) : null;
    const cuota = p.cuotaId ? db.cuotas.find(q => q.id === p.cuotaId) : null;

    return {
      id: p.id,
      fechaPago: parseDateOnly(p.fechaPago),
      fechaPagoCompleta: p.fechaPago,
      monto: Number(p.monto) || 0,
      metodoPago: p.metodoPago || 'desconocido',
      referencia: p.referencia || 'N/A',
      clienteId: p.clienteId,
      clienteNombre: cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Desconocido',
      documentoId: cliente?.documentoId || 'N/A',
      motocicleta: moto ? `${moto.marca} ${moto.modelo}` : 'N/A',
      placa: moto?.placa || 'N/A',
      contratoId: p.contratoId,
      numeroCuota: cuota ? cuota.numeroCuota : null,
      notas: p.notas || '',
    };
  });

  // Ordenar transacciones por fecha desc
  transacciones.sort((a, b) => (b.fechaPagoCompleta || b.fechaPago).localeCompare(a.fechaPagoCompleta || a.fechaPago));

  // 3. Filtrar cuotas cuyo vencimiento cae en el rango de fechas
  const cuotasEnPeriodo = (db.cuotas || []).filter(c => {
    const vDate = parseDateOnly(c.fechaVencimiento);
    return vDate && vDate >= fInicio && vDate <= fFin;
  });

  const cuotasDetalle = cuotasEnPeriodo.map(c => {
    const contrato = db.contratos.find(ct => ct.id === c.contratoId);
    const cliente = contrato ? db.clientes.find(cl => cl.id === contrato.clienteId) : null;
    const moto = contrato ? db.motocicletas.find(m => m.id === contrato.motocicletaId) : null;

    return {
      id: c.id,
      contratoId: c.contratoId,
      numeroCuota: c.numeroCuota,
      monto: Number(c.monto) || 0,
      fechaVencimiento: parseDateOnly(c.fechaVencimiento),
      fechaPago: parseDateOnly(c.fechaPago),
      estado: c.estado,
      diasMorosidad: c.diasMorosidad || 0,
      clienteNombre: cliente ? `${cliente.nombre} ${cliente.apellido}` : 'N/A',
      documentoId: cliente?.documentoId || 'N/A',
      placa: moto?.placa || 'N/A',
    };
  });

  // 4. Totales consolidados
  const totalRecaudado = transacciones.reduce((sum, t) => sum + t.monto, 0);

  // Total de ingresos programados o facturados para el periodo
  const totalIngresosProgramados = cuotasDetalle.reduce((sum, c) => sum + c.monto, 0);
  const totalIngresos = totalIngresosProgramados > 0 ? totalIngresosProgramados : totalRecaudado;

  // Saldo pendiente en este periodo (cuotas vencidas o pendientes dentro del periodo)
  const totalSaldoPendiente = cuotasDetalle
    .filter(c => c.estado === 'pendiente' || c.estado === 'vencido')
    .reduce((sum, c) => sum + c.monto, 0);

  const totalSaldoEnMora = cuotasDetalle
    .filter(c => c.estado === 'vencido')
    .reduce((sum, c) => sum + c.monto, 0);

  // Saldo pendiente global de la flota (todos los contratos activos)
  const saldoPendienteGlobal = (db.contratos || [])
    .filter(c => c.estado === 'activo' || c.estado === 'suspendido')
    .reduce((sum, c) => sum + (Number(c.saldoPendiente) || 0), 0);

  // Métricas de conteo
  const cantidadPagos = transacciones.length;
  const cuotasTotalesPeriodo = cuotasDetalle.length;
  const cuotasPagadas = cuotasDetalle.filter(c => c.estado === 'pagado').length;
  const cuotasPendientes = cuotasDetalle.filter(c => c.estado === 'pendiente').length;
  const cuotasVencidas = cuotasDetalle.filter(c => c.estado === 'vencido').length;

  const tasaRecaudo = totalIngresos > 0
    ? Number(((totalRecaudado / totalIngresos) * 100).toFixed(1))
    : (totalRecaudado > 0 ? 100 : 0);

  // 5. Desglose por método de pago
  const metodosMap = {};
  transacciones.forEach(t => {
    const m = t.metodoPago.toLowerCase();
    if (!metodosMap[m]) metodosMap[m] = { metodo: m, cantidad: 0, montoTotal: 0 };
    metodosMap[m].cantidad += 1;
    metodosMap[m].montoTotal += t.monto;
  });

  const desgloseMetodosPago = Object.values(metodosMap).map(item => ({
    ...item,
    porcentaje: totalRecaudado > 0 ? Number(((item.montoTotal / totalRecaudado) * 100).toFixed(1)) : 0,
  }));
  desgloseMetodosPago.sort((a, b) => b.montoTotal - a.montoTotal);

  // 6. Desglose consolidado por cliente
  const clientesMap = {};
  
  transacciones.forEach(t => {
    if (!clientesMap[t.clienteId]) {
      clientesMap[t.clienteId] = {
        clienteId: t.clienteId,
        nombreCompleto: t.clienteNombre,
        documentoId: t.documentoId,
        placa: t.placa,
        montoRecaudado: 0,
        cuotasEsperadas: 0,
        cuotasPagadas: 0,
        saldoPendientePeriodo: 0,
        estadoContrato: 'activo',
      };
    }
    clientesMap[t.clienteId].montoRecaudado += t.monto;
    clientesMap[t.clienteId].cuotasPagadas += 1;
  });

  cuotasDetalle.forEach(c => {
    const contrato = db.contratos.find(ct => ct.id === c.contratoId);
    if (!contrato) return;
    const cid = contrato.clienteId;
    if (!clientesMap[cid]) {
      clientesMap[cid] = {
        clienteId: cid,
        nombreCompleto: c.clienteNombre,
        documentoId: c.documentoId,
        placa: c.placa,
        montoRecaudado: 0,
        cuotasEsperadas: 0,
        cuotasPagadas: 0,
        saldoPendientePeriodo: 0,
        estadoContrato: contrato.estado || 'activo',
      };
    }
    clientesMap[cid].cuotasEsperadas += 1;
    if (c.estado !== 'pagado') {
      clientesMap[cid].saldoPendientePeriodo += c.monto;
    }
  });

  const desglosePorCliente = Object.values(clientesMap);
  desglosePorCliente.sort((a, b) => b.montoRecaudado - a.montoRecaudado);

  // 7. Criterio de Aceptación: Determinar si existen transacciones registradas
  const tieneDatos = transacciones.length > 0 || cuotasDetalle.length > 0;

  return {
    periodo,
    fechaInicio: fInicio,
    fechaFin: fFin,
    fechaGeneracion: new Date().toISOString(),
    tieneDatos,
    mensaje: tieneDatos
      ? 'Reporte financiero generado con éxito'
      : 'No hay datos financieros disponibles para el periodo seleccionado.',
    totales: {
      totalRecaudado,
      totalSaldoPendiente,
      totalSaldoEnMora,
      totalIngresos,
      saldoPendienteGlobal,
      tasaRecaudo,
      cantidadPagos,
      cuotasTotalesPeriodo,
      cuotasPagadas,
      cuotasPendientes,
      cuotasVencidas,
    },
    desgloseMetodosPago,
    desglosePorCliente,
    transacciones,
    cuotasDetalle,
  };
}

/**
 * Exporta el reporte consolidado a formato PDF
 */
function exportarReportePDF(reporte, res) {
  const doc = new PDFDocument({
    margin: 40,
    size: 'LETTER',
    bufferPages: true,
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Reporte_Financiero_MotoLeasing_${reporte.fechaInicio}_${reporte.fechaFin}.pdf"`
  );

  doc.pipe(res);

  // Paleta de colores
  const PRIMARY = '#C0001A';
  const DARK = '#141414';
  const GRAY = '#555555';
  const LIGHT_GRAY = '#F3F4F6';
  const BORDER = '#E5E7EB';

  // Encabezado
  doc.rect(40, 40, 532, 60).fill('#1A1A1A');

  doc.fillColor('#FFFFFF').fontSize(18).font('Helvetica-Bold')
     .text('MOTOLEASING', 55, 52);
  doc.fillColor('#C0001A').fontSize(10).font('Helvetica-Bold')
     .text('SISTEMA DE GESTIÓN Y CRÉDITO', 55, 74);

  doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
     .text('REPORTE FINANCIERO CONSOLIDADO', 280, 52, { align: 'right', width: 280 });
  doc.fillColor('#A0A0A0').fontSize(9).font('Helvetica')
     .text(`Periodo: ${reporte.fechaInicio} al ${reporte.fechaFin}`, 280, 68, { align: 'right', width: 280 })
     .text(`Generado: ${new Date().toLocaleString('es-CO')}`, 280, 81, { align: 'right', width: 280 });

  doc.y = 115;

  // Advertencia si no hay datos (Criterio de Aceptación)
  if (!reporte.tieneDatos) {
    doc.rect(40, doc.y, 532, 60).fillAndStroke('#FAFAFA', '#C0001A');
    doc.fillColor('#C0001A').fontSize(11).font('Helvetica-Bold')
       .text('ADVERTENCIA: SIN DATOS DISPONIBLES', 55, doc.y - 48);
    doc.fillColor(DARK).fontSize(9).font('Helvetica')
       .text('No hay datos financieros disponibles para el periodo seleccionado.', 55, doc.y + 4)
       .text(`No se registraron transacciones ni cuotas entre el ${reporte.fechaInicio} y el ${reporte.fechaFin}.`, 55, doc.y + 4);
    
    doc.end();
    return;
  }

  // Tarjetas de Resumen KPI (Estilo corporativo sobrio)
  const cardW = 125;
  const cardH = 55;
  const startX = 40;
  const gap = 10;
  const kpiY = doc.y;

  const kpis = [
    { label: 'TOTAL RECAUDADO', value: formatCOP(reporte.totales.totalRecaudado), color: DARK, bg: '#F9FAFB' },
    { label: 'SALDO PENDIENTE', value: formatCOP(reporte.totales.totalSaldoPendiente), color: DARK, bg: '#F9FAFB' },
    { label: 'INGRESOS PROGRAMADOS', value: formatCOP(reporte.totales.totalIngresos), color: DARK, bg: '#F9FAFB' },
    { label: 'TASA DE RECAUDO', value: `${reporte.totales.tasaRecaudo}%`, color: '#C0001A', bg: '#F9FAFB' },
  ];

  kpis.forEach((kpi, idx) => {
    const x = startX + idx * (cardW + gap);
    doc.rect(x, kpiY, cardW, cardH).fillAndStroke(kpi.bg, BORDER);
    doc.fillColor(GRAY).fontSize(7).font('Helvetica-Bold')
       .text(kpi.label, x + 8, kpiY + 8);
    doc.fillColor(kpi.color).fontSize(11).font('Helvetica-Bold')
       .text(kpi.value, x + 8, kpiY + 22, { width: cardW - 16 });
    doc.fillColor(GRAY).fontSize(7).font('Helvetica')
       .text(idx === 0 ? `${reporte.totales.cantidadPagos} pagos` : idx === 1 ? `${reporte.totales.cuotasPendientes + reporte.totales.cuotasVencidas} cuotas pend.` : 'Periodo', x + 8, kpiY + 40);
  });

  doc.y = kpiY + cardH + 18;

  // Sección 1: Desglose por Método de Pago
  doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold')
     .text('DISTRIBUCIÓN POR MÉTODO DE PAGO', 40, doc.y);
  doc.y += 6;

  // Header tabla métodos
  const colM1 = 40, colM2 = 200, colM3 = 340, colM4 = 460;
  doc.rect(40, doc.y, 532, 18).fill('#F3F4F6');
  doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
     .text('MÉTODO DE PAGO', colM1 + 6, doc.y + 5)
     .text('CANTIDAD', colM2, doc.y + 5)
     .text('TOTAL RECAUDADO', colM3, doc.y + 5)
     .text('PARTICIPACIÓN', colM4, doc.y + 5);
  doc.y += 20;

  if (reporte.desgloseMetodosPago.length === 0) {
    doc.fillColor(GRAY).fontSize(8).font('Helvetica').text('No se registraron pagos con métodos clasificados.', 46, doc.y);
    doc.y += 14;
  } else {
    reporte.desgloseMetodosPago.forEach((m, idx) => {
      const bgRow = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA';
      doc.rect(40, doc.y, 532, 16).fill(bgRow);
      doc.fillColor(DARK).fontSize(8).font('Helvetica')
         .text(m.metodo.toUpperCase(), colM1 + 6, doc.y + 4)
         .text(String(m.cantidad), colM2, doc.y + 4)
         .text(formatCOP(m.montoTotal), colM3, doc.y + 4)
         .text(`${m.porcentaje}%`, colM4, doc.y + 4);
      doc.y += 16;
    });
  }

  doc.y += 12;

  // Sección 2: Transacciones del Periodo
  doc.fillColor(DARK).fontSize(11).font('Helvetica-Bold')
     .text('DETALLE DE TRANSACCIONES Y RECAUDOS', 40, doc.y);
  doc.y += 6;

  // Headers de la tabla de transacciones
  const tCol = [40, 100, 220, 290, 360, 440, 510];
  doc.rect(40, doc.y, 532, 18).fill('#1A1A1A');
  doc.fillColor('#FFFFFF').fontSize(7.5).font('Helvetica-Bold')
     .text('FECHA', tCol[0] + 4, doc.y + 5)
     .text('CLIENTE', tCol[1], doc.y + 5)
     .text('PLACA', tCol[2], doc.y + 5)
     .text('MÉTODO', tCol[3], doc.y + 5)
     .text('REFERENCIA', tCol[4], doc.y + 5)
     .text('MONTO (COP)', tCol[5], doc.y + 5);
  doc.y += 20;

  // Renderizar filas de transacciones (máximo primeras 25 en página 1/2)
  const txList = reporte.transacciones.slice(0, 30);
  txList.forEach((t, idx) => {
    if (doc.y > 700) {
      doc.addPage();
      doc.y = 40;
    }
    const bgRow = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
    doc.rect(40, doc.y, 532, 16).fill(bgRow);
    doc.fillColor(DARK).fontSize(7.5).font('Helvetica')
       .text(t.fechaPago, tCol[0] + 4, doc.y + 4)
       .text(t.clienteNombre.slice(0, 22), tCol[1], doc.y + 4)
       .text(t.placa, tCol[2], doc.y + 4)
       .text(t.metodoPago.toUpperCase(), tCol[3], doc.y + 4)
       .text((t.referencia || 'N/A').slice(0, 14), tCol[4], doc.y + 4)
       .font('Helvetica-Bold').text(formatCOP(t.monto), tCol[5], doc.y + 4);
    doc.y += 16;
  });

  if (reporte.transacciones.length > 30) {
    doc.fillColor(GRAY).fontSize(8).font('Helvetica-Oblique')
       .text(`... y ${reporte.transacciones.length - 30} transacciones adicionales en el reporte digital y Excel.`, 45, doc.y + 4);
  }

  // Pie de página
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.fillColor(GRAY).fontSize(7.5).font('Helvetica')
       .text(
         `MotoLeasing S.A.S. — Reporte Financiero Confidencial — Página ${i + 1} de ${totalPages}`,
         40,
         750,
         { align: 'center', width: 532 }
       );
  }

  doc.end();
}

/**
 * Exporta el reporte consolidado a formato Excel (XLSX)
 */
async function exportarReporteExcel(reporte, res) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'MotoLeasing Platform';
  workbook.created = new Date();

  // Hoja 1: Resumen Ejecutivo
  const wsResumen = workbook.addWorksheet('Resumen Ejecutivo');
  
  // Estilos de cabecera
  wsResumen.mergeCells('A1:F1');
  const titleCell = wsResumen.getCell('A1');
  titleCell.value = 'MOTOLEASING — REPORTE FINANCIERO CONSOLIDADO';
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0001A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  wsResumen.getRow(1).height = 36;

  wsResumen.getCell('A2').value = `Periodo Consultado: ${reporte.fechaInicio} al ${reporte.fechaFin}`;
  wsResumen.getCell('A2').font = { bold: true };
  wsResumen.getCell('A3').value = `Fecha de Generación: ${new Date().toLocaleString('es-CO')}`;
  wsResumen.getCell('A4').value = `Estado: ${reporte.tieneDatos ? 'Con movimientos registrados' : 'Sin datos disponibles'}`;

  // Si no hay datos, agregar advertencia
  if (!reporte.tieneDatos) {
    wsResumen.getCell('A6').value = 'ADVERTENCIA:';
    wsResumen.getCell('A6').font = { bold: true, color: { argb: 'FFDC2626' } };
    wsResumen.getCell('B6').value = 'No hay datos financieros disponibles para el periodo seleccionado.';
  } else {
    // KPIs
    wsResumen.getCell('A6').value = 'INDICADOR FINANCIERO';
    wsResumen.getCell('B6').value = 'VALOR CONSOLIDADO';
    wsResumen.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsResumen.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F1F1F' } };

    const kpiRows = [
      ['Total Recaudado (Efectivo cobrado)', reporte.totales.totalRecaudado, '$#,##0'],
      ['Total Saldo Pendiente del Periodo', reporte.totales.totalSaldoPendiente, '$#,##0'],
      ['Total Saldo en Mora del Periodo', reporte.totales.totalSaldoEnMora, '$#,##0'],
      ['Total Ingresos Programados / Exigibles', reporte.totales.totalIngresos, '$#,##0'],
      ['Tasa de Cumplimiento / Recaudo', reporte.totales.tasaRecaudo / 100, '0.0%'],
      ['Cantidad de Pagos Recibidos', reporte.totales.cantidadPagos, '#,##0'],
      ['Cuotas Exigibles en Periodo', reporte.totales.cuotasTotalesPeriodo, '#,##0'],
      ['Cuotas Pagadas en Periodo', reporte.totales.cuotasPagadas, '#,##0'],
      ['Cuotas Vencidas / En Mora', reporte.totales.cuotasVencidas, '#,##0'],
      ['Saldo Pendiente Global de la Flota', reporte.totales.saldoPendienteGlobal, '$#,##0'],
    ];

    kpiRows.forEach((r, idx) => {
      const rowIdx = 7 + idx;
      wsResumen.getCell(`A${rowIdx}`).value = r[0];
      const valCell = wsResumen.getCell(`B${rowIdx}`);
      valCell.value = r[1];
      if (r[2]) valCell.numFmt = r[2];
      valCell.font = { bold: true };
    });

    // Desglose métodos
    const metStart = 19;
    wsResumen.getCell(`A${metStart}`).value = 'MÉTODO DE PAGO';
    wsResumen.getCell(`B${metStart}`).value = 'TRANSACCIONES';
    wsResumen.getCell(`C${metStart}`).value = 'TOTAL RECAUDADO';
    wsResumen.getCell(`D${metStart}`).value = '% PARTICIPACIÓN';
    wsResumen.getRow(metStart).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    wsResumen.getRow(metStart).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0001A' } };

    reporte.desgloseMetodosPago.forEach((m, idx) => {
      const r = metStart + 1 + idx;
      wsResumen.getCell(`A${r}`).value = m.metodo.toUpperCase();
      wsResumen.getCell(`B${r}`).value = m.cantidad;
      const cCell = wsResumen.getCell(`C${r}`);
      cCell.value = m.montoTotal;
      cCell.numFmt = '$#,##0';
      const dCell = wsResumen.getCell(`D${r}`);
      dCell.value = m.porcentaje / 100;
      dCell.numFmt = '0.0%';
    });
  }

  wsResumen.columns = [{ width: 38 }, { width: 25 }, { width: 22 }, { width: 18 }];

  // Hoja 2: Transacciones (Recaudos)
  const wsTx = workbook.addWorksheet('Transacciones (Recaudos)');
  wsTx.columns = [
    { header: 'ID Transacción', key: 'id', width: 24 },
    { header: 'Fecha Pago', key: 'fechaPago', width: 14 },
    { header: 'Cliente', key: 'cliente', width: 28 },
    { header: 'Documento', key: 'documento', width: 16 },
    { header: 'Motocicleta / Placa', key: 'moto', width: 22 },
    { header: 'N° Cuota', key: 'cuota', width: 10 },
    { header: 'Monto Recaudado', key: 'monto', width: 18 },
    { header: 'Método de Pago', key: 'metodo', width: 16 },
    { header: 'Referencia', key: 'ref', width: 20 },
    { header: 'Notas', key: 'notas', width: 26 },
  ];

  wsTx.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wsTx.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F1F1F' } };
  wsTx.getRow(1).height = 24;

  reporte.transacciones.forEach(t => {
    const row = wsTx.addRow({
      id: t.id,
      fechaPago: t.fechaPago,
      cliente: t.clienteNombre,
      documento: t.documentoId,
      moto: `${t.motocicleta} (${t.placa})`,
      cuota: t.numeroCuota ? `#${t.numeroCuota}` : 'N/A',
      monto: t.monto,
      metodo: t.metodoPago.toUpperCase(),
      ref: t.referencia || 'N/A',
      notas: t.notas || '',
    });
    row.getCell('monto').numFmt = '$#,##0';
  });

  // Hoja 3: Cuotas Exigibles del Periodo
  const wsCuotas = workbook.addWorksheet('Cuotas del Periodo');
  wsCuotas.columns = [
    { header: 'ID Cuota', key: 'id', width: 20 },
    { header: 'Contrato', key: 'contratoId', width: 14 },
    { header: 'Cliente', key: 'cliente', width: 28 },
    { header: 'Placa', key: 'placa', width: 12 },
    { header: 'N° Cuota', key: 'cuota', width: 10 },
    { header: 'Monto Cuota', key: 'monto', width: 18 },
    { header: 'Fecha Vencimiento', key: 'vencimiento', width: 18 },
    { header: 'Fecha Pago', key: 'fechaPago', width: 18 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Días Mora', key: 'mora', width: 12 },
  ];

  wsCuotas.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wsCuotas.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F1F1F' } };
  wsCuotas.getRow(1).height = 24;

  reporte.cuotasDetalle.forEach(c => {
    const row = wsCuotas.addRow({
      id: c.id,
      contratoId: c.contratoId,
      cliente: c.clienteNombre,
      placa: c.placa,
      cuota: `#${c.numeroCuota}`,
      monto: c.monto,
      vencimiento: c.fechaVencimiento,
      fechaPago: c.fechaPago || 'Pendiente',
      estado: c.estado.toUpperCase(),
      mora: c.diasMorosidad || 0,
    });
    row.getCell('monto').numFmt = '$#,##0';
  });

  // Hoja 4: Consolidado por Cliente
  const wsCli = workbook.addWorksheet('Consolidado por Cliente');
  wsCli.columns = [
    { header: 'Cliente', key: 'nombre', width: 28 },
    { header: 'Documento', key: 'doc', width: 16 },
    { header: 'Placa Asignada', key: 'placa', width: 16 },
    { header: 'Cuotas Esperadas', key: 'esperadas', width: 16 },
    { header: 'Cuotas Pagadas', key: 'pagadas', width: 16 },
    { header: 'Monto Recaudado', key: 'recaudado', width: 18 },
    { header: 'Saldo Pendiente Periodo', key: 'pendiente', width: 22 },
    { header: 'Estado Contrato', key: 'estado', width: 16 },
  ];

  wsCli.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  wsCli.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0001A' } };
  wsCli.getRow(1).height = 24;

  reporte.desglosePorCliente.forEach(c => {
    const row = wsCli.addRow({
      nombre: c.nombreCompleto,
      doc: c.documentoId,
      placa: c.placa,
      esperadas: c.cuotasEsperadas,
      pagadas: c.cuotasPagadas,
      recaudado: c.montoRecaudado,
      pendiente: c.saldoPendientePeriodo,
      estado: (c.estadoContrato || 'activo').toUpperCase(),
    });
    row.getCell('recaudado').numFmt = '$#,##0';
    row.getCell('pendiente').numFmt = '$#,##0';
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Reporte_Financiero_MotoLeasing_${reporte.fechaInicio}_${reporte.fechaFin}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
}

module.exports = {
  generarReporteFinanciero,
  exportarReportePDF,
  exportarReporteExcel,
};
