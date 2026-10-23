'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bike, Search, Zap, ZapOff, ExternalLink, Loader2 } from 'lucide-react';
import { getMotorcycles, setGps } from '@/services/api/endpoints';
import { getErrorMessage } from '@/services/api/client';
import type { Motocicleta } from '@/types';

export default function MotocicletasPage() {
  const [motorcycles, setMotorcycles] = useState<Motocicleta[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      getMotorcycles(query, filter).then(data => { if (active) setMotorcycles(data); }).catch(console.error).finally(() => { if (active) setLoading(false); });
    }, query ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query, filter]);

  const toggleGps = async (motorcycle: Motocicleta) => {
    try {
      await setGps(motorcycle.id, motorcycle.estadoGPS !== 'encendido');
      setMotorcycles(await getMotorcycles(query, filter));
    } catch (error: unknown) { alert(getErrorMessage(error)); }
  };

  const counts = {
    active: motorcycles.filter(item => item.estadoGPS === 'encendido').length,
    off: motorcycles.filter(item => item.estadoGPS === 'apagado').length,
    noSignal: motorcycles.filter(item => item.estadoGPS === 'sin_señal').length,
  };

  return <AdminLayout><div className="p-6 space-y-6 max-w-[1400px] mx-auto">
    <div><h1 className="text-2xl font-bold text-white">Motocicletas</h1><p className="text-sm text-[#666]">Gestión de la flota</p></div>
    <div className="flex gap-3 text-xs"><span className="text-green-400">{counts.active} activas</span><span className="text-red-400">{counts.off} apagadas</span><span className="text-yellow-400">{counts.noSignal} sin señal</span></div>
    <div className="flex gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 text-[#555]" /><input value={query} onChange={event => setQuery(event.target.value)} className="w-full pl-9 py-2.5 rounded-xl bg-[#1F1F1F] border border-white/8 text-white" placeholder="Buscar por placa, marca, modelo…" /></div><select value={filter} onChange={event => setFilter(event.target.value)} className="rounded-xl bg-[#1F1F1F] border border-white/8 text-white px-3"><option value="todos">Todos</option><option value="encendido">Activas</option><option value="apagado">Apagadas</option><option value="sin_señal">Sin señal</option></select></div>
    {loading ? <Loader2 className="animate-spin text-[#C0001A]" /> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{motorcycles.map(motorcycle => <div key={motorcycle.id} className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5"><div className="flex justify-between"><Bike className="text-[#C0001A]" /><span className="text-xs text-[#A0A0A0]">{motorcycle.estadoGPS}</span></div><h2 className="text-white font-bold mt-4">{motorcycle.marca} {motorcycle.modelo}</h2><p className="text-[#C0001A] font-mono font-bold">{motorcycle.placa}</p><p className="text-xs text-[#666]">{motorcycle.año} · {motorcycle.color}</p><div className="flex gap-2 mt-4"><button onClick={() => toggleGps(motorcycle)} className="px-3 py-2 rounded-lg border border-white/10 text-xs text-white">{motorcycle.estadoGPS === 'encendido' ? <><ZapOff className="inline w-3 mr-1" />Apagar</> : <><Zap className="inline w-3 mr-1" />Encender</>}</button>{motorcycle.clienteId && <Link href={`/admin/clientes/${motorcycle.clienteId}`} className="px-3 py-2 rounded-lg border border-white/10 text-xs text-[#A0A0A0]">Perfil <ExternalLink className="inline w-3" /></Link>}</div></div>)}</div>}
  </div></AdminLayout>;
}
