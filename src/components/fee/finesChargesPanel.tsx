'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Plus, ReceiptText, Siren } from 'lucide-react';
import { createCargo, createMulta, getCargosByCliente, getMultasByCliente, pagarCargo, pagarMulta } from '@/services/api/endpoints';
import { btnGhost, btnPrimary, ErrorBox, errMsg, Field, inputCls, Modal, num } from './feePaymentPage';
import { formatCOP, parseFecha } from './nextFeeCard';
import type { CargoAdicional, Contrato, Multa } from '@/types';

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Conceptos frecuentes de HU-11 (el admin puede escribir otro) */
const CONCEPTOS = ['Excedente de kilometraje', 'Daño a la motocicleta', 'Reposición de casco', 'Mantenimiento no cubierto', 'Gastos de patio y grúa'];

// ─── HU-10 Registrar multa de tránsito ───────────────────────────────────────
function RegistrarMultaForm({ clienteId, contrato, onDone, onCancel }: {
  clienteId: string; contrato: Contrato; onDone: (m: Multa) => void; onCancel: () => void;
}) {
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(num(monto) > 0)) return setError('El monto debe ser mayor a 0.');
    if (!descripcion.trim()) return setError('Describe la multa (infracción, número de comparendo, etc.).');
    if (!fecha) return setError('Indica la fecha de la multa.');
    setSaving(true); setError('');
    try {
      onDone(await createMulta({ clienteId, contratoId: contrato.id, monto: num(monto), descripcion: descripcion.trim(), fecha }));
    } catch (err) {
      setError(errMsg(err));
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Descripción" hint="Ej.: Fotomulta por exceso de velocidad · comparendo 123456">
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Infracción y número de comparendo" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Monto (COP)">
          <input type="number" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" className={inputCls} />
        </Field>
        <Field label="Fecha de la multa">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        </Field>
      </div>
      <p className="text-xs text-[#666666]">La multa se suma al saldo pendiente del contrato.</p>
      {error && <ErrorBox message={error} />}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={btnGhost}>Cancelar</button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Registrar multa'}
        </button>
      </div>
    </form>
  );
}

// ─── HU-11 Registrar excedente o cargo adicional ─────────────────────────────
function RegistrarCargoForm({ clienteId, contrato, onDone, onCancel }: {
  clienteId: string; contrato: Contrato; onDone: (c: CargoAdicional) => void; onCancel: () => void;
}) {
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!concepto.trim()) return setError('Indica el concepto del cargo.');
    if (!(num(monto) > 0)) return setError('El monto debe ser mayor a 0.');
    setSaving(true); setError('');
    try {
      onDone(await createCargo({ clienteId, contratoId: contrato.id, concepto: concepto.trim(), monto: num(monto) }));
    } catch (err) {
      setError(errMsg(err));
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Concepto" hint="Elige uno frecuente o escribe otro">
        <input list="conceptos-cargo" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej.: Excedente de kilometraje" className={inputCls} />
        <datalist id="conceptos-cargo">
          {CONCEPTOS.map((c) => <option key={c} value={c} />)}
        </datalist>
      </Field>
      <Field label="Monto (COP)">
        <input type="number" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" className={inputCls} />
      </Field>
      <p className="text-xs text-[#666666]">El cargo se suma al saldo pendiente del contrato.</p>
      {error && <ErrorBox message={error} />}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={btnGhost}>Cancelar</button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Registrar cargo'}
        </button>
      </div>
    </form>
  );
}

// ─── Lista de multas o cargos ────────────────────────────────────────────────
interface Item { id: string; titulo: string; detalle: string; monto: number; pagada: boolean }

function ListaCobros({ titulo, icono, items, vacio, procesando, onAgregar, onPagar, textoAgregar }: {
  titulo: string; icono: React.ReactNode; items: Item[]; vacio: string; procesando: string | null;
  onAgregar: () => void; onPagar: (id: string) => void; textoAgregar: string;
}) {
  const pendiente = items.filter((i) => !i.pagada).reduce((s, i) => s + i.monto, 0);
  return (
    <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider flex items-center gap-1.5">{icono} {titulo}</p>
          <p className={`text-lg font-bold mt-1 ${pendiente > 0 ? 'text-[#C0001A]' : 'text-white'}`}>{formatCOP(pendiente)} <span className="text-xs font-normal text-[#666666]">pendiente</span></p>
        </div>
        <button onClick={onAgregar} className={btnGhost}><Plus className="w-4 h-4" /> {textoAgregar}</button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[#555555] text-center py-4">{vacio}</p>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 py-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${i.pagada ? 'bg-green-500/15' : 'bg-yellow-500/15'}`}>
                {i.pagada ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Clock className="w-4 h-4 text-yellow-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{i.titulo}</p>
                <p className="text-xs text-[#666666]">{formatCOP(i.monto)} · {i.detalle}</p>
              </div>
              {i.pagada ? (
                <span className="text-[10px] font-semibold text-green-400">Pagada</span>
              ) : (
                <button onClick={() => onPagar(i.id)} disabled={procesando === i.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-xs text-[#A0A0A0] hover:text-white hover:bg-white/5 disabled:opacity-60 transition">
                  {procesando === i.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Marcar pagada
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel principal ─────────────────────────────────────────────────────────
interface PanelProps {
  clienteId: string;
  contrato: Contrato;
  /** Se llama después de registrar o pagar, para que la página recargue el saldo del cliente. */
  onChanged: () => void;
}

export default function MultasCargosPanel({ clienteId, contrato, onChanged }: PanelProps) {
  const [multas, setMultas] = useState<Multa[]>([]);
  const [cargos, setCargos] = useState<CargoAdicional[]>([]);
  const [modal, setModal] = useState<null | 'multa' | 'cargo'>(null);
  const [aviso, setAviso] = useState('');
  const [loadError, setLoadError] = useState('');
  const [procesando, setProcesando] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    let activo = true;
    Promise.all([getMultasByCliente(clienteId), getCargosByCliente(clienteId)])
      .then(([m, c]) => {
        if (!activo) return;
        setMultas([...m].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)));
        setCargos([...c].sort((a, b) => b.creadoEn.localeCompare(a.creadoEn)));
        setLoadError('');
      })
      .catch((e) => { if (activo) setLoadError(errMsg(e)); });
    return () => { activo = false; };
  }, [clienteId, version]);

  const pagar = async (fn: (id: string) => Promise<unknown>, id: string, mensaje: string) => {
    setProcesando(id); setAviso('');
    try {
      await fn(id);
      setAviso(mensaje);
      recargar(); onChanged();
    } catch (err) {
      alert(errMsg(err));
    } finally { setProcesando(null); }
  };

  return (
    <div className="space-y-4">
      {aviso && (
        <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {aviso}
        </div>
      )}
      {loadError && <ErrorBox message={`No se pudieron cargar multas y cargos: ${loadError}`} />}

      <div className="grid sm:grid-cols-2 gap-4">
        <ListaCobros
          titulo="Multas de tránsito" icono={<Siren className="w-3.5 h-3.5" />} textoAgregar="Registrar multa"
          vacio="Sin multas registradas." procesando={procesando}
          items={multas.map((m) => ({ id: m.id, titulo: m.descripcion || 'Multa de tránsito', detalle: parseFecha(m.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }), monto: m.monto, pagada: m.pagada }))}
          onAgregar={() => { setAviso(''); setModal('multa'); }}
          onPagar={(id) => pagar(pagarMulta, id, 'Multa marcada como pagada.')}
        />
        <ListaCobros
          titulo="Excedentes y cargos" icono={<ReceiptText className="w-3.5 h-3.5" />} textoAgregar="Registrar cargo"
          vacio="Sin cargos adicionales." procesando={procesando}
          items={cargos.map((c) => ({ id: c.id, titulo: c.concepto, detalle: new Date(c.creadoEn).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }), monto: c.monto, pagada: c.pagada }))}
          onAgregar={() => { setAviso(''); setModal('cargo'); }}
          onPagar={(id) => pagar(pagarCargo, id, 'Cargo marcado como pagado.')}
        />
      </div>

      {modal === 'multa' && (
        <Modal title="Registrar multa de tránsito" onClose={() => setModal(null)}>
          <RegistrarMultaForm clienteId={clienteId} contrato={contrato} onCancel={() => setModal(null)}
            onDone={(m) => { setModal(null); setAviso(`Multa de ${formatCOP(m.monto)} registrada.`); recargar(); onChanged(); }} />
        </Modal>
      )}
      {modal === 'cargo' && (
        <Modal title="Registrar excedente o cargo adicional" onClose={() => setModal(null)}>
          <RegistrarCargoForm clienteId={clienteId} contrato={contrato} onCancel={() => setModal(null)}
            onDone={(c) => { setModal(null); setAviso(`Cargo "${c.concepto}" de ${formatCOP(c.monto)} registrado.`); recargar(); onChanged(); }} />
        </Modal>
      )}
    </div>
  );
}
