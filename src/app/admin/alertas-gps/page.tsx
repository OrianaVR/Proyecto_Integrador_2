'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { getFallosGps, resolverAlerta, setGps } from '@/services/api/endpoints';
import { getErrorMessage } from '@/services/api/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WifiOff, CheckCircle2, Loader2, RotateCcw, AlertTriangle, Calendar, ExternalLink, Zap, ZapOff } from 'lucide-react';
import type { AlertaFalloGPS } from '@/types';

// HU-20 Alerta de fallo en el control remoto: el admin ve qué comandos no se pudieron ejecutar y los reintenta.
const errorLabel: Record<string, string> = {
  GPS_NO_SIGNAL: 'La motocicleta no tiene señal GPS',
  MOTO_NOT_FOUND: 'No se encontró la motocicleta',
};

const tipoLabel: Record<AlertaFalloGPS['tipo'], string> = {
  encendido: 'Fallo de encendido',
  apagado: 'Fallo de apagado',
};

export default function AlertasGpsPage() {
  const [alertas, setAlertas] = useState<AlertaFalloGPS[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [resueltas, setResueltas] = useState(0);

  useEffect(() => {
    let activo = true;
    getFallosGps()
      .then(data => { if (activo) setAlertas(data); })
      .catch(error => { if (activo) setErrorCarga(getErrorMessage(error)); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  const cerrar = async (alerta: AlertaFalloGPS, mensaje: string) => {
    await resolverAlerta(alerta.id);
    setAlertas(p => p.filter(a => a.id !== alerta.id));
    setResueltas(n => n + 1);
    setAviso(mensaje);
  };

  // Reintenta el mismo comando que falló; si funciona, la alerta se cierra
  const handleReintentar = async (alerta: AlertaFalloGPS) => {
    setProcesando(alerta.id); setAviso('');
    try {
      await setGps(alerta.motocicletaId, alerta.tipo === 'encendido');
      await cerrar(alerta, `Comando ejecutado: la moto ${alerta.motocicleta?.placa ?? ''} quedó ${alerta.tipo === 'encendido' ? 'encendida' : 'apagada'}.`);
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    } finally { setProcesando(null); }
  };

  const handleResolver = async (alerta: AlertaFalloGPS) => {
    setProcesando(alerta.id); setAviso('');
    try {
      await cerrar(alerta, 'Alerta marcada como resuelta.');
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    } finally { setProcesando(null); }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <WifiOff className="w-6 h-6 text-[#C0001A]" /> Alertas de Control Remoto
          </h1>
          <p className="text-sm text-[#666666] mt-0.5">Comandos de encendido o apagado que no se pudieron ejecutar en la moto</p>
        </div>

        {/* Summary chips */}
        <div className="flex gap-3 flex-wrap text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">{alertas.filter(a => a.tipo === 'apagado').length} fallos de apagado</span>
          <span className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">{alertas.filter(a => a.tipo === 'encendido').length} fallos de encendido</span>
          {resueltas > 0 && <span className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">{resueltas} resueltas</span>}
        </div>

        {aviso && (
          <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {aviso}
          </div>
        )}

        {/* Lista */}
        {cargando ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[#C0001A]" /></div>
        ) : errorCarga ? (
          <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> No se pudieron cargar las alertas: {errorCarga}
          </div>
        ) : alertas.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-12 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
            <p className="text-white font-semibold">¡Todo al día!</p>
            <p className="text-sm text-[#666666]">No hay fallos del control remoto.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alertas.map(alerta => {
              const ocupado = procesando === alerta.id;
              const { cliente, motocicleta: moto } = alerta;
              const esApagado = alerta.tipo === 'apagado';
              return (
                <div key={alerta.id} className={`rounded-2xl border bg-[#1F1F1F]/60 p-5 ${esApagado ? 'border-red-500/25' : 'border-yellow-500/20'}`}>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    {/* Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${esApagado ? 'text-red-400 bg-red-400/10 border-red-400/25' : 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25'}`}>
                          {tipoLabel[alerta.tipo]}
                        </span>
                        <span className="text-xs text-[#A0A0A0] border border-white/10 px-2.5 py-0.5 rounded-full">
                          {errorLabel[alerta.error] ?? alerta.error}
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
                          {cliente && (
                            <Link href={`/admin/clientes/${cliente.id}`} className="inline-flex items-center gap-1 text-[10px] text-[#666666] hover:text-white">
                              Ver ficha <ExternalLink className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                        <div>
                          <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-0.5">Motocicleta</p>
                          <p className="text-white font-medium">{moto ? `${moto.marca} ${moto.modelo}` : '—'}</p>
                          {moto && <p className="font-mono text-[#C0001A] text-[10px] font-bold">{moto.placa}</p>}
                        </div>
                        <div>
                          <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-0.5">Estado GPS actual</p>
                          <p className="text-[#A0A0A0]">{moto?.estadoGPS?.replace('_', ' ') ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-0.5">Detectado</p>
                          <div className="flex items-center gap-1 text-[#A0A0A0]">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(alerta.creadoEn).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Acciones */}
                    <div className="flex sm:flex-col gap-2 shrink-0">
                      <button onClick={() => handleReintentar(alerta)} disabled={ocupado}
                        className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all disabled:opacity-60 ${esApagado ? 'border-red-500/50 bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'}`}>
                        {ocupado ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : <>{esApagado ? <ZapOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />} <RotateCcw className="w-3.5 h-3.5" /> Reintentar {esApagado ? 'apagado' : 'encendido'}</>}
                      </button>
                      <button onClick={() => handleResolver(alerta)} disabled={ocupado}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-sm text-[#A0A0A0] hover:text-white hover:bg-white/5 transition disabled:opacity-60">
                        <CheckCircle2 className="w-4 h-4" /> Marcar como resuelta
                      </button>
                    </div>
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
