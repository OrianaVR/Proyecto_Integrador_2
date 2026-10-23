import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

export function getErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado') {
  if (axios.isAxiosError<{ error?: string }>(error)) {
    return error.response?.data?.error ?? error.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
  timeout: 10_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request Interceptor: adjuntar JWT ───────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response Interceptor: manejar 401 ───────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        // logout() limpia el token Y el estado persistido ('moto-auth')
        useAuthStore.getState().logout();
        window.history.replaceState(null, '', '/login');
        window.location.reload();
      }
    }
    return Promise.reject(error);
  },
);

export default apiClient;