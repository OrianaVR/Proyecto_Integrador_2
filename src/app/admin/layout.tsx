import RoleGuard from '@/components/auth/RoleGuard';

// Protege TODAS las rutas /admin/* (dashboard, clientes, motocicletas, etc.)
export default function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard role="admin">{children}</RoleGuard>;
}