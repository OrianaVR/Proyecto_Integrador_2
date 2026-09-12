import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Cliente } from '@/types';

interface AuthState {
  user:     Cliente | null;
  token:    string | null;
  isAuth:   boolean;
  setAuth:  (user: Cliente, token: string) => void;
  logout:   () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:    null,
      token:   null,
      isAuth:  false,

      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('auth_token', token);
        }
        set({ user, token, isAuth: true });
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('auth_token');
        }
        set({ user: null, token: null, isAuth: false });
      },
    }),
    {
      name: 'moto-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuth: state.isAuth }),
    },
  ),
);
