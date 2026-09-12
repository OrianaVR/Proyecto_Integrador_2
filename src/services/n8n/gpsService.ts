import axios from 'axios';
import type { ComandoGPS, ApiResponse } from '@/types';

const n8nClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_N8N_URL ?? 'http://localhost:5678',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Encender GPS de una motocicleta ─────────────────────────────────────────
export async function encenderMoto(
  motocicletaId: string,
  adminId: string,
): Promise<ApiResponse<ComandoGPS>> {
  const { data } = await n8nClient.post('/webhook/gps/encender', {
    motocicletaId,
    solicitadoPor: adminId,
    timestamp: new Date().toISOString(),
  });
  return data;
}

// ─── Apagar GPS de una motocicleta ────────────────────────────────────────────
export async function apagarMoto(
  motocicletaId: string,
  adminId: string,
): Promise<ApiResponse<ComandoGPS>> {
  const { data } = await n8nClient.post('/webhook/gps/apagar', {
    motocicletaId,
    solicitadoPor: adminId,
    timestamp: new Date().toISOString(),
  });
  return data;
}

// ─── Consultar estado GPS actual ──────────────────────────────────────────────
export async function consultarEstadoGPS(
  motocicletaId: string,
): Promise<ApiResponse<{ estado: string; ultimaActualizacion: string }>> {
  const { data } = await n8nClient.get(`/webhook/gps/estado/${motocicletaId}`);
  return data;
}

export default n8nClient;
