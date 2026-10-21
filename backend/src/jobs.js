const { readDb, updateDb } = require('./db');
const { daysBetween, todayISO } = require('./utils');
const { enviarRecordatorioCobro, createNotification } = require('./notifications');

/**
 * HU-01: Procesa el envío de notificaciones automáticas de cobro
 * Criterio 1 (CP-HU01-01): Envío exitoso en la fecha de cobro con monto adeudado
 * Criterio 2 (CP-HU01-02): Omisión si el cliente ya registró su pago antes de la fecha
 */
async function processAutomaticCollection(fechaReferencia = null) {
  const db = readDb();
  const fechaRef = fechaReferencia || todayISO();

  const cuotasDelDia = (db.cuotas || []).filter(c => c.fechaVencimiento === fechaRef);

  const enviadas = [];
  const omitidosPorPago = [];
  const omitidosYaNotificados = [];

  for (const cuota of cuotasDelDia) {
    const contrato = db.contratos.find(c => c.id === cuota.contratoId);
    const cliente = contrato ? db.clientes.find(cl => cl.id === contrato.clienteId) : null;
    const moto = contrato ? db.motocicletas.find(m => m.id === contrato.motocicletaId) : null;

    // Criterio 2 (CP-HU01-02): Omitir si el cliente ya pagó antes de la fecha
    const yaPago = cuota.estado === 'pagado' || (db.pagos || []).some(p => p.cuotaId === cuota.id);
    if (yaPago) {
      omitidosPorPago.push({
        cuotaId: cuota.id,
        contratoId: cuota.contratoId,
        clienteId: contrato?.clienteId,
        clienteNombre: cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Desconocido',
        numeroCuota: cuota.numeroCuota,
        monto: cuota.monto,
        fechaVencimiento: cuota.fechaVencimiento,
        motivo: 'Pago completo registrado previamente. No se envía recordatorio.',
      });
      continue;
    }

    // Omitir si ya se envió el recordatorio para esta cuota hoy
    const yaNotificado = (db.notificaciones || []).some(n => n.cuotaId === cuota.id && n.tipo === 'cobro');
    if (yaNotificado) {
      omitidosYaNotificados.push({
        cuotaId: cuota.id,
        numeroCuota: cuota.numeroCuota,
        motivo: 'Recordatorio ya enviado previamente.',
      });
      continue;
    }

    // Criterio 1 (CP-HU01-01): Enviar notificación automática con el monto adeudado
    if (cuota.estado === 'pendiente' && cliente) {
      const notificacion = await enviarRecordatorioCobro({
        cliente,
        contrato,
        cuota,
        motocicleta: moto,
      });

      enviadas.push({
        notificacionId: notificacion.id,
        clienteId: cliente.id,
        clienteNombre: `${cliente.nombre} ${cliente.apellido}`,
        telefono: cliente.telefono,
        cuotaId: cuota.id,
        numeroCuota: cuota.numeroCuota,
        monto: cuota.monto,
        fechaVencimiento: cuota.fechaVencimiento,
        canal: notificacion.canal,
        estado: notificacion.estado,
        mensaje: notificacion.mensaje,
      });
    }
  }

  return {
    fechaEjecucion: fechaRef,
    notifications: enviadas.length,
    enviadas,
    omitidosPorPago,
    omitidosYaNotificados,
    totalCuotasEvaluadas: cuotasDelDia.length,
  };
}

function markOverdueFees() {
  const result = updateDb(db => {
    let updated = 0;
    const now = new Date();
    for (const cuota of db.cuotas) {
      if (cuota.estado === 'pendiente' && new Date(`${cuota.fechaVencimiento}T23:59:59`) < now) {
        cuota.estado = 'vencido';
        cuota.diasMorosidad = daysBetween(`${cuota.fechaVencimiento}T23:59:59`, now);
        updated += 1;
      }
      if (cuota.estado === 'vencido') cuota.diasMorosidad = daysBetween(`${cuota.fechaVencimiento}T23:59:59`, now);
    }
    return updated;
  });
  return result;
}

function autoShutdownMotos() {
  const threshold = Number(process.env.AUTO_SHUTDOWN_MORA_DAYS || 7);
  return updateDb(db => {
    let shutdowns = 0;
    const now = new Date().toISOString();
    for (const contrato of db.contratos) {
      const cuotasMora = db.cuotas.filter(c => c.contratoId === contrato.id && c.estado === 'vencido');
      const maxMora = cuotasMora.reduce((max, c) => Math.max(max, c.diasMorosidad || 0), 0);
      if (maxMora < threshold) continue;
      const moto = db.motocicletas.find(m => m.id === contrato.motocicletaId);
      if (!moto || moto.estadoGPS === 'apagado' || moto.estadoGPS === 'sin_señal') continue;
      moto.estadoGPS = 'apagado';
      moto.disponible = false;
      const command = { id: `gps-${Date.now()}-${moto.id}`, motocicletaId: moto.id, accion: 'apagar', solicitadoPor: 'system-auto', timestamp: now, resultado: 'exitoso' };
      db.comandosGPS.push(command);
      let alerta = db.alertas.find(a => a.motocicletaId === moto.id && !a.atendida && a.motivo === 'mora');
      if (!alerta) {
        alerta = { id: `alerta-${Date.now()}-${moto.id}`, clienteId: contrato.clienteId, motocicletaId: moto.id, motivo: 'mora', diasMora: maxMora, fechaProgramada: now, urgencia: maxMora >= 30 ? 'alta' : maxMora >= 15 ? 'media' : 'baja', atendida: false };
        db.alertas.push(alerta);
      }
      shutdowns += 1;
    }
    return shutdowns;
  });
}

/**
 * HU‑XX: Envía una alerta previa al corte cuando la cuota está pendiente y faltan unas horas
 * Criterio: si la cuota no está pagada y el tiempo restante al vencimiento es menor o igual al
 * número de horas configurado (por defecto 3), se envía una notificación de advertencia.
 */
async function processPreCutoffReminders(hoursBefore = Number(process.env.PRE_CUTOFF_HOURS || 3)) {
  const db = readDb();
  const now = new Date();
  const currentHour = now.getHours();
  // Asumimos que el corte ocurre a medianoche del día de vencimiento.
  // Si faltan <= hoursBefore horas para medianoche, enviamos alerta.
  const thresholdHour = 24 - hoursBefore;
  if (currentHour < thresholdHour) return { skipped: true, reason: 'Aún no es la ventana de alerta' };

  const pendingCuotas = (db.cuotas || []).filter(c =>
    c.estado === 'pendiente' &&
    c.fechaVencimiento === todayISO() &&
    !(db.notificaciones || []).some(n => n.cuotaId === c.id && n.tipo === 'aviso_corte')
  );

  const enviadas = [];
  for (const cuota of pendingCuotas) {
    const contrato = db.contratos.find(ct => ct.id === cuota.contratoId);
    const cliente = contrato ? db.clientes.find(cl => cl.id === contrato.clienteId) : null;
    const moto = contrato ? db.motocicletas.find(m => m.id === contrato.motocicletaId) : null;
    if (!cliente) continue;

    const horasRestantes = Math.max(0, hoursBefore - (currentHour - thresholdHour)); // aproximado
    const mensaje = `⚠️ *Alerta de corte inminente*
Hola ${cliente.nombre},
Tu cuota #${cuota.numeroCuota} vence en aproximadamente ${hoursBefore} horas.
Si no realizas el pago antes del corte, tu motocicleta será apagada.
`;

    const notificacion = await createNotification({
      clienteId: cliente.id,
      tipo: 'aviso_corte',
      titulo: 'Alerta de corte inminente',
      mensaje,
      contratoId: contrato?.id,
      cuotaId: cuota.id,
    });

    // registrar canal preferido si corresponde (re‑usar la lógica de envío de recordatorio)
    // Aquí simplemente guardamos la notificación en la base de datos; el envío real será manejado
    // por el mismo mecanismo que las demás notificaciones (sendMessagingProvider).
    enviadas.push({ notificacionId: notificacion.id, clienteId: cliente.id, cuotaId: cuota.id, canal: notificacion.canal });
  }

  return { enviadas, total: enviadas.length };
}

// Modificar runJobs para incluir el nuevo proceso
async function runJobs() {
  const overdue = markOverdueFees();
  const collection = await processAutomaticCollection();
  const preCutoff = await processPreCutoffReminders();
  const shutdowns = autoShutdownMotos();
  return { overdue, ...collection, preCutoff, shutdowns, executedAt: new Date().toISOString() };
}


module.exports = { runJobs, markOverdueFees, processAutomaticCollection, autoShutdownMotos };
