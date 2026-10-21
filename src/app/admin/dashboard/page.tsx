'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bike, Lock, AlertTriangle, DollarSign, Search, ExternalLink, Loader2 } from 'lucide-react';
import { getDashboardStats, getDashboardClients, setGps } from '@/services/api/endpoints';
import { getErrorMessage } from '@/services/api/client';
import type { ClienteConDetalle, StatsResumen } from '@/types';

const formatCOP = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(value);

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResumen | null>(null);
  const [rows, setRows] = useState<ClienteConDetalle[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getDashboardStats(), getDashboardClients()])
      .then(([nextStats, nextRows]) => {
        if (!active) return;
        setStats(nextStats);
        setRows(nextRows);
      })
      .catch(console.error)
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      getDashboardClients(query)
        .then(nextRows => { if (active) setRows(nextRows); })
        .catch(console.error);
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  const toggleGps = async (row: ClienteConDetalle) => {
    if (!row.motocicleta) return;
    try {
      await setGps(row.motocicleta.id, row.motocicleta.estadoGPS !== 'encendido');
      const [nextStats, nextRows] = await Promise.all([getDashboardStats(), getDashboardClients(query)]);
      setStats(nextStats);
      setRows(nextRows);
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    }
  };

  const cards = [
    { label: 'Motos Activas', value: stats?.motosActivas ?? 0, icon: Bike },
    { label: 'Motos Bloqueadas', value: stats?.motosBloqueadas ?? 0, icon: Lock },
    { label: 'Clientes en Mora', value: stats?.clientesEnMora ?? 0, icon: AlertTriangle },
    { label: 'Recaudo del Mes', value: formatCOP(stats?.recaudoMes ?? 0), icon: DollarSign },
  ];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div><h1 className="text-2xl font-bold text-white">Dashboard</h1><p className="text-sm text-[#666]">Resumen general de la plataforma</p></div>
        {loading && !stats ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[#C0001A]" /></div> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5"><Icon className="w-5 h-5 text-[#C0001A]" /><p className="text-2xl font-bold text-white mt-3">{value}</p><p className="text-xs text-[#666]">{label}</p></div>)}
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/40 overflow-hidden">
              <div className="p-4 border-b border-white/8"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar cliente o placa…" className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#141414] border border-white/8 text-sm text-white" /></div></div>
              <div className="overflow-x-auto"><table className="w-full text-sm">
                <thead><tr className="border-b border-white/8 text-left">{['Cliente', 'Plataforma', 'Motocicleta', 'Mora', 'Cuota', 'Score', 'GPS', ''].map(header => <th key={header} className="px-4 py-3 text-[10px] text-[#555] uppercase">{header}</th>)}</tr></thead>
                <tbody className="divide-y divide-white/5">{rows.map(row => {
                  const motorcycle = row.motocicleta;
                  const gpsOn = motorcycle?.estadoGPS === 'encendido';
                  return <tr key={row.cliente.id}>
                    <td className="px-4 py-3 text-white">{row.cliente.nombre} {row.cliente.apellido}<div className="text-[10px] text-[#555]">{row.cliente.email}</div></td>
                    <td className="px-4 py-3 text-[#A0A0A0]">{row.cliente.plataforma}</td>
                    <td className="px-4 py-3 text-white">{motorcycle ? `${motorcycle.marca} ${motorcycle.modelo}` : '—'}<div className="text-[10px] text-[#C0001A]">{motorcycle?.placa}</div></td>
                    <td className="px-4 py-3">{row.diasMora > 0 ? <span className="text-red-400">{row.diasMora}d</span> : <span className="text-green-400">Al día</span>}</td>
                    <td className="px-4 py-3 text-[#A0A0A0]">{formatCOP(row.contrato?.montoSemanal ?? 0)}</td><td className="px-4 py-3 text-white">{row.score?.puntaje ?? 0}</td>
                    <td className="px-4 py-3"><button disabled={!motorcycle} onClick={() => toggleGps(row)} className={gpsOn ? 'text-green-400' : 'text-red-400'}>{gpsOn ? 'ON' : 'OFF'}</button></td>
                    <td className="px-4"><Link href={`/admin/clientes/${row.cliente.id}`} aria-label={`Ver perfil de ${row.cliente.nombre}`}><ExternalLink className="w-4 text-[#666]" /></Link></td>
                  </tr>;
                })}</tbody>
              </table></div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
