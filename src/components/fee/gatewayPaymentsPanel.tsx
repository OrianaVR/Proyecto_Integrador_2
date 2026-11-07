'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, SearchX, XCircle } from 'lucide-react';
import { getTransaccionesPasarela, simularPagoPasarela } from '@/services/api/endpoints';
import { ErrorBox, errMsg } from './feePaymentPage';
import { formatCOP } from './nextFeeCard';
import type { HistorialPago, TransaccionPasarela } from '@/types';

// HU-14: la pasarela confirma el pago y el sistema lo concilia solo contra la cuota (sin verificación manual).
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

const RESULTADO: Record<TransaccionPasarela['resultado'], { label: string; cls: string; icon: React.ReactNode }> = {
  APLICADO: { label: 'Aprobado y aplicado', cls: 'text-green-400 bg-green-400/10 border-green-400/25', icon: <CheckCircle2 className="w-3 h-3" /> },
  RECHAZADA: { label: 'Rechazado por el banco', cls: 'text-red-400 bg-red-400/10 border-red-400/25', icon: <XCircle className="w-3 h-3" /> },
  NO_ENCONTRADA: { label: 'No encontrado', cls: 'text-red-400 bg-red-400/10 border-red-400/25', icon: <SearchX className="w-3 h-3" /> },
  REVISION: { label: 'Requiere revisión', cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25', icon: <AlertTriangle className="w-3 h-3" /> },
};

/** Lista de transacciones recibidas de la pasarela (se usa en la ficha del cliente y en Verificación de Pagos) */
export function TransaccionesPasarelaLista({ transacciones, mostrarCliente = false }: { transacciones: TransaccionPasarela[]; mostrarCliente?: boolean }) {
  if (transacciones.length === 0) return <p className="text-sm text-[#555555] text-center py-4">Aún no se han recibido pagos por la pasarela.</p>;
  return (
    <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
      {transacciones.map((t) => {
        const r = RESULTADO[t.resultado];
        return (
          <div key={t.id} className="py-3 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${r.cls}`}>{r.icon} {r.label}</span>
              <span className="text-sm text-white font-medium">{formatCOP(t.monto)}</span>
              {t.numeroCuota !== null && <span className="text-xs text-[#A0A0A0]">Cuota #{t.numeroCuota}</span>}
              {mostrarCliente && t.cliente && <span className="text-xs text-[#A0A0A0]">· {t.cliente.nombre} {t.cliente.apellido}</span>}
            </div>
            <p className="text-xs text-[#666666]">{t.mensaje}</p>
            <p className="text-[10px] text-[#555555]">{fechaHora(t.fecha)} · Ref. {t.referencia || '—'} · Transacción {t.transaccionId}</p>
          </div>
        );
      })}
    </div>
  );
}

interface PanelProps {
  clienteId: string;
  historial: HistorialPago[];
  /** Se llama después de cada transacción, para que la página recargue saldo, cuotas y estado de la moto. */
  onChanged: () => void;
}

export default function PasarelaPagosPanel({ clienteId, historial, onChanged }: PanelProps) {
  const [transacciones, setTransacciones] = useState<TransaccionPasarela[]>([]);
  const [simulacion, setSimulacion] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let activo = true;
    getTransaccionesPasarela(clienteId)
      .then((d) => { if (activo) { setTransacciones(d.transacciones); setSimulacion(d.simulacion); setLoadError(''); } })
      .catch((e) => { if (activo) setLoadError(errMsg(e)); });
    return () => { activo = false; };
  }, [clienteId, version]);

  const porPagar = historial.filter((h) => h.estado !== 'pagado');

  const simular = async (cuotaId: string, estado: 'APPROVED' | 'DECLINED') => {
    setProcesando(`${cuotaId}-${estado}`); setAviso(null);
    try {
      const t = await simularPagoPasarela(cuotaId, estado);
      setAviso({ ok: t.resultado === 'APLICADO', texto: t.mensaje });
      setVersion((v) => v + 1); onChanged();
    } catch (err) {
      setAviso({ ok: false, texto: errMsg(err) });
    } finally { setProcesando(null); }
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Pagos por pasarela</p>
        <p className="text-xs text-[#666666] mt-1">Los pagos confirmados por la pasarela se verifican y aplican automáticamente a la cuota.</p>
      </div>

      {aviso && (
        <div role="status" className={`flex items-center gap-2 p-3 rounded-xl border text-sm ${aviso.ok ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {aviso.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />} {aviso.texto}
        </div>
      )}
      {loadError && <ErrorBox message={`No se pudieron cargar los pagos por pasarela: ${loadError}`} />}

      {simulacion && porPagar.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-[#141414] p-4 space-y-3">
          <p className="text-xs text-[#A0A0A0]">Sandbox de la pasarela: simula la respuesta del banco para una cuota.</p>
          {porPagar.map((h) => (
            <div key={h.cuotaId} className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-white flex-1 min-w-0">Cuota #{h.numeroCuota} · {formatCOP(h.monto)} <span className="text-xs text-[#666666]">({h.estado === 'vencido' ? 'vencida' : 'pendiente'})</span></span>
              <button onClick={() => simular(h.cuotaId, 'APPROVED')} disabled={procesando !== null}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-green-500/30 text-xs text-green-400 hover:bg-green-500/10 disabled:opacity-60 transition">
                {procesando === `${h.cuotaId}-APPROVED` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Pago aprobado
              </button>
              <button onClick={() => simular(h.cuotaId, 'DECLINED')} disabled={procesando !== null}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-500/30 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-60 transition">
                {procesando === `${h.cuotaId}-DECLINED` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Pago rechazado
              </button>
            </div>
          ))}
        </div>
      )}

      <TransaccionesPasarelaLista transacciones={transacciones} />
    </div>
  );
}
