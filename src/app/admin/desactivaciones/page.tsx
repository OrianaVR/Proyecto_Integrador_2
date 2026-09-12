'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { getAlerts, deactivateAlert } from '@/services/api/endpoints';
import { useEffect, useState } from 'react';
import { AlertTriangle, ZapOff, Loader2, CheckCircle2, Clock, Calendar } from 'lucide-react';

function Countdown({ fecha }: { fecha: string }) {
  const diff = new Date(fecha).getTime() - Date.now();
  if (diff < 0) return <span className="text-red-400 font-bold text-xs">¡Ahora!</span>;
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (d > 0) return <span className="text-yellow-400 font-semibold text-xs">En {d}d {h % 24}h</span>;
  return <span className="text-red-400 font-bold text-xs animate-pulse">En {h}h</span>;
}

export default function DesactivacionesPage() {
  const [alertas, setAlertas] = useState<any[]>([]);
  useEffect(() => { getAlerts().then(setAlertas).catch(e => alert(e.message)); }, []);
  const [loading, setLoading] = useState<string | null>(null);
  const [done,    setDone]    = useState<string[]>([]);

  const handleDesactivar = async (id: string) => {
    setLoading(id);
    try { await deactivateAlert(id); } catch (e: any) { alert(e.response?.data?.error || e.message); setLoading(null); return; }
    setLoading(null);
    setDone(p => [...p, id]);
    setAlertas(p => p.filter(a => a.id !== id));
  };

  const urgenciaColors: Record<string, string> = {
    alta:  'text-red-400 bg-red-400/10 border-red-400/25',
    media: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25',
    baja:  'text-blue-400 bg-blue-400/10 border-blue-400/25',
  };
  const urgenciaLabel: Record<string, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  const motivoLabel: Record<string, string> = {
    mora:               'Mora',
    vencimiento_contrato: 'Vencimiento contrato',
    solicitud_manual:   'Manual',
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-[#C0001A]" /> Próximas Desactivaciones
          </h1>
          <p className="text-sm text-[#666666] mt-0.5">Motos que requieren desactivación GPS por mora o vencimiento</p>
        </div>

        {/* Summary chips */}
        <div className="flex gap-3 flex-wrap text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">{alertas.filter(a => a.urgencia === 'alta').length} urgencia alta</span>
          <span className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">{alertas.filter(a => a.urgencia === 'media').length} urgencia media</span>
          <span className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">{alertas.filter(a => a.urgencia === 'baja').length} urgencia baja</span>
          {done.length > 0 && <span className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">{done.length} atendidas hoy</span>}
        </div>

        {/* Lista */}
        {alertas.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-12 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
            <p className="text-white font-semibold">¡Todo al día!</p>
            <p className="text-sm text-[#666666]">No hay desactivaciones pendientes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertas.map(alerta => {
              const isLoading = loading === alerta.id;
              const cliente   = alerta.cliente;
              const moto      = alerta.motocicleta;
              return (
                <div key={alerta.id} className={`rounded-2xl border bg-[#1F1F1F]/60 p-5 transition-all ${alerta.urgencia === 'alta' ? 'border-red-500/25' : alerta.urgencia === 'media' ? 'border-yellow-500/20' : 'border-white/8'}`}>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    {/* Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${urgenciaColors[alerta.urgencia]}`}>
                          {urgenciaLabel[alerta.urgencia]}
                        </span>
                        <span className="text-xs text-[#A0A0A0] border border-white/10 px-2.5 py-0.5 rounded-full">
                          {motivoLabel[alerta.motivo]}
                        </span>
                        {alerta.diasMora && (
                          <span className="text-xs text-red-400 border border-red-400/20 bg-red-400/8 px-2.5 py-0.5 rounded-full">
                            {alerta.diasMora} días en mora
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-0.5">Rider</p>
                          <p className="text-white font-medium">{cliente ? `${cliente.nombre} ${cliente.apellido}` : '—'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-0.5">Motocicleta</p>
                          <p className="text-white font-medium">{moto ? `${moto.marca} ${moto.modelo}` : '—'}</p>
                          {moto && <p className="font-mono text-[#C0001A] text-[10px] font-bold">{moto.placa}</p>}
                        </div>
                        <div>
                          <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-0.5">Programada</p>
                          <div className="flex items-center gap-1 text-[#A0A0A0]">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(alerta.fechaProgramada).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-0.5">Tiempo restante</p>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#666666]" />
                            <Countdown fecha={alerta.fechaProgramada} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Acción */}
                    <button
                      onClick={() => handleDesactivar(alerta.id)}
                      disabled={isLoading}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all shrink-0 ${alerta.urgencia === 'alta' ? 'border-red-500/50 bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'}`}
                    >
                      {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : <><ZapOff className="w-4 h-4" /> Desactivar ahora</>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
