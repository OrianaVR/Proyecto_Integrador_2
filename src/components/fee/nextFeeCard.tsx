import { AlertTriangle, CalendarClock, CheckCircle2 } from 'lucide-react';
import type { Cuota } from '@/types';

export const formatCOP = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

/** Parsea 'YYYY-MM-DD' (o ISO) como fecha LOCAL, para que no se corra un día por la zona horaria. */
export function parseFecha(s: string) {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function diasHasta(fecha: string) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return Math.round((parseFecha(fecha).getTime() - hoy.getTime()) / 86_400_000);
}

function etiquetaVencimiento(dias: number) {
  if (dias < 0) return `Vencida hace ${-dias} ${-dias === 1 ? 'día' : 'días'}`;
  if (dias === 0) return 'Vence hoy';
  if (dias === 1) return 'Vence mañana';
  return `Vence en ${dias} días`;
}

/**
 * HU-22 Consultar próxima cuota. Se usa en el detalle del cliente (admin) y en el portal del rider.
 * Si la cuota trae desglose (montoBase / multas / excedentes) lo muestra (HU-02).
 */
export default function ProximaCuotaCard({ cuota }: { cuota: Cuota | null }) {
  if (!cuota) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5">
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-3">Próxima cuota</p>
        <div className="flex items-center gap-2 text-sm text-green-400">
          <CheckCircle2 className="w-4 h-4" /> No hay cuotas pendientes.
        </div>
      </div>
    );
  }

  const dias = diasHasta(cuota.fechaVencimiento);
  const vencida = cuota.estado === 'vencido' || dias < 0;
  const multas = cuota.montoMultas ?? 0;
  const excedentes = cuota.montoExcedentes ?? 0;
  const base = cuota.montoBase ?? cuota.monto - multas - excedentes;
  const hayDesglose = multas > 0 || excedentes > 0;

  return (
    <div className={`rounded-2xl border bg-[#1F1F1F]/60 p-5 ${vencida ? 'border-red-500/30' : 'border-white/8'}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Próxima cuota</p>
        <span className="text-xs text-[#A0A0A0]">Cuota #{cuota.numeroCuota}</span>
      </div>

      <p className="text-3xl font-black text-white">{formatCOP(cuota.monto)}</p>

      <div className={`mt-3 flex items-center gap-2 text-sm font-medium ${vencida ? 'text-red-400' : 'text-[#A0A0A0]'}`}>
        {vencida ? <AlertTriangle className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
        <span>
          {parseFecha(cuota.fechaVencimiento).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long' })}
          {' · '}
          {etiquetaVencimiento(dias)}
        </span>
      </div>

      {hayDesglose && (
        <dl className="mt-4 pt-4 border-t border-white/8 space-y-1.5 text-xs">
          <div className="flex justify-between"><dt className="text-[#666666]">Cuota base</dt><dd className="text-white">{formatCOP(base)}</dd></div>
          {multas > 0 && <div className="flex justify-between"><dt className="text-[#666666]">Multas de tránsito</dt><dd className="text-white">{formatCOP(multas)}</dd></div>}
          {excedentes > 0 && <div className="flex justify-between"><dt className="text-[#666666]">Excedentes y cargos</dt><dd className="text-white">{formatCOP(excedentes)}</dd></div>}
          <div className="flex justify-between pt-1.5 border-t border-white/8 font-semibold"><dt className="text-[#A0A0A0]">Total</dt><dd className="text-white">{formatCOP(cuota.monto)}</dd></div>
        </dl>
      )}
    </div>
  );
}