import apiClient from './client';
import type { ApiResponse, Cliente, ClienteConDetalle, Motocicleta, StatsResumen, AlertaDesactivacion, Cuota, Pago } from '@/types';

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