'use client';

import { use } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import { getClient, setGps } from '@/services/api/endpoints';
import { AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown, Minus, Zap, ZapOff, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ScoreCategoria } from '@/types';

const formatCOP=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);
const scoreColors: Record<ScoreCategoria, string> = { excelente: '#22c55e', bueno: '#3b82f6', regular: '#eab308', malo: '#ef4444' };
const scoreLabels: Record<ScoreCategoria, string> = { excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular', malo: 'Malo' };
const scoreMensaje: Record<ScoreCategoria, string> = {
  excelente: 'Este rider es un pagador estrella. Puntual, confiable y sin inconvenientes.',
  bueno:     'Buen comportamiento de pago. Algún retraso menor pero sin patrones preocupantes.',
  regular:   'Presenta retrasos frecuentes. Se recomienda seguimiento semanal.',
  malo:      'Alto riesgo. Mora recurrente. Considera activar protocolo de desactivación GPS.',
};

// plataformaIcon removed

function ScoreGauge({ puntaje, categoria }: { puntaje: number; categoria: ScoreCategoria }) {
  const color = scoreColors[categoria];
  const angle = (puntaje / 100) * 180 - 90;
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-20 overflow-hidden">
        <svg viewBox="0 0 160 80" className="w-full">
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" strokeLinecap="round" />
          <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${(puntaje / 100) * 220} 220`} opacity="0.9" />
          <g transform={`rotate(${angle}, 80, 80)`}>
            <line x1="80" y1="80" x2="80" y2="22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="80" cy="80" r="5" fill="white" />
          </g>
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-3xl font-black text-white">{puntaje}</span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>{scoreLabels[categoria]}</span>
    </div>
  );
}

function TimelineItem({ numeroCuota, monto, fechaVencimiento, fechaPago, estado, diasDiferencia }: {
  numeroCuota: number; monto: number; fechaVencimiento: string;
  fechaPago?: string; estado: string; diasDiferencia: number;
}) {
  const isPagado   = estado === 'pagado';
  const isVencido  = estado === 'vencido';
  const isPuntual  = isPagado && diasDiferencia <= 0;
  const isTarde    = isPagado && diasDiferencia > 0;

  const dotColor = isPuntual ? 'bg-green-500' : isTarde ? 'bg-yellow-500' : isVencido ? 'bg-red-500' : 'bg-[#555555]';
  const badge    = isPuntual ? 'text-green-400 bg-green-400/10 border-green-400/20'
                 : isTarde   ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
                 : isVencido ? 'text-red-400 bg-red-400/10 border-red-400/20'
                             : 'text-[#666666] bg-white/5 border-white/10';
  const icon = isPuntual ? <CheckCircle2 className="w-3 h-3" /> : isTarde ? <Clock className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />;
  const label= isPuntual ? 'A tiempo' : isTarde ? `${diasDiferencia}d tarde` : isVencido ? 'Sin pagar' : 'Pendiente';

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-3 h-3 rounded-full ${dotColor} mt-1 ring-2 ring-[#1F1F1F]`} />
        <div className="w-px flex-1 bg-white/8 mt-1" />
      </div>
      <div className="pb-4 flex-1">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white font-medium">Cuota #{numeroCuota}</p>
            <p className="text-xs text-[#666666]">Vence: {new Date(fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            {fechaPago && <p className="text-xs text-[#666666]">Pagado: {new Date(fechaPago).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#A0A0A0]">{formatCOP(monto)}</span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badge}`}>{icon}{label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  useEffect(() => { getClient(id).then(setData).catch(e => setError(e.response?.data?.error || e.message)); }, [id]);
  const cliente = data?.cliente; const motocicleta = data?.motocicleta; const contrato = data?.contrato; const score = data?.score; const historial = data?.historial || [];
  const gpsState = motocicleta?.estadoGPS ?? 'desconocido';

  if (!data) return <AdminLayout><div className="p-8 text-white">{error || 'Cargando…'}</div></AdminLayout>;
  if (!cliente || !motocicleta || !contrato || !score) return <AdminLayout><div className="p-8 text-white">Cliente sin información completa.</div></AdminLayout>;

  const toggleGPS = async () => {
    setGpsLoading(true);
    try { await setGps(motocicleta.id, gpsState !== 'encendido'); const fresh = await getClient(id); setData(fresh); } catch (e: any) { alert(e.response?.data?.error || e.message); } finally { setGpsLoading(false); }
  };

  const gpsOn = gpsState === 'encendido';
  const progreso = Math.round((contrato.cuotasPagadas / contrato.cuotasTotales) * 100);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Back */}
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-sm text-[#666666] hover:text-white transition">
          <ArrowLeft className="w-4 h-4" /> Volver al dashboard
        </Link>

        {/* Header card */}
        <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-6">
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-[#C0001A]/20 border-2 border-[#C0001A]/40 flex items-center justify-center shrink-0">
              <span className="text-2xl font-black text-[#C0001A]">{cliente.nombre[0]}{cliente.apellido[0]}</span>
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-white">{cliente.nombre} {cliente.apellido}</h1>
                <span className="px-2 py-0.5 rounded-full bg-[#C0001A]/15 border border-[#C0001A]/25 text-[10px] font-semibold text-[#C0001A]">
                  <span className="capitalize">{cliente.plataforma.replace("_", " ")}</span>
                </span>
                <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${contrato.estado === 'activo' ? 'bg-green-500/15 border-green-500/25 text-green-400' : 'bg-red-500/15 border-red-500/25 text-red-400'}`}>
                  {contrato.estado.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-[#666666]">{cliente.email} · {cliente.telefono}</p>
              <p className="text-xs text-[#555555] mt-0.5">CC {cliente.documentoId} · {cliente.ciudad}</p>
            </div>
            {/* GPS Control */}
            <button onClick={toggleGPS} disabled={gpsLoading}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-xl font-semibold text-sm border-2 transition-all duration-300 shrink-0 ${gpsOn ? 'border-green-500/50 bg-green-500/15 text-green-400 hover:bg-red-500/15 hover:border-red-500/50 hover:text-red-400' : 'border-red-500/50 bg-red-500/15 text-red-400 hover:bg-green-500/15 hover:border-green-500/50 hover:text-green-400'}`}>
              {gpsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : gpsOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
              GPS: {gpsLoading ? 'Procesando…' : gpsOn ? 'ENCENDIDO' : 'APAGADO'}
            </button>
          </div>

          {/* Moto row */}
          <div className="mt-5 pt-5 border-t border-white/8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div><p className="text-[10px] text-[#555555] uppercase tracking-wider mb-1">Motocicleta</p><p className="text-white font-medium">{motocicleta.marca} {motocicleta.modelo} {motocicleta.año}</p></div>
            <div><p className="text-[10px] text-[#555555] uppercase tracking-wider mb-1">Placa</p><p className="text-white font-mono font-bold">{motocicleta.placa}</p></div>
            <div><p className="text-[10px] text-[#555555] uppercase tracking-wider mb-1">Color</p><p className="text-white">{motocicleta.color}</p></div>
            <div><p className="text-[10px] text-[#555555] uppercase tracking-wider mb-1">N° Serie</p><p className="text-white font-mono text-xs">{motocicleta.numeroSerie}</p></div>
          </div>
        </div>

        {/* Grid: Score + Stats */}
        <div className="grid sm:grid-cols-3 gap-4">
          {/* Score gauge */}
          <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5 flex flex-col items-center gap-3">
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Score Crediticio</p>
            <ScoreGauge puntaje={score.puntaje} categoria={score.categoria} />
            <p className="text-xs text-[#666666] text-center">{scoreMensaje[score.categoria]}</p>
            <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: score.tendencia === 'subiendo' ? '#22c55e' : score.tendencia === 'bajando' ? '#ef4444' : '#A0A0A0' }}>
              {score.tendencia === 'subiendo' ? <TrendingUp className="w-3.5 h-3.5" /> : score.tendencia === 'bajando' ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              Tendencia {score.tendencia}
            </div>
          </div>

          {/* Contrato stats */}
          <div className="sm:col-span-2 rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5 space-y-4">
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Resumen del Contrato</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-[10px] text-[#555555] mb-1">Total Contrato</p><p className="text-lg font-bold text-white">{formatCOP(contrato.totalContrato)}</p></div>
              <div><p className="text-[10px] text-[#555555] mb-1">Saldo Pendiente</p><p className="text-lg font-bold text-[#C0001A]">{formatCOP(contrato.saldoPendiente)}</p></div>
              <div><p className="text-[10px] text-[#555555] mb-1">Puntualidad</p><p className="text-white font-semibold">{score.porcentajePuntual}%</p></div>
              <div><p className="text-[10px] text-[#555555] mb-1">Prom. días mora</p><p className="text-white font-semibold">{score.diasPromedioMora}d</p></div>
            </div>
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-[10px] text-[#555555] mb-1.5">
                <span>{contrato.cuotasPagadas} cuotas pagadas</span>
                <span>{contrato.cuotasTotales - contrato.cuotasPagadas} restantes</span>
              </div>
              <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                <div className="h-full rounded-full bg-[#C0001A] transition-all" style={{ width: `${progreso}%` }} />
              </div>
              <p className="text-[10px] text-[#666666] mt-1 text-right">{progreso}% completado · Vence {new Date(contrato.fechaFin).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>

        {/* Historial timeline */}
        <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-4">Historial de Pagos</p>
          {historial.length === 0
            ? <p className="text-sm text-[#555555] text-center py-8">Sin historial disponible.</p>
            : <div className="max-h-80 overflow-y-auto pr-1">
                {[...historial].reverse().map(h => <TimelineItem key={h.cuotaId} {...h} />)}
              </div>
          }
        </div>
      </div>
    </AdminLayout>
  );
}
