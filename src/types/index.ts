// ─── Dominio: Moto Leasing Platform ─────────────────────────────────────────
// Moneda: COP (Pesos Colombianos)

export type EstadoContrato  = 'activo' | 'suspendido' | 'finalizado' | 'pendiente';
export type EstadoGPS       = 'encendido' | 'apagado' | 'sin_señal' | 'desconocido';
export type EstadoPago      = 'pagado' | 'pendiente' | 'vencido' | 'parcial';
export type RolUsuario      = 'admin' | 'rider';
export type PlataformaGig   = 'rappi' | 'didi' | 'uber_eats' | 'otra';
export type ScoreCategoria  = 'excelente' | 'bueno' | 'regular' | 'malo';
export type TipoDocumento   =
  | 'cedula' | 'contrato_firmado' | 'soat'
  | 'tecnomecanica' | 'tarjeta_propiedad'
  | 'licencia_conduccion' | 'foto_moto';

export type NotificationChannel = 'whatsapp' | 'sms' | 'email';

export interface Cliente {
  id: string; nombre: string; apellido: string; email: string;
  telefono: string; documentoId: string; plataforma: PlataformaGig;
  fechaRegistro: string; rol: RolUsuario; activo: boolean;
  fotoPerfil?: string; ciudad?: string;
  canalPreferido?: NotificationChannel; // nuevo campo
}
  id: string; nombre: string; apellido: string; email: string;
  telefono: string; documentoId: string; plataforma: PlataformaGig;
  fechaRegistro: string; rol: RolUsuario; activo: boolean;
  fotoPerfil?: string; ciudad?: string;
}

export interface DocumentoVehiculo {
  id: string; motocicletaId: string; tipo: TipoDocumento; nombre: string;
  url: string; fechaVencimiento?: string; fechaSubida: string; subidoPor: string;
}

export interface Motocicleta {
  id: string; marca: string; modelo: string; año: number; placa: string;
  numeroSerie: string; color: string; estadoGPS: EstadoGPS; dispositivoGPS?: string;
  foto?: string; disponible: boolean; clienteId?: string; creadoEn: string;
  vencimientoSOAT?: string; vencimientoTecno?: string; documentos?: DocumentoVehiculo[];
}

export interface Contrato {
  id: string; clienteId: string; cliente?: Cliente; motocicletaId: string;
  motocicleta?: Motocicleta; estado: EstadoContrato; fechaInicio: string;
  fechaFin: string; montoSemanal: number; totalContrato: number;
  saldoPendiente: number; cuotasTotales: number; cuotasPagadas: number;
  observaciones?: string; creadoEn: string; actualizadoEn: string;
}

export interface Cuota {
  id: string;
  contratoId: string;
  numeroCuota: number;
  monto: number;
  montoBase: number;
  montoMultas: number;
  montoExcedentes: number;
  fechaVencimiento: string;
  fechaPago?: string;
  estado: EstadoPago;
  diasMorosidad: number;
  referencia?: string;
}

export interface HistorialPago {
  cuotaId: string;
  numeroCuota: number;
  monto: number;
  montoBase: number;
  montoMultas: number;
  montoExcedentes: number;
  fechaVencimiento: string;
  fechaPago?: string;
  estado: EstadoPago;
  diasDiferencia: number;
}

export interface AlertaDesactivacion {
  id: string; clienteId: string; cliente?: Cliente;
  motocicletaId: string; motocicleta?: Motocicleta;
  motivo: 'mora' | 'vencimiento_contrato' | 'solicitud_manual';
  diasMora?: number; fechaProgramada: string;
  urgencia: 'alta' | 'media' | 'baja'; atendida: boolean;
}

export interface StatsResumen {
  motosActivas: number; motosBloqueadas: number;
  clientesEnMora: number; recaudoMes: number; recaudoMesAnterior: number;
}

export interface ComandoGPS {
  motocicletaId: string; accion: 'encender' | 'apagar';
  solicitadoPor: string; timestamp: string;
  resultado?: 'exitoso' | 'fallido' | 'pendiente'; mensajeError?: string;
}

export interface ClienteConDetalle {
  cliente: Cliente; motocicleta: Motocicleta;
  contrato: Contrato; score: ScoreCredito;
  diasMora: number; proximaCuota: Cuota | null;
}

export interface PaginatedResponse<T> {
  data: T[]; total: number; page: number; limit: number; totalPages: number;
}

export interface Notificacion {
  id: string;
  clienteId: string;
  contratoId?: string | null;
  cuotaId?: string | null;
  tipo: 'cobro' | 'pago' | 'cuota_registrada' | 'general';
  titulo: string;
  mensaje: string;
  monto?: number | null;
  canal?: 'whatsapp' | 'sms' | 'webhook' | 'sistema';
  destinatario?: string;
  estado?: 'enviado' | 'entregado' | 'pendiente' | 'fallido';
  fecha: string;
  leida?: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean; data?: T; message?: string; error?: string;
}

export interface TotalesReporteFinanciero {
  totalRecaudado: number;
  totalSaldoPendiente: number;
  totalSaldoEnMora: number;
  totalIngresos: number;
  saldoPendienteGlobal: number;
  tasaRecaudo: number;
  cantidadPagos: number;
  cuotasTotalesPeriodo: number;
  cuotasPagadas: number;
  cuotasPendientes: number;
  cuotasVencidas: number;
}

export interface DesgloseMetodoPago {
  metodo: string;
  cantidad: number;
  montoTotal: number;
  porcentaje: number;
}

export interface DesgloseClienteReporte {
  clienteId: string;
  nombreCompleto: string;
  documentoId: string;
  placa: string;
  montoRecaudado: number;
  cuotasEsperadas: number;
  cuotasPagadas: number;
  saldoPendientePeriodo: number;
  estadoContrato: string;
}

export interface TransaccionReporte {
  id: string;
  fechaPago: string;
  fechaPagoCompleta: string;
  monto: number;
  metodoPago: string;
  referencia: string;
  clienteId: string;
  clienteNombre: string;
  documentoId: string;
  motocicleta: string;
  placa: string;
  contratoId: string;
  numeroCuota: number | null;
  notas: string;
}

export interface CuotaReporte {
  id: string;
  contratoId: string;
  numeroCuota: number;
  monto: number;
  fechaVencimiento: string;
  fechaPago: string | null;
  estado: EstadoPago;
  diasMorosidad: number;
  clienteNombre: string;
  documentoId: string;
  placa: string;
}

export interface ReporteFinanciero {
  periodo: string;
  fechaInicio: string;
  fechaFin: string;
  fechaGeneracion: string;
  tieneDatos: boolean;
  mensaje: string;
  totales: TotalesReporteFinanciero;
  desgloseMetodosPago: DesgloseMetodoPago[];
  desglosePorCliente: DesgloseClienteReporte[];
  transacciones: TransaccionReporte[];
  cuotasDetalle: CuotaReporte[];
}
