'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { getPagosPendientes, aprobarPago, rechazarPago } from '@/services/api/endpoints';
import { getErrorMessage } from '@/services/api/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, CheckCircle2, XCircle, Loader2, FileText, AlertTriangle, Clock, ExternalLink } from 'lucide-react';
import type { PagoPendiente } from '@/types';

// HU-15 Verificación de pagos: el admin revisa cada pago registrado y lo aprueba o lo rechaza.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').replace(/\/api\/?$/, '');

const formatCOP = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

const metodoLabel: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', nequi: 'Nequi', daviplata: 'Daviplata', tarjeta: 'Tarjeta',
};

export default function VerificacionPagosPage() {
  const [pagos, setPagos] = useState<PagoPendiente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [razon, setRazon] = useState('');
  const [aviso, setAviso] = useState('');
  const [aprobados, setAprobados] = useState(0);
  const [rechazados, setRechazados] = useState(0);

  useEffect(() => {
    let activo = true;
    getPagosPendientes()
      .then(data => { if (activo) setPagos(data); })
      .catch(error => { if (activo) setErrorCarga(getErrorMessage(error)); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  const quitar = (id: string) => setPagos(p => p.filter(x => x.id !== id));

  const handleAprobar = async (pago: PagoPendiente) => {
    setProcesando(pago.id); setAviso('');
    try {
      await aprobarPago(pago.id);
      quitar(pago.id);
      setAprobados(n => n + 1);
      setAviso(`Pago de ${formatCOP(pago.monto)} aprobado${pago.cliente ? ` (${pago.cliente.nombre} ${pago.cliente.apellido})` : ''}. Si la moto estaba apagada, se encendió automáticamente.`);
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    } finally { setProcesando(null); }
  };

  const handleRechazar = async (pago: PagoPendiente) => {
    if (!razon.trim()) { alert('Escribe la razón del rechazo.'); return; }
    setProcesando(pago.id); setAviso('');
    try {
      await rechazarPago(pago.id, razon.trim());
      quitar(pago.id);
      setRechazados(n => n + 1);
      setRechazando(null); setRazon('');
      setAviso(`Pago de ${formatCOP(pago.monto)} rechazado. La cuota volvió a quedar pendiente.`);
    } catch (error: unknown) {
      alert(getErrorMessage(error));
    } finally { setProcesando(null); }
  };

  const total = pagos.reduce((s, p) => s + p.monto, 0);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#C0001A]" /> Verificación de Pagos
          </h1>
          <p className="text-sm text-[#666666] mt-0.5">Revisa los pagos registrados y apruébalos o recházalos según su comprobante</p>
        </div>

        {/* Summary chips */}
        <div className="flex gap-3 flex-wrap text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">{pagos.length} por verificar · {formatCOP(total)}</span>
          {aprobados > 0 && <span className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">{aprobados} aprobados</span>}
          {rechazados > 0 && <span className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">{rechazados} rechazados</span>}
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
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> No se pudieron cargar los pagos: {errorCarga}
          </div>
        ) : pagos.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-12 flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-400" />
            <p className="text-white font-semibold">¡Todo al día!</p>
            <p className="text-sm text-[#666666]">No hay pagos pendientes de verificación.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pagos.map(pago => {
              const ocupado = procesando === pago.id;
              const { cliente, motocicleta: moto, cuota } = pago;
              return (
                <div key={pago.id} className="rounded-2xl border border-yellow-500/20 bg-[#1F1F1F]/60 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    {/* Info */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-bold text-yellow-400 bg-yellow-400/10 border-yellow-400/25">
                          <Clock className="w-3 h-3" /> Pendiente
                        </span>
                        <span className="text-xs text-[#A0A0A0] border border-white/10 px-2.5 py-0.5 rounded-full">
                          {metodoLabel[pago.metodoPago] ?? pago.metodoPago}
                        </span>
                        {cuota && (
                          <span className="text-xs text-[#A0A0A0] border border-white/10 px-2.5 py-0.5 rounded-full">
                            Cuota #{cuota.numeroCuota}
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
                          <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-0.5">Monto</p>
                          <p className="text-white font-bold text-sm">{formatCOP(pago.monto)}</p>
                          {cuota && cuota.monto !== pago.monto && (
                            <p className="text-[10px] text-yellow-400">Cuota: {formatCOP(cuota.monto)}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[9px] text-[#555555] uppercase tracking-wider mb-0.5">Registrado</p>
                          <p className="text-[#A0A0A0]">{fechaHora(pago.fechaPago)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#666666]">
                        {pago.referencia && <span>Ref. {pago.referencia}</span>}
                        {pago.notas && <span>· {pago.notas}</span>}
                        {pago.comprobante ? (
                          <a href={`${API_ORIGIN}${pago.comprobante}`} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[#A0A0A0] hover:text-white">
                            <FileText className="w-3.5 h-3.5" /> Ver comprobante
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-yellow-400">
                            <AlertTriangle className="w-3.5 h-3.5" /> Sin comprobante
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acciones */}
                    {rechazando !== pago.id && (
                      <div className="flex sm:flex-col gap-2 shrink-0">
                        <button onClick={() => handleAprobar(pago)} disabled={ocupado}
                          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all border-green-500/50 bg-green-500/15 text-green-400 hover:bg-green-500/25 disabled:opacity-60">
                          {ocupado ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : <><CheckCircle2 className="w-4 h-4" /> Aprobar</>}
                        </button>
                        <button onClick={() => { setRechazando(pago.id); setRazon(''); }} disabled={ocupado}
                          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition-all border-red-500/50 bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-60">
                          <XCircle className="w-4 h-4" /> Rechazar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Razón del rechazo */}
                  {rechazando === pago.id && (
                    <div className="pt-4 border-t border-white/8 space-y-3">
                      <label className="block">
                        <span className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wide">Razón del rechazo</span>
                        <textarea value={razon} onChange={e => setRazon(e.target.value)} rows={2} autoFocus
                          placeholder="Ej.: el comprobante no corresponde al monto"
                          className="mt-1.5 w-full px-3 py-2.5 rounded-xl bg-[#141414] border border-white/10 text-sm text-white placeholder:text-[#555555] focus:outline-none focus:border-[#C0001A]/60" />
                      </label>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setRechazando(null); setRazon(''); }} disabled={ocupado}
                          className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-[#A0A0A0] hover:text-white hover:bg-white/5 transition">
                          Cancelar
                        </button>
                        <button onClick={() => handleRechazar(pago)} disabled={ocupado}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#C0001A] text-white text-sm font-semibold hover:bg-[#a30016] disabled:opacity-60 transition">
                          {ocupado ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : 'Confirmar rechazo'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
