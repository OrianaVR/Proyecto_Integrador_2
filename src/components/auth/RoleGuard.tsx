'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import type { RolUsuario } from '@/types';

interface RoleGuardProps {
  /** Rol que tiene permitido ver esta sección */
  role: RolUsuario;
  children: React.ReactNode;
}

/** Ruta de inicio de cada rol: a donde se manda a quien entra a una sección que no es suya */
export const HOME_BY_ROLE: Record<RolUsuario, string> = {
  admin: '/admin/dashboard',
  rider: '/rider/mi-estado',
};

/**
 * Zustand `persist` lee localStorage DESPUÉS del primer render. Sin esperar a
 * que termine, `isAuth` aparece en false y se expulsaría al usuario aunque
 * tenga sesión. Este hook dice cuándo ya se rehidrató el store.
 * (En el servidor siempre devuelve false para no desincronizar la hidratación.)
 */
function useAuthHydrated() {
  return useSyncExternalStore(
    (onChange) => useAuthStore.persist.onFinishHydration(onChange),
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  );
}

export default function RoleGuard({ role, children }: RoleGuardProps) {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const isAuth = useAuthStore((s) => s.isAuth);
  const user = useAuthStore((s) => s.user);

  const allowed = hydrated && isAuth && user?.rol === role;

  useEffect(() => {
    if (!hydrated) return;

    // Sin sesión -> login
    if (!isAuth || !user) {
      router.replace('/login');
      return;
    }
    // Con sesión pero rol equivocado -> a su propia sección
    if (user.rol !== role) {
      router.replace(HOME_BY_ROLE[user.rol] ?? '/login');
    }
  }, [hydrated, isAuth, user, role, router]);

  // Mientras se verifica (o se redirige) NO se renderiza el contenido protegido,
  // así no hay un parpadeo de la pantalla de admin para un rider.
  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#141414]">
        <Loader2 className="w-6 h-6 animate-spin text-[#C0001A]" />
      </div>
    );
  }

  return <>{children}</>;
}