import apiClient from './client';
import type { ApiResponse, Cliente, ClienteConDetalle, Motocicleta, StatsResumen, AlertaDesactivacion, ReporteFinanciero, Notificacion } from '@/types';

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<ApiResponse<{ token: string; user: Cliente & { id: string; rol: 'admin'|'rider'; clienteId?: string|null } }>>('/auth/login', { email, password });
  if (!data.success || !data.data) throw new Error(data.error || 'No se pudo iniciar sesión');
  return data.data;
}
export async function getMe() { const { data } = await apiClient.get<ApiResponse<any>>('/auth/me'); if (!data.success || !data.data) throw new Error(data.error || 'No autenticado'); return data.data; }
export async function getDashboardStats() { const { data } = await apiClient.get<ApiResponse<StatsResumen>>('/dashboard/stats'); if (!data.success || !data.data) throw new Error(data.error || 'Error cargando estadísticas'); return data.data; }
export async function getDashboardClients(search='') { const { data } = await apiClient.get<ApiResponse<{data: ClienteConDetalle[]; total:number; page:number; limit:number; totalPages:number}>>('/dashboard/clientes', { params: { search, limit: 100 } }); if (!data.success || !data.data) throw new Error(data.error || 'Error cargando clientes'); return data.data.data; }
export async function getClient(id: string) { const { data } = await apiClient.get<ApiResponse<ClienteConDetalle & { historial:any[] }>>(`/clientes/${id}`); if (!data.success || !data.data) throw new Error(data.error || 'Cliente no encontrado'); return data.data; }
export async function createClient(payload: Record<string, unknown>) { const { data } = await apiClient.post<ApiResponse<any>>('/clientes', payload); if (!data.success || !data.data) throw new Error(data.error || 'No se pudo registrar'); return data.data; }
export async function getMotorcycles(search='', gps='todos') { const { data } = await apiClient.get<ApiResponse<Motocicleta[]>>('/motocicletas', { params: { search, gps } }); if (!data.success || !data.data) throw new Error(data.error || 'Error cargando motocicletas'); return data.data; }
export async function setGps(id: string, on: boolean) { const { data } = await apiClient.post<ApiResponse<any>>(`/motocicletas/${id}/gps/${on ? 'encender' : 'apagar'}`); if (!data.success) throw new Error(data.error || 'No se pudo cambiar el GPS'); return data.data; }
export async function getAlerts() { const { data } = await apiClient.get<ApiResponse<AlertaDesactivacion[]>>('/alertas/desactivacion'); if (!data.success || !data.data) throw new Error(data.error || 'Error cargando alertas'); return data.data; }
export async function deactivateAlert(id: string) { const { data } = await apiClient.post<ApiResponse<any>>(`/alertas/${id}/desactivar`); if (!data.success) throw new Error(data.error || 'No se pudo desactivar'); return data.data; }

export async function getNotifications(clienteId?: string) {
  const url = clienteId ? `/notificaciones/cliente/${clienteId}` : '/notificaciones';
  const { data } = await apiClient.get<ApiResponse<Notificacion[]>>(url);
  if (!data.success || !data.data) throw new Error(data.error || 'Error cargando notificaciones');
  return data.data;
}

export async function runAutomaticCollection(fecha?: string) {
  const { data } = await apiClient.post<ApiResponse<any>>('/jobs/cobro-automatico', { fecha });
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
