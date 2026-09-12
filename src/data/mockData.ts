import type {
  Cliente, Motocicleta, Contrato, Cuota, ScoreCredito,
  HistorialPago, AlertaDesactivacion, StatsResumen, ClienteConDetalle,
} from '@/types';

// ─── Clientes ────────────────────────────────────────────────────────────────

export const CLIENTES: Cliente[] = [
  { id: 'c1', nombre: 'Andrés', apellido: 'Martínez', email: 'andres.m@gmail.com', telefono: '3104567890', documentoId: '1020345678', plataforma: 'rappi', fechaRegistro: '2024-01-15', rol: 'rider', activo: true, ciudad: 'Bogotá' },
  { id: 'c2', nombre: 'Valentina', apellido: 'Gómez', email: 'vale.gomez@gmail.com', telefono: '3157891234', documentoId: '1023456789', plataforma: 'didi', fechaRegistro: '2024-02-10', rol: 'rider', activo: true, ciudad: 'Medellín' },
  { id: 'c3', nombre: 'Carlos', apellido: 'Pérez', email: 'carlos.p@hotmail.com', telefono: '3219876543', documentoId: '1100234567', plataforma: 'rappi', fechaRegistro: '2024-03-05', rol: 'rider', activo: true, ciudad: 'Cali' },
  { id: 'c4', nombre: 'Luisa', apellido: 'Rodríguez', email: 'luisa.r@gmail.com', telefono: '3001234567', documentoId: '1045678901', plataforma: 'uber_eats', fechaRegistro: '2024-03-20', rol: 'rider', activo: true, ciudad: 'Bogotá' },
  { id: 'c5', nombre: 'Miguel', apellido: 'Torres', email: 'miguel.t@gmail.com', telefono: '3132345678', documentoId: '1067890123', plataforma: 'didi', fechaRegistro: '2024-04-01', rol: 'rider', activo: true, ciudad: 'Barranquilla' },
  { id: 'c6', nombre: 'Camila', apellido: 'Vargas', email: 'cami.v@gmail.com', telefono: '3168901234', documentoId: '1089012345', plataforma: 'rappi', fechaRegistro: '2024-04-15', rol: 'rider', activo: false, ciudad: 'Bogotá' },
  { id: 'c7', nombre: 'Jorge', apellido: 'Hernández', email: 'jorge.h@gmail.com', telefono: '3174567890', documentoId: '1012345678', plataforma: 'uber_eats', fechaRegistro: '2024-05-01', rol: 'rider', activo: true, ciudad: 'Pereira' },
  { id: 'c8', nombre: 'Sofía', apellido: 'Mora', email: 'sofia.mora@gmail.com', telefono: '3185678901', documentoId: '1034567890', plataforma: 'rappi', fechaRegistro: '2024-05-20', rol: 'rider', activo: true, ciudad: 'Bogotá' },
];

// ─── Motocicletas ─────────────────────────────────────────────────────────────

export const MOTOCICLETAS: Motocicleta[] = [
  { id: 'm1', marca: 'Honda', modelo: 'CB190R', año: 2022, placa: 'ABC123', numeroSerie: 'HND2022001', color: 'Rojo', estadoGPS: 'encendido', disponible: false, clienteId: 'c1', creadoEn: '2024-01-15', vencimientoSOAT: '2025-08-30', vencimientoTecno: '2026-01-15' },
  { id: 'm2', marca: 'Yamaha', modelo: 'FZ-S', año: 2023, placa: 'DEF456', numeroSerie: 'YMH2023002', color: 'Azul', estadoGPS: 'encendido', disponible: false, clienteId: 'c2', creadoEn: '2024-02-10', vencimientoSOAT: '2025-12-15', vencimientoTecno: '2026-02-10' },
  { id: 'm3', marca: 'Suzuki', modelo: 'GS150', año: 2022, placa: 'GHI789', numeroSerie: 'SUZ2022003', color: 'Negro', estadoGPS: 'apagado', disponible: false, clienteId: 'c3', creadoEn: '2024-03-05', vencimientoSOAT: '2025-09-20', vencimientoTecno: '2025-10-05' },
  { id: 'm4', marca: 'Honda', modelo: 'XRE190', año: 2023, placa: 'JKL012', numeroSerie: 'HND2023004', color: 'Blanco', estadoGPS: 'encendido', disponible: false, clienteId: 'c4', creadoEn: '2024-03-20', vencimientoSOAT: '2026-03-20', vencimientoTecno: '2026-03-20' },
  { id: 'm5', marca: 'KTM', modelo: 'Duke 200', año: 2023, placa: 'MNO345', numeroSerie: 'KTM2023005', color: 'Naranja', estadoGPS: 'apagado', disponible: false, clienteId: 'c5', creadoEn: '2024-04-01', vencimientoSOAT: '2025-09-10', vencimientoTecno: '2025-11-01' },
  { id: 'm6', marca: 'Yamaha', modelo: 'MT-03', año: 2022, placa: 'PQR678', numeroSerie: 'YMH2022006', color: 'Gris', estadoGPS: 'sin_señal', disponible: false, clienteId: 'c6', creadoEn: '2024-04-15', vencimientoSOAT: '2025-07-15', vencimientoTecno: '2025-08-15' },
  { id: 'm7', marca: 'Honda', modelo: 'CB160F', año: 2023, placa: 'STU901', numeroSerie: 'HND2023007', color: 'Azul Marino', estadoGPS: 'encendido', disponible: false, clienteId: 'c7', creadoEn: '2024-05-01', vencimientoSOAT: '2026-05-01', vencimientoTecno: '2026-05-01' },
  { id: 'm8', marca: 'Bajaj', modelo: 'Pulsar NS200', año: 2023, placa: 'VWX234', numeroSerie: 'BJJ2023008', color: 'Rojo', estadoGPS: 'encendido', disponible: false, clienteId: 'c8', creadoEn: '2024-05-20', vencimientoSOAT: '2026-05-20', vencimientoTecno: '2026-05-20' },
];

// ─── Contratos ─────────────────────────────────────────────────────────────────

export const CONTRATOS: Contrato[] = [
  { id: 'ct1', clienteId: 'c1', motocicletaId: 'm1', estado: 'activo', fechaInicio: '2024-01-15', fechaFin: '2024-10-15', montoSemanal: 180000, totalContrato: 3240000, saldoPendiente: 360000, cuotasTotales: 18, cuotasPagadas: 16, creadoEn: '2024-01-15', actualizadoEn: '2024-09-01' },
  { id: 'ct2', clienteId: 'c2', motocicletaId: 'm2', estado: 'activo', fechaInicio: '2024-02-10', fechaFin: '2024-11-10', montoSemanal: 200000, totalContrato: 3600000, saldoPendiente: 800000, cuotasTotales: 18, cuotasPagadas: 14, creadoEn: '2024-02-10', actualizadoEn: '2024-09-01' },
  { id: 'ct3', clienteId: 'c3', motocicletaId: 'm3', estado: 'suspendido', fechaInicio: '2024-03-05', fechaFin: '2024-12-05', montoSemanal: 175000, totalContrato: 3150000, saldoPendiente: 1050000, cuotasTotales: 18, cuotasPagadas: 12, creadoEn: '2024-03-05', actualizadoEn: '2024-09-01' },
  { id: 'ct4', clienteId: 'c4', motocicletaId: 'm4', estado: 'activo', fechaInicio: '2024-03-20', fechaFin: '2024-12-20', montoSemanal: 190000, totalContrato: 3420000, saldoPendiente: 570000, cuotasTotales: 18, cuotasPagadas: 15, creadoEn: '2024-03-20', actualizadoEn: '2024-09-01' },
  { id: 'ct5', clienteId: 'c5', motocicletaId: 'm5', estado: 'suspendido', fechaInicio: '2024-04-01', fechaFin: '2025-01-01', montoSemanal: 210000, totalContrato: 3780000, saldoPendiente: 1470000, cuotasTotales: 18, cuotasPagadas: 11, creadoEn: '2024-04-01', actualizadoEn: '2024-09-01' },
  { id: 'ct6', clienteId: 'c6', motocicletaId: 'm6', estado: 'suspendido', fechaInicio: '2024-04-15', fechaFin: '2025-01-15', montoSemanal: 185000, totalContrato: 3330000, saldoPendiente: 1480000, cuotasTotales: 18, cuotasPagadas: 10, creadoEn: '2024-04-15', actualizadoEn: '2024-09-01' },
  { id: 'ct7', clienteId: 'c7', motocicletaId: 'm7', estado: 'activo', fechaInicio: '2024-05-01', fechaFin: '2025-02-01', montoSemanal: 170000, totalContrato: 3060000, saldoPendiente: 850000, cuotasTotales: 18, cuotasPagadas: 13, creadoEn: '2024-05-01', actualizadoEn: '2024-09-01' },
  { id: 'ct8', clienteId: 'c8', motocicletaId: 'm8', estado: 'activo', fechaInicio: '2024-05-20', fechaFin: '2025-02-20', montoSemanal: 195000, totalContrato: 3510000, saldoPendiente: 975000, cuotasTotales: 18, cuotasPagadas: 13, creadoEn: '2024-05-20', actualizadoEn: '2024-09-01' },
];

// ─── Scores Crediticios ────────────────────────────────────────────────────────

export const SCORES: ScoreCredito[] = [
  { clienteId: 'c1', puntaje: 92, categoria: 'excelente', porcentajePuntual: 94, diasPromedioMora: 0.5, cuotasPagadas: 16, cuotasTotales: 18, ultimaActualizacion: '2024-09-11', tendencia: 'subiendo' },
  { clienteId: 'c2', puntaje: 78, categoria: 'bueno', porcentajePuntual: 80, diasPromedioMora: 2.1, cuotasPagadas: 14, cuotasTotales: 18, ultimaActualizacion: '2024-09-11', tendencia: 'estable' },
  { clienteId: 'c3', puntaje: 41, categoria: 'malo', porcentajePuntual: 42, diasPromedioMora: 12.5, cuotasPagadas: 12, cuotasTotales: 18, ultimaActualizacion: '2024-09-11', tendencia: 'bajando' },
  { clienteId: 'c4', puntaje: 87, categoria: 'bueno', porcentajePuntual: 90, diasPromedioMora: 1.0, cuotasPagadas: 15, cuotasTotales: 18, ultimaActualizacion: '2024-09-11', tendencia: 'subiendo' },
  { clienteId: 'c5', puntaje: 35, categoria: 'malo', porcentajePuntual: 36, diasPromedioMora: 18.3, cuotasPagadas: 11, cuotasTotales: 18, ultimaActualizacion: '2024-09-11', tendencia: 'bajando' },
  { clienteId: 'c6', puntaje: 29, categoria: 'malo', porcentajePuntual: 30, diasPromedioMora: 22.0, cuotasPagadas: 10, cuotasTotales: 18, ultimaActualizacion: '2024-09-11', tendencia: 'bajando' },
  { clienteId: 'c7', puntaje: 65, categoria: 'regular', porcentajePuntual: 62, diasPromedioMora: 4.2, cuotasPagadas: 13, cuotasTotales: 18, ultimaActualizacion: '2024-09-11', tendencia: 'estable' },
  { clienteId: 'c8', puntaje: 81, categoria: 'bueno', porcentajePuntual: 84, diasPromedioMora: 1.8, cuotasPagadas: 13, cuotasTotales: 18, ultimaActualizacion: '2024-09-11', tendencia: 'subiendo' },
];

// ─── Historial de Pagos por cliente ──────────────────────────────────────────

export const HISTORIAL_PAGOS: Record<string, HistorialPago[]> = {
  c1: Array.from({ length: 16 }, (_, i) => ({
    cuotaId: `cuota-c1-${i + 1}`, numeroCuota: i + 1, monto: 180000,
    fechaVencimiento: new Date(2024, 0 + Math.floor(i / 2), 15 + (i % 2) * 7).toISOString().split('T')[0],
    fechaPago: new Date(2024, 0 + Math.floor(i / 2), 14 + (i % 2) * 7).toISOString().split('T')[0],
    estado: 'pagado' as const, diasDiferencia: -1,
  })),
  c3: [
    ...Array.from({ length: 8 }, (_, i) => ({ cuotaId: `cuota-c3-${i + 1}`, numeroCuota: i + 1, monto: 175000, fechaVencimiento: new Date(2024, 2 + Math.floor(i / 2), 5 + (i % 2) * 7).toISOString().split('T')[0], fechaPago: new Date(2024, 2 + Math.floor(i / 2), 5 + (i % 2) * 7 + (i > 4 ? 8 : 1)).toISOString().split('T')[0], estado: 'pagado' as const, diasDiferencia: i > 4 ? 8 : 1 })),
    ...Array.from({ length: 4 }, (_, i) => ({ cuotaId: `cuota-c3-${i + 9}`, numeroCuota: i + 9, monto: 175000, fechaVencimiento: new Date(2024, 6 + Math.floor(i / 2), 5 + (i % 2) * 7).toISOString().split('T')[0], estado: 'vencido' as const, diasDiferencia: 14 + i * 3 })),
  ],
  c5: Array.from({ length: 11 }, (_, i) => ({ cuotaId: `cuota-c5-${i + 1}`, numeroCuota: i + 1, monto: 210000, fechaVencimiento: new Date(2024, 3 + Math.floor(i / 2), 1 + (i % 2) * 7).toISOString().split('T')[0], fechaPago: i < 7 ? new Date(2024, 3 + Math.floor(i / 2), 1 + (i % 2) * 7 + (i > 4 ? 15 : 0)).toISOString().split('T')[0] : undefined, estado: i < 7 ? 'pagado' as const : 'vencido' as const, diasDiferencia: i > 4 ? 15 : 0 })),
};

// ─── Cuotas próximas (dashboard) ──────────────────────────────────────────────

export const PROXIMAS_CUOTAS: Record<string, Cuota> = {
  c1: { id: 'pc-c1', contratoId: 'ct1', numeroCuota: 17, monto: 180000, fechaVencimiento: '2024-09-18', estado: 'pendiente', diasMorosidad: 0 },
  c2: { id: 'pc-c2', contratoId: 'ct2', numeroCuota: 15, monto: 200000, fechaVencimiento: '2024-09-15', estado: 'pendiente', diasMorosidad: 0 },
  c3: { id: 'pc-c3', contratoId: 'ct3', numeroCuota: 13, monto: 175000, fechaVencimiento: '2024-08-28', estado: 'vencido', diasMorosidad: 14 },
  c4: { id: 'pc-c4', contratoId: 'ct4', numeroCuota: 16, monto: 190000, fechaVencimiento: '2024-09-20', estado: 'pendiente', diasMorosidad: 0 },
  c5: { id: 'pc-c5', contratoId: 'ct5', numeroCuota: 12, monto: 210000, fechaVencimiento: '2024-08-15', estado: 'vencido', diasMorosidad: 27 },
  c6: { id: 'pc-c6', contratoId: 'ct6', numeroCuota: 11, monto: 185000, fechaVencimiento: '2024-08-08', estado: 'vencido', diasMorosidad: 34 },
  c7: { id: 'pc-c7', contratoId: 'ct7', numeroCuota: 14, monto: 170000, fechaVencimiento: '2024-09-12', estado: 'pendiente', diasMorosidad: 0 },
  c8: { id: 'pc-c8', contratoId: 'ct8', numeroCuota: 14, monto: 195000, fechaVencimiento: '2024-09-14', estado: 'pendiente', diasMorosidad: 0 },
};

// ─── Alertas de Desactivación ─────────────────────────────────────────────────

export const ALERTAS_DESACTIVACION: AlertaDesactivacion[] = [
  { id: 'ad1', clienteId: 'c6', motocicletaId: 'm6', motivo: 'mora', diasMora: 34, fechaProgramada: '2024-09-12T10:00:00', urgencia: 'alta', atendida: false },
  { id: 'ad2', clienteId: 'c5', motocicletaId: 'm5', motivo: 'mora', diasMora: 27, fechaProgramada: '2024-09-13T14:00:00', urgencia: 'alta', atendida: false },
  { id: 'ad3', clienteId: 'c3', motocicletaId: 'm3', motivo: 'mora', diasMora: 14, fechaProgramada: '2024-09-15T09:00:00', urgencia: 'media', atendida: false },
  { id: 'ad4', clienteId: 'c2', motocicletaId: 'm2', motivo: 'vencimiento_contrato', fechaProgramada: '2024-11-10T00:00:00', urgencia: 'baja', atendida: false },
];

// ─── Stats Dashboard ──────────────────────────────────────────────────────────

export const STATS: StatsResumen = {
  motosActivas: 5,
  motosBloqueadas: 3,
  clientesEnMora: 3,
  recaudoMes: 4_340_000,
  recaudoMesAnterior: 3_950_000,
};

// ─── Vista consolidada (helper) ────────────────────────────────────────────────

export function getClientesConDetalle(): ClienteConDetalle[] {
  return CLIENTES.map((cliente) => {
    const moto     = MOTOCICLETAS.find(m => m.clienteId === cliente.id)!;
    const contrato = CONTRATOS.find(c => c.clienteId === cliente.id)!;
    const score    = SCORES.find(s => s.clienteId === cliente.id)!;
    const cuota    = PROXIMAS_CUOTAS[cliente.id] ?? null;
    return {
      cliente, motocicleta: moto, contrato, score,
      diasMora: cuota?.diasMorosidad ?? 0,
      proximaCuota: cuota,
    };
  });
}

export function getClienteDetalle(id: string) {
  const cliente    = CLIENTES.find(c => c.id === id);
  const motocicleta = MOTOCICLETAS.find(m => m.clienteId === id);
  const contrato   = CONTRATOS.find(c => c.clienteId === id);
  const score      = SCORES.find(s => s.clienteId === id);
  const historial  = HISTORIAL_PAGOS[id] ?? [];
  return { cliente, motocicleta, contrato, score, historial };
}

export function getAlertasConDetalle(): AlertaDesactivacion[] {
  return ALERTAS_DESACTIVACION.map(alerta => ({
    ...alerta,
    cliente: CLIENTES.find(c => c.id === alerta.clienteId),
    motocicleta: MOTOCICLETAS.find(m => m.id === alerta.motocicletaId),
  }));
}

// ─── Formatters ────────────────────────────────────────────────────────────────

export const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
