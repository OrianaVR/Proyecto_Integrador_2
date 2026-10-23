'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, Plus, Receipt, X } from 'lucide-react';
import { createCuota, createPago, getCuotasByContrato, getPagosByCliente } from '@/services/api/endpoints';
import ProximaCuotaCard, { formatCOP, parseFecha } from './nextFeeCard';
import type { Contrato, Cuota, Pago } from '@/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').replace(/\/api\/?$/, '');
const TIPOS_COMPROBANTE = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_COMPROBANTE = 5 * 1024 * 1024; // mismo límite que el backend (5 MB)

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-[#141414] border border-white/10 text-sm text-white placeholder:text-[#555555] focus:outline-none focus:border-[#C0001A]/60';
const btnPrimary = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#C0001A] text-white text-sm font-semibold hover:bg-[#a30016] disabled:opacity-60 transition';
const btnGhost = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-[#A0A0A0] hover:text-white hover:bg-white/5 transition';

function errMsg(e: unknown) {
  const x = e as { response?: { data?: { error?: string } }; message?: string };
  return x.response?.data?.error || x.message || 'Ocurrió un error inesperado';
}

const num = (v: string) => (v.trim() === '' ? 0 : Number(v));

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** El cobro de los riders es los miércoles: se propone el siguiente miércoles como vencimiento. */
function proximoMiercoles() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const diff = (3 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wide">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="block mt-1 text-[11px] text-[#666666]">{hint}</span>}
    </label>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{message}</span>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#1F1F1F] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-lg text-[#666666] hover:text-white hover:bg-white/8 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── HU-09 Registrar cuota semanal  +  HU-10/11/12 total semanal ──────────────
function RegistrarCuotaForm({ contrato, cuotas, onDone, onCancel }: {
  contrato: Contrato; cuotas: Cuota[]; onDone: (c: Cuota) => void; onCancel: () => void;
}) {
  const siguiente = cuotas.reduce((m, c) => Math.max(m, c.numeroCuota), 0) + 1;
  const [numero, setNumero] = useState(String(siguiente));
  const [base, setBase] = useState(String(contrato.montoSemanal));
  const [multas, setMultas] = useState('');
  const [excedentes, setExcedentes] = useState('');
  const [fecha, setFecha] = useState(proximoMiercoles());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // HU-12: total semanal = cuota base + multas + excedentes
  const total = num(base) + num(multas) + num(excedentes);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(numero);
    if (!Number.isInteger(n) || n < 1) return setError('El número de cuota debe ser un entero mayor a 0.');
    if (cuotas.some((c) => c.numeroCuota === n)) return setError(`Ya existe la cuota #${n} para este contrato.`);
    if (!(num(base) > 0)) return setError('La cuota base debe ser mayor a 0.');
    if (!(num(multas) >= 0) || !(num(excedentes) >= 0)) return setError('Multas y excedentes no pueden ser negativos.');
    if (!fecha) return setError('Indica la fecha de vencimiento.');

    setSaving(true); setError('');
    try {
      const cuota = await createCuota({
        contratoId: contrato.id, numeroCuota: n, monto: total, fechaVencimiento: fecha,
        montoBase: num(base), multas: num(multas), excedentes: num(excedentes),
      });
      onDone(cuota);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="N° de cuota">
          <input type="number" min={1} value={numero} onChange={(e) => setNumero(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Vence" hint="Se cobra los miércoles">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <Field label="Cuota base (COP)">
        <input type="number" min={0} value={base} onChange={(e) => setBase(e.target.value)} className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Multas de tránsito (COP)">
          <input type="number" min={0} value={multas} onChange={(e) => setMultas(e.target.value)} placeholder="0" className={inputCls} />
        </Field>
        <Field label="Excedentes / cargos (COP)">
          <input type="number" min={0} value={excedentes} onChange={(e) => setExcedentes(e.target.value)} placeholder="0" className={inputCls} />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-[#141414] border border-white/8 px-4 py-3">
        <span className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wide">Total semanal a cobrar</span>
        <span className="text-xl font-black text-white">{formatCOP(total)}</span>
      </div>

      {error && <ErrorBox message={error} />}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={btnGhost}>Cancelar</button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Registrar cuota'}
        </button>
      </div>
    </form>
  );
}

// ─── HU-13 Registrar pago con comprobante · HU-15 confirmar · HU-16 fecha y hora ──
const METODOS: { value: Pago['metodoPago']; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'nequi', label: 'Nequi' },
  { value: 'daviplata', label: 'Daviplata' },
  { value: 'tarjeta', label: 'Tarjeta' },
];

function RegistrarPagoForm({ contrato, cuotas, proximaCuota, onDone, onClose }: {
  contrato: Contrato; cuotas: Cuota[]; proximaCuota: Cuota | null; onDone: (p: Pago) => void; onClose: () => void;
}) {
  const pendientes = cuotas.filter((c) => c.estado !== 'pagado').sort((a, b) => a.numeroCuota - b.numeroCuota);
  const inicial = pendientes.find((c) => c.id === proximaCuota?.id) ?? pendientes[0];

  const [cuotaId, setCuotaId] = useState(inicial?.id ?? '');
  const [monto, setMonto] = useState(inicial ? String(inicial.monto) : '');
  const [metodo, setMetodo] = useState<Pago['metodoPago']>('transferencia');
  const [referencia, setReferencia] = useState('');
  const [notas, setNotas] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pago, setPago] = useState<Pago | null>(null);

  const cuota = pendientes.find((c) => c.id === cuotaId);
  const difiere = cuota !== undefined && num(monto) !== cuota.monto;

  const elegirCuota = (id: string) => {
    setCuotaId(id);
    const c = pendientes.find((x) => x.id === id);
    if (c) setMonto(String(c.monto));
  };

  const elegirArchivo = (f: File | null) => {
    setError('');
    if (f && !TIPOS_COMPROBANTE.includes(f.type)) { setArchivo(null); return setError('El comprobante debe ser PDF, JPG o PNG.'); }
    if (f && f.size > MAX_COMPROBANTE) { setArchivo(null); return setError('El comprobante no puede superar los 5 MB.'); }
    setArchivo(f);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cuota) return setError('Selecciona la cuota que se está pagando.');
    if (!(num(monto) > 0)) return setError('El monto debe ser mayor a 0.');

    const form = new FormData();
    form.append('contratoId', contrato.id);
    form.append('cuotaId', cuota.id);
    form.append('monto', String(num(monto)));
    form.append('metodoPago', metodo);
    if (referencia.trim()) form.append('referencia', referencia.trim());
    if (notas.trim()) form.append('notas', notas.trim());
    if (archivo) form.append('comprobante', archivo);

    setSaving(true); setError('');
    try {
      const creado = await createPago(form);
      setPago(creado);
      onDone(creado);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  // Confirmación visible del pago, con fecha y hora (HU-16)
  if (pago) {
    return (
      <div className="space-y-4 text-center py-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <p className="text-white font-bold">Pago registrado</p>
          <p className="text-sm text-[#A0A0A0] mt-1">{formatCOP(pago.monto)} · cuota #{cuota?.numeroCuota}</p>
          <p className="text-xs text-[#666666] mt-1">Registrado el {fechaHora(pago.fechaPago)}</p>
        </div>
        <button onClick={onClose} className={btnPrimary}>Listo</button>
      </div>
    );
  }

  if (pendientes.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[#A0A0A0]">No hay cuotas pendientes por pagar. Registra una cuota primero.</p>
        <div className="flex justify-end"><button onClick={onClose} className={btnGhost}>Cerrar</button></div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Cuota a pagar">
        <select value={cuotaId} onChange={(e) => elegirCuota(e.target.value)} className={inputCls}>
          {pendientes.map((c) => (
            <option key={c.id} value={c.id}>
              #{c.numeroCuota} · {formatCOP(c.monto)} · vence {parseFecha(c.fechaVencimiento).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
              {c.estado === 'vencido' ? ' (vencida)' : ''}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Monto (COP)">
          <input type="number" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Método de pago">
          <select value={metodo} onChange={(e) => setMetodo(e.target.value as Pago['metodoPago'])} className={inputCls}>
            {METODOS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </Field>
      </div>

      {difiere && (
        <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-xl px-3 py-2">
          El monto no coincide con la cuota ({formatCOP(cuota.monto)}). Al confirmar, la cuota se marcará como pagada.
        </p>
      )}

      <Field label="Referencia (opcional)">
        <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="N° de transacción" className={inputCls} />
      </Field>

      <Field label="Comprobante (opcional)" hint="PDF, JPG o PNG · máx. 5 MB">
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
          className="block w-full text-xs text-[#A0A0A0] file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-white/8 file:text-white file:text-xs hover:file:bg-white/12" />
      </Field>

      <Field label="Notas (opcional)">
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={inputCls} />
      </Field>

      {error && <ErrorBox message={error} />}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={btnGhost}>Cancelar</button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando…</> : 'Confirmar pago'}
        </button>
      </div>
    </form>
  );
}

// ─── Panel principal ─────────────────────────────────────────────────────────
interface PanelProps {
  clienteId: string;
  contrato: Contrato;
  proximaCuota: Cuota | null;
  /** Se llama después de registrar una cuota o un pago, para que la página recargue el detalle del cliente. */
  onChanged: () => void;
}

export default function CuotasPagosPanel({ clienteId, contrato, proximaCuota, onChanged }: PanelProps) {
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [modal, setModal] = useState<null | 'cuota' | 'pago'>(null);
  const [aviso, setAviso] = useState('');
  const [loadError, setLoadError] = useState('');

  // `version` sube cada vez que hay que volver a leer cuotas y pagos (después de registrar algo)
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    let activo = true; // evita actualizar el estado si el componente se desmontó mientras llegaba la respuesta
    Promise.all([getCuotasByContrato(contrato.id), getPagosByCliente(clienteId)])
      .then(([c, p]) => {
        if (!activo) return;
        setCuotas(c);
        setPagos([...p].sort((a, b) => b.fechaPago.localeCompare(a.fechaPago)));
        setLoadError('');
      })
      .catch((e) => { if (activo) setLoadError(errMsg(e)); });
    return () => { activo = false; };
  }, [contrato.id, clienteId, version]);

  const cuotaDe = (id?: string) => cuotas.find((c) => c.id === id);

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <ProximaCuotaCard cuota={proximaCuota} />
        <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5 flex flex-col gap-3">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Gestión de cobro</p>
          <button onClick={() => { setAviso(''); setModal('cuota'); }} className={btnGhost}>
            <Plus className="w-4 h-4" /> Registrar cuota semanal
          </button>
          <button onClick={() => { setAviso(''); setModal('pago'); }} className={btnPrimary}>
            <Receipt className="w-4 h-4" /> Registrar pago
          </button>
        </div>
      </div>

      {aviso && (
        <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {aviso}
        </div>
      )}
      {loadError && <ErrorBox message={`No se pudo cargar cuotas y pagos: ${loadError}`} />}

      <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5">
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-4">Pagos registrados</p>
        {pagos.length === 0 ? (
          <p className="text-sm text-[#555555] text-center py-6">Aún no hay pagos registrados.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
            {pagos.map((p) => {
              const c = cuotaDe(p.cuotaId);
              return (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium">{formatCOP(p.monto)}{c ? ` · cuota #${c.numeroCuota}` : ''}</p>
                    <p className="text-xs text-[#666666]">
                      {fechaHora(p.fechaPago)} · <span className="capitalize">{p.metodoPago}</span>
                      {p.referencia ? ` · ref. ${p.referencia}` : ''}
                    </p>
                  </div>
                  {p.comprobante && (
                    <a href={`${API_ORIGIN}${p.comprobante}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-[#A0A0A0] hover:text-white">
                      <FileText className="w-3.5 h-3.5" /> Comprobante
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal === 'cuota' && (
        <Modal title="Registrar cuota semanal" onClose={() => setModal(null)}>
          <RegistrarCuotaForm contrato={contrato} cuotas={cuotas} onCancel={() => setModal(null)}
            onDone={(c) => { setModal(null); setAviso(`Cuota #${c.numeroCuota} registrada por ${formatCOP(c.monto)}.`); recargar(); onChanged(); }} />
        </Modal>
      )}
      {modal === 'pago' && (
        <Modal title="Registrar pago" onClose={() => setModal(null)}>
          <RegistrarPagoForm contrato={contrato} cuotas={cuotas} proximaCuota={proximaCuota} onClose={() => setModal(null)}
            onDone={() => { recargar(); onChanged(); }} />
        </Modal>
      )}
    </div>
  );
}