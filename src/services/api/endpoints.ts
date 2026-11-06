import apiClient from './client';
import type { ApiResponse, Cliente, ClienteConDetalle, Contrato, Motocicleta, StatsResumen, AlertaDesactivacion, UsuarioAutenticado, ComandoGPS, Cuota, Pago, PagoPendiente, ReporteFinanciero, Notificacion, AlertaFalloGPS, Multa, CargoAdicional, NotificationChannel, ConfiguracionNotificaciones } from '@/types';

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<ApiResponse<{ token: string; user: UsuarioAutenticado }>>('/auth/login', { email, password });
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo iniciar sesión');
  return data.data;
}
export async function getMe() { const { data } = await apiClient.get<ApiResponse<UsuarioAutenticado>>('/auth/me'); if (!data.success || !data.data) throw new Error(data.error || 'No autenticado'); return data.data; }
export async function getDashboardStats() { const { data } = await apiClient.get<ApiResponse<StatsResumen>>('/dashboard/stats'); if (!data.success || !data.data) throw new Error(data.error || 'Error cargando estadísticas'); return data.data; }
export async function getDashboardClients(search='') { const { data } = await apiClient.get<ApiResponse<{data: ClienteConDetalle[]; total:number; page:number; limit:number; totalPages:number}>>('/dashboard/clientes', { params: { search, limit: 100 } }); if (!data.success || !data.data) throw new Error(data.error || 'Error cargando clientes'); return data.data.data; }
export async function getClient(id: string) { const { data } = await apiClient.get<ApiResponse<ClienteConDetalle>>(`/clientes/${id}`); if (!data.success || !data.data) throw new Error(data.error || 'Cliente no encontrado'); return data.data; }
export async function createClient(payload: Record<string, unknown> | FormData) { const { data } = await apiClient.post<ApiResponse<{ cliente: Cliente; moto: Motocicleta; contrato: Contrato }>>('/clientes', payload, payload instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined); if (!data.success || !data.data) throw new Error(data.error || 'No se pudo registrar'); return data.data; }
export async function getMotorcycles(search='', gps='todos') { const { data } = await apiClient.get<ApiResponse<Motocicleta[]>>('/motocicletas', { params: { search, gps } }); if (!data.success || !data.data) throw new Error(data.error || 'Error cargando motocicletas'); return data.data; }
export async function setGps(id: string, on: boolean) { const { data } = await apiClient.post<ApiResponse<{ moto: Motocicleta; command: ComandoGPS }>>(`/motocicletas/${id}/gps/${on ? 'encender' : 'apagar'}`); if (!data.success) throw new Error(data.error || 'No se pudo cambiar el GPS'); return data.data; }
export async function getAlerts() { const { data } = await apiClient.get<ApiResponse<AlertaDesactivacion[]>>('/alertas/desactivacion'); if (!data.success || !data.data) throw new Error(data.error || 'Error cargando alertas'); return data.data; }
export async function deactivateAlert(id: string) { const { data } = await apiClient.post<ApiResponse<{ alerta: AlertaDesactivacion; motocicleta: Motocicleta; command: ComandoGPS }>>(`/alertas/${id}/desactivar`); if (!data.success) throw new Error(data.error || 'No se pudo desactivar'); return data.data; }

export async function getNotifications(clienteId?: string) {
  const url = clienteId ? `/notificaciones/cliente/${clienteId}` : '/notificaciones';
  const { data } = await apiClient.get<ApiResponse<Notificacion[]>>(url);
  if (!data.success || !data.data) throw new Error(data.error || 'Error cargando notificaciones');
  return data.data;
}

export async function runAutomaticCollection(fecha?: string) {
  const { data } = await apiClient.post<ApiResponse<Record<string, unknown>>>('/jobs/cobro-automatico', { fecha });
  if (!data.success || !data.data) throw new Error(data.error || 'Error al ejecutar cobro automático');
  return data.data;
}

export async function getFinancialReport(params: { fechaInicio: string; fechaFin: string; periodo?: string }) {
  const { data } = await apiClient.get<ApiResponse<ReporteFinanciero>>('/reportes/financiero', { params });
  if (!data.success || !data.data) throw new Error(data.error || 'Error al generar el reporte financiero');
  return data.data;
}

export async function downloadFinancialReportPdf(params: { fechaInicio: string; fechaFin: string; periodo?: string }) {
  const response = await apiClient.get('/reportes/financiero/pdf', {
    params,
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Reporte_Financiero_MotoLeasing_${params.fechaInicio}_${params.fechaFin}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadFinancialReportExcel(params: { fechaInicio: string; fechaFin: string; periodo?: string }) {
  const response = await apiClient.get('/reportes/financiero/excel', {
    params,
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Reporte_Financiero_MotoLeasing_${params.fechaInicio}_${params.fechaFin}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ─── Cuotas y pagos (Sprint 2) ───────────────────────────────────────────────
export async function getCuotasByContrato(contratoId: string) {
  const { data } = await apiClient.get<ApiResponse<Cuota[]>>(`/cuotas/contrato/${contratoId}`);
  if (!data.success || !data.data) throw new Error(data.error || 'Error cargando cuotas');
  return data.data;
}
export interface CrearCuotaPayload {
  contratoId: string; numeroCuota: number; monto: number; fechaVencimiento: string;
  // Desglose: hoy el backend solo guarda `monto` (el total); estos campos viajan para cuando lo persista.
  montoBase?: number; multas?: number; excedentes?: number;
}
export async function createCuota(payload: CrearCuotaPayload) {
  const { data } = await apiClient.post<ApiResponse<Cuota>>('/cuotas', payload);
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo registrar la cuota');
  return data.data;
}
/** El pago va como multipart/form-data porque lleva el comprobante (PDF/JPG/PNG, máx. 5 MB). */
export async function createPago(form: FormData) {
  const { data } = await apiClient.post<ApiResponse<Pago>>('/pagos', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo registrar el pago');
  return data.data;
}
export async function getPagosByCliente(clienteId: string) {
  const { data } = await apiClient.get<ApiResponse<Pago[]>>(`/pagos/cliente/${clienteId}`);
  if (!data.success || !data.data) throw new Error(data.error || 'Error cargando pagos');
  return data.data;
}

// ─── Verificación de pagos (HU-15) ───────────────────────────────────────────
export async function getPagosPendientes() {
  const { data } = await apiClient.get<ApiResponse<PagoPendiente[]>>('/pagos/pendientes');
  if (!data.success || !data.data) throw new Error(data.error || 'Error cargando pagos pendientes');
  return data.data;
}
/** Al aprobar, el backend enciende la moto si estaba apagada (HU-18). */
export async function aprobarPago(id: string) {
  const { data } = await apiClient.patch<ApiResponse<Pago>>(`/pagos/${id}/aprobar`);
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo aprobar el pago');
  return data.data;
}
/** Al rechazar, el backend revierte el saldo, la cuota y el score. */
export async function rechazarPago(id: string, razon: string) {
  const { data } = await apiClient.patch<ApiResponse<Pago>>(`/pagos/${id}/rechazar`, { razon });
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo rechazar el pago');
  return data.data;
}

// ─── Alertas de fallo del control remoto (HU-20) ─────────────────────────────
export async function getFallosGps() {
  const { data } = await apiClient.get<ApiResponse<AlertaFalloGPS[]>>('/alertas/fallos');
  if (!data.success || !data.data) throw new Error(data.error || 'Error cargando alertas de fallo');
  return data.data;
}
export async function resolverAlerta(id: string) {
  const { data } = await apiClient.patch<ApiResponse<AlertaFalloGPS>>(`/alertas/${id}/resolver`);
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo resolver la alerta');
  return data.data;
}

// ─── Multas de tránsito (HU-10) y excedentes / cargos adicionales (HU-11) ───
export async function getMultasByCliente(clienteId: string) {
  const { data } = await apiClient.get<ApiResponse<Multa[]>>(`/multas/cliente/${clienteId}`);
  if (!data.success || !data.data) throw new Error(data.error || 'Error cargando multas');
  return data.data;
}
export async function createMulta(payload: { clienteId: string; contratoId: string; monto: number; descripcion: string; fecha: string }) {
  const { data } = await apiClient.post<ApiResponse<Multa>>('/multas', payload);
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo registrar la multa');
  return data.data;
}
export async function pagarMulta(id: string) {
  const { data } = await apiClient.patch<ApiResponse<Multa>>(`/multas/${id}/pagar`);
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo marcar la multa como pagada');
  return data.data;
}
export async function getCargosByCliente(clienteId: string) {
  const { data } = await apiClient.get<ApiResponse<CargoAdicional[]>>(`/cargos-adicionales/cliente/${clienteId}`);
  if (!data.success || !data.data) throw new Error(data.error || 'Error cargando cargos');
  return data.data;
}
export async function createCargo(payload: { clienteId: string; contratoId: string; concepto: string; monto: number }) {
  const { data } = await apiClient.post<ApiResponse<CargoAdicional>>('/cargos-adicionales', payload);
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo registrar el cargo');
  return data.data;
}
export async function pagarCargo(id: string) {
  const { data } = await apiClient.patch<ApiResponse<CargoAdicional>>(`/cargos-adicionales/${id}/pagar`);
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo marcar el cargo como pagado');
  return data.data;
}

// ─── Canal de notificación (HU-04) ───────────────────────────────────────────
/** `null` = el cliente usa el canal por defecto de la configuración general */
export async function updateCanalCliente(clienteId: string, canal: NotificationChannel | null) {
  const { data } = await apiClient.patch<ApiResponse<Cliente>>(`/clientes/${clienteId}/canal`, { canal });
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo actualizar el canal');
  return data.data;
}
export async function getConfigNotificaciones() {
  const { data } = await apiClient.get<ApiResponse<ConfiguracionNotificaciones>>('/configuracion/notificaciones');
  if (!data.success || !data.data) throw new Error(data.error || 'Error cargando la configuración');
  return data.data;
}
export async function saveConfigNotificaciones(payload: { canalPorDefecto: NotificationChannel; canalesHabilitados: NotificationChannel[] }) {
  const { data } = await apiClient.put<ApiResponse<ConfiguracionNotificaciones>>('/configuracion/notificaciones', payload);
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo guardar la configuración');
  return data.data;
}
