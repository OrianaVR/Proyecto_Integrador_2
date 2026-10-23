import RoleGuard from '@/components/auth/RoleGuard';

// Protege TODAS las rutas /rider/*
export default function RiderSectionLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard role="rider">{children}</RoleGuard>;
}