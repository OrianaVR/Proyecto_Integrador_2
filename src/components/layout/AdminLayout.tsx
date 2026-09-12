'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Bike, AlertTriangle, UserPlus,
  LogOut, Menu, X, Zap, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/admin/dashboard',      label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/admin/clientes',       label: 'Clientes',          icon: Users },
  { href: '/admin/clientes/nuevo', label: 'Nuevo Cliente',     icon: UserPlus },
  { href: '/admin/motocicletas',   label: 'Motocicletas',      icon: Bike },
  { href: '/admin/desactivaciones', label: 'Desactivaciones',  icon: AlertTriangle },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { logout } = useAuthStore();
  const [open, setOpen]   = useState(false);

  const handleLogout = () => { logout(); router.push('/login'); };

  const Sidebar = ({ mobile = false }) => (
    <aside className={cn(
      'flex flex-col h-full bg-[#141414] border-r border-white/8',
      mobile ? 'w-72' : 'w-64',
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/8">
        <div className="w-9 h-9 rounded-xl bg-[#C0001A] flex items-center justify-center racing-glow">
          <Zap className="w-5 h-5 text-white fill-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-wide">MotoLeasing</p>
          <p className="text-xs text-[#666666]">Panel Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/admin/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group',
                active
                  ? 'bg-[#C0001A]/15 text-white border border-[#C0001A]/30'
                  : 'text-[#A0A0A0] hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className={cn('w-4.5 h-4.5 shrink-0 transition-colors', active ? 'text-[#C0001A]' : 'group-hover:text-[#C0001A]')} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 text-[#C0001A]" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/8">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[#A0A0A0] hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
        >
          <LogOut className="w-4.5 h-4.5 shrink-0 group-hover:text-red-400" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#141414]">
      {/* Sidebar Desktop */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full z-50">
            <Sidebar mobile />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-4 lg:px-6 h-14 border-b border-white/8 bg-[#141414]/80 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-2 rounded-lg text-[#A0A0A0] hover:bg-white/8 hover:text-white transition"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#C0001A]/20 border border-[#C0001A]/40 flex items-center justify-center">
              <span className="text-xs font-bold text-[#C0001A]">AD</span>
            </div>
            <span className="hidden sm:block text-sm text-[#A0A0A0]">Admin</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
