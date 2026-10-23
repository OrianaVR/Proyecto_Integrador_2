import apiClient from './client';
import type { ApiResponse, Cliente, ClienteConDetalle, Contrato, Motocicleta, StatsResumen, AlertaDesactivacion, UsuarioAutenticado, ComandoGPS, Cuota, Pago, ReporteFinanciero, Notificacion } from '@/types';

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
