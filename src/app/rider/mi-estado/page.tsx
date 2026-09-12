'use client';

import { useAuthStore } from '@/store/authStore';
import { getClient } from '@/services/api/endpoints';
import { Zap, ZapOff, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle, Clock, LogOut, Bike } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ScoreCategoria } from '@/types';

const formatCOP=(n:number)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n);

const scoreColors: Record<ScoreCategoria, string> = { excelente: '#22c55e', bueno: '#3b82f6', regular: '#eab308', malo: '#ef4444' };
const scoreLabels: Record<ScoreCategoria, string> = { excelente: 'Excelente', bueno: 'Bueno', regular: 'Regular', malo: 'Necesita mejorar' };
const scoreMensaje: Record<ScoreCategoria, string> = {
  excelente: '¡Eres un rider estrella! Sigues así y tendrás acceso a mejores condiciones.',
  bueno:     'Buen ritmo de pagos. Mantén la puntualidad para subir tu score.',
  regular:   'Tienes algunos retrasos. Paga a tiempo para mejorar tu historial.',
  malo:      'Tienes mora acumulada. Contáctanos para regularizar tu situación.',
};

// plataformaIcon removed
const plataformaLabel: Record<string, string> = { rappi: 'Rappi', didi: 'DiDi', uber_eats: 'Uber Eats', otra: 'Otra' };

export default function RiderMiEstadoPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const clienteId = user?.clienteId ?? user?.id;
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (clienteId) getClient(clienteId).then(setData).catch(e => setError(e.response?.data?.error || e.message)); }, [clienteId]);
  const cliente = data?.cliente, motocicleta = data?.motocicleta, contrato = data?.contrato, score = data?.score, historial = data?.historial || [];

  const handleLogout = () => { logout(); router.push('/login'); };

  if (!data) return <div className="min-h-screen bg-[#141414] flex items-center justify-center text-white">{error || 'Cargando…'}</div>;

  const progreso = Math.round((contrato.cuotasPagadas / contrato.cuotasTotales) * 100);
  const color    = scoreColors[score.categoria];

  return (
    <main className="min-h-screen bg-[#141414]">
      {/* Header */}
      <header className="border-b border-white/8 bg-[#141414]/90 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#C0001A] flex items-center justify-center">
          <Zap className="w-4 h-4 text-white fill-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold text-white">MotoLeasing</p>
          <p className="text-[10px] text-[#666666]">Portal Rider</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#A0A0A0] hidden sm:block">{plataformaLabel[cliente.plataforma]}</span>
          <button onClick={handleLogout} className="p-2 rounded-lg text-[#666666] hover:text-red-400 hover:bg-red-400/10 transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Saludo */}
        <div className="pt-2">
          <h1 className="text-xl font-bold text-white">¡Hola, {cliente.nombre}!</h1>
          <p className="text-sm text-[#666666]">{cliente.ciudad} · CC {cliente.documentoId}</p>
        </div>

        {/* Card Motocicleta */}
        <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 overflow-hidden">
          <div className="bg-gradient-to-br from-[#282828] to-[#1F1F1F] p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#C0001A]/15 border border-[#C0001A]/25 flex items-center justify-center shrink-0">
              <Bike className="w-7 h-7 text-[#C0001A]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold">{motocicleta.marca} {motocicleta.modelo} {motocicleta.año}</p>
              <code className="text-[#C0001A] font-mono font-bold text-sm tracking-widest">{motocicleta.placa}</code>
              <p className="text-[#666666] text-xs mt-0.5">{motocicleta.color} · Serie {motocicleta.numeroSerie}</p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold shrink-0 ${motocicleta.estadoGPS === 'encendido' ? 'text-green-400 bg-green-400/10 border-green-400/25' : 'text-red-400 bg-red-400/10 border-red-400/25'}`}>
              {motocicleta.estadoGPS === 'encendido' ? <><Zap className="w-3 h-3 fill-current" /> GPS ON</> : <><ZapOff className="w-3 h-3" /> GPS OFF</>}
            </div>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3 text-sm">
            <div className="bg-[#141414]/40 rounded-xl p-3">
              <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-1">SOAT vence</p>
              <p className="text-white text-xs font-medium">
                {motocicleta.vencimientoSOAT ? new Date(motocicleta.vencimientoSOAT).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/D'}
              </p>
            </div>
            <div className="bg-[#141414]/40 rounded-xl p-3">
              <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-1">Tecnomecánica</p>
              <p className="text-white text-xs font-medium">
                {motocicleta.vencimientoTecno ? new Date(motocicleta.vencimientoTecno).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/D'}
              </p>
            </div>
          </div>
        </div>

        {/* Deuda */}
        <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5 space-y-4">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Mi Leasing</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-[#555555] mb-1">Saldo pendiente</p>
              <p className="text-2xl font-black text-[#C0001A]">{formatCOP(contrato.saldoPendiente)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#555555] mb-1">Cuota semanal</p>
              <p className="text-2xl font-black text-white">{formatCOP(contrato.montoSemanal)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#555555] mb-1">Cuotas pagadas</p>
              <p className="text-white font-semibold">{contrato.cuotasPagadas} / {contrato.cuotasTotales}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#555555] mb-1">Vence contrato</p>
              <p className="text-white font-semibold text-xs">{new Date(contrato.fechaFin).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>
          {/* Barra progreso */}
          <div>
            <div className="flex justify-between text-[10px] text-[#555555] mb-1.5">
              <span>Progreso del contrato</span><span>{progreso}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#C0001A] to-[#FF4444] transition-all" style={{ width: `${progreso}%` }} />
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="rounded-2xl border bg-[#1F1F1F]/60 p-5 space-y-3" style={{ borderColor: `${color}30` }}>
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Mi Score Crediticio</p>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center border-2 shrink-0" style={{ borderColor: `${color}40`, backgroundColor: `${color}15` }}>
              <span className="text-2xl font-black" style={{ color }}>{score.puntaje}</span>
            </div>
            <div>
              <p className="font-bold text-white">{scoreLabels[score.categoria]}</p>
              <p className="text-xs text-[#666666] mt-0.5">{scoreMensaje[score.categoria]}</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 relative">
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 transition-all" style={{ left: `calc(${score.puntaje}% - 6px)`, borderColor: color }} />
          </div>
          <div className="flex justify-between text-[9px] text-[#555555]"><span>Malo</span><span>Regular</span><span>Bueno</span><span>Excelente</span></div>
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: score.tendencia === 'subiendo' ? '#22c55e' : score.tendencia === 'bajando' ? '#ef4444' : '#A0A0A0' }}>
            {score.tendencia === 'subiendo' ? <TrendingUp className="w-3.5 h-3.5" /> : score.tendencia === 'bajando' ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            Tendencia {score.tendencia} · {score.porcentajePuntual}% de cuotas a tiempo
          </div>
        </div>

        {/* Historial reciente */}
        <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-4">Últimos Pagos</p>
          {historial.length === 0 ? (
            <p className="text-sm text-[#555555] text-center py-4">Sin historial.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {[...historial].reverse().slice(0, 8).map(h => {
                const ok = h.estado === 'pagado' && h.diasDiferencia <= 0;
                const tard = h.estado === 'pagado' && h.diasDiferencia > 0;
                const venc = h.estado === 'vencido';
                return (
                  <div key={h.cuotaId} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${ok ? 'bg-green-500/15' : tard ? 'bg-yellow-500/15' : 'bg-red-500/15'}`}>
                      {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : tard ? <Clock className="w-3.5 h-3.5 text-yellow-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-white">Cuota #{h.numeroCuota}</p>
                      <p className="text-[10px] text-[#555555]">{new Date(h.fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-white">{formatCOP(h.monto)}</p>
                      <p className={`text-[10px] ${ok ? 'text-green-400' : tard ? 'text-yellow-400' : 'text-red-400'}`}>
                        {ok ? 'A tiempo' : tard ? `${h.diasDiferencia}d tarde` : venc ? 'Sin pagar' : 'Pendiente'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-[#334155] pb-4">MotoLeasing · {new Date().getFullYear()}</p>
      </div>
    </main>
  );
}
