'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { CheckCircle2, User, Bike, FileText, Upload, X, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/services/api/endpoints';

const STEPS = [
  { id: 1, label: 'Datos del Cliente', icon: User },
  { id: 2, label: 'Datos de la Moto',  icon: Bike },
  { id: 3, label: 'Documentos',        icon: FileText },
];

const DOCUMENT_SLOTS = [
  { key: 'cedula',           label: 'Cédula de Ciudadanía',   accept: 'image/*,.pdf' },
  { key: 'contrato_firmado', label: 'Contrato Firmado (PDF)',  accept: '.pdf' },
  { key: 'soat',             label: 'SOAT',                   accept: 'image/*,.pdf' },
  { key: 'tecnomecanica',    label: 'Tecnomecánica',          accept: 'image/*,.pdf' },
  { key: 'tarjeta_propiedad',label: 'Tarjeta de Propiedad',   accept: 'image/*,.pdf' },
  { key: 'licencia',         label: 'Licencia de Conducción', accept: 'image/*,.pdf' },
];

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full px-4 py-2.5 rounded-xl bg-[#141414]/80 border border-white/10 text-white placeholder-[#555555] text-sm focus:outline-none focus:border-[#C0001A]/50 focus:ring-1 focus:ring-[#C0001A]/20 transition';
const selectCls = inputCls + ' cursor-pointer';

function DropZoneSlot({ slotKey, label, accept }: { slotKey: string; label: string; accept: string }) {
  const [file, setFile] = useState<File | null>(null);
  const onDrop = useCallback((f: File[]) => { if (f[0]) setFile(f[0]); }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: accept.split(',').reduce((a, v) => ({ ...a, [v]: [] }), {}), maxFiles: 1 });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#A0A0A0]">{label}</p>
      {file ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <span className="text-xs text-green-400 flex-1 truncate">{file.name}</span>
          <button onClick={() => setFile(null)} className="text-[#555555] hover:text-red-400 transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div {...getRootProps()} className={`flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${isDragActive ? 'border-[#C0001A]/60 bg-[#C0001A]/5' : 'border-white/10 hover:border-[#C0001A]/30 hover:bg-white/3'}`}>
          <input {...getInputProps()} />
          <Upload className={`w-5 h-5 ${isDragActive ? 'text-[#C0001A]' : 'text-[#555555]'}`} />
          <p className="text-[10px] text-[#555555] text-center">
            {isDragActive ? 'Suelta aquí' : 'Arrastra o haz clic para subir'}
          </p>
        </div>
      )}
    </div>
  );
}

export default function NuevoClientePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [done, setDone]   = useState(false);

  const [cliente, setCliente] = useState({ nombre: '', apellido: '', email: '', telefono: '', documentoId: '', ciudad: '', plataforma: 'rappi' });
  const [moto, setMoto]       = useState({ marca: '', modelo: '', año: '', placa: '', numeroSerie: '', color: '', montoSemanal: '', cuotasTotales: '18', fechaInicio: '', fechaFin: '' });

  const setC = (k: string, v: string) => setCliente(p => ({ ...p, [k]: v }));
  const setM = (k: string, v: string) => setMoto(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await createClient({ ...cliente, ...moto, año: Number(moto.año), montoSemanal: Number(moto.montoSemanal), cuotasTotales: Number(moto.cuotasTotales) });
      setDone(true);
    } catch (e: any) {
      alert(e.response?.data?.error || e.message || 'No se pudo registrar el cliente');
    } finally { setSaving(false); }
    setTimeout(() => router.push('/admin/dashboard'), 1500);
  };

  if (done) return (
    <AdminLayout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white">¡Cliente registrado exitosamente!</h2>
          <p className="text-sm text-[#666666]">Redirigiendo al dashboard…</p>
        </div>
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Nuevo Cliente</h1>
          <p className="text-sm text-[#666666]">Registra el cliente, su motocicleta y los documentos firmados</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 transition-all ${step > s.id ? 'bg-[#C0001A] border-[#C0001A]' : step === s.id ? 'border-[#C0001A] bg-[#C0001A]/15' : 'border-white/15 bg-transparent'}`}>
                  {step > s.id ? <CheckCircle2 className="w-4 h-4 text-white" /> : <s.icon className={`w-3.5 h-3.5 ${step === s.id ? 'text-[#C0001A]' : 'text-[#555555]'}`} />}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${step === s.id ? 'text-white' : 'text-[#555555]'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${step > s.id ? 'bg-[#C0001A]/40' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/50 p-6 space-y-5">

          {/* STEP 1 */}
          {step === 1 && (
            <>
              <h2 className="text-base font-semibold text-white flex items-center gap-2"><User className="w-4 h-4 text-[#C0001A]" /> Datos del Cliente</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Nombre" id="nombre"><input id="nombre" value={cliente.nombre} onChange={e => setC('nombre', e.target.value)} placeholder="Andrés" className={inputCls} /></Field>
                <Field label="Apellido" id="apellido"><input id="apellido" value={cliente.apellido} onChange={e => setC('apellido', e.target.value)} placeholder="Martínez" className={inputCls} /></Field>
                <Field label="Email" id="email"><input id="email" type="email" value={cliente.email} onChange={e => setC('email', e.target.value)} placeholder="andres@gmail.com" className={inputCls} /></Field>
                <Field label="Teléfono" id="tel"><input id="tel" value={cliente.telefono} onChange={e => setC('telefono', e.target.value)} placeholder="3104567890" className={inputCls} /></Field>
                <Field label="Cédula" id="doc"><input id="doc" value={cliente.documentoId} onChange={e => setC('documentoId', e.target.value)} placeholder="1020345678" className={inputCls} /></Field>
                <Field label="Ciudad" id="ciudad"><input id="ciudad" value={cliente.ciudad} onChange={e => setC('ciudad', e.target.value)} placeholder="Bogotá" className={inputCls} /></Field>
                <Field label="Plataforma" id="plat">
                  <select id="plat" value={cliente.plataforma} onChange={e => setC('plataforma', e.target.value)} className={selectCls}>
                    <option value="rappi">Rappi</option>
                    <option value="didi">DiDi</option>
                    <option value="uber_eats">Uber Eats</option>
                    <option value="otra">Otra</option>
                  </select>
                </Field>
              </div>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <h2 className="text-base font-semibold text-white flex items-center gap-2"><Bike className="w-4 h-4 text-[#C0001A]" /> Datos de la Motocicleta</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Marca" id="marca"><input id="marca" value={moto.marca} onChange={e => setM('marca', e.target.value)} placeholder="Honda" className={inputCls} /></Field>
                <Field label="Modelo" id="modelo"><input id="modelo" value={moto.modelo} onChange={e => setM('modelo', e.target.value)} placeholder="CB190R" className={inputCls} /></Field>
                <Field label="Año" id="año"><input id="año" type="number" value={moto.año} onChange={e => setM('año', e.target.value)} placeholder="2023" className={inputCls} /></Field>
                <Field label="Placa" id="placa"><input id="placa" value={moto.placa} onChange={e => setM('placa', e.target.value.toUpperCase())} placeholder="ABC123" className={`${inputCls} uppercase`} /></Field>
                <Field label="N° de Serie" id="serie"><input id="serie" value={moto.numeroSerie} onChange={e => setM('numeroSerie', e.target.value)} placeholder="HND2023001" className={inputCls} /></Field>
                <Field label="Color" id="color"><input id="color" value={moto.color} onChange={e => setM('color', e.target.value)} placeholder="Rojo" className={inputCls} /></Field>
                <Field label="Cuota Semanal (COP)" id="cuota"><input id="cuota" type="number" value={moto.montoSemanal} onChange={e => setM('montoSemanal', e.target.value)} placeholder="180000" className={inputCls} /></Field>
                <Field label="N° Cuotas" id="ncuotas"><input id="ncuotas" type="number" value={moto.cuotasTotales} onChange={e => setM('cuotasTotales', e.target.value)} className={inputCls} /></Field>
                <Field label="Fecha Inicio" id="fi"><input id="fi" type="date" value={moto.fechaInicio} onChange={e => setM('fechaInicio', e.target.value)} className={inputCls} /></Field>
                <Field label="Fecha Fin" id="ff"><input id="ff" type="date" value={moto.fechaFin} onChange={e => setM('fechaFin', e.target.value)} className={inputCls} /></Field>
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <h2 className="text-base font-semibold text-white flex items-center gap-2"><FileText className="w-4 h-4 text-[#C0001A]" /> Documentos Físicos Firmados</h2>
              <p className="text-xs text-[#666666]">Sube los documentos digitalizados. Formatos aceptados: PDF, JPG, PNG.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {DOCUMENT_SLOTS.map(slot => (
                  <DropZoneSlot key={slot.key} slotKey={slot.key} label={slot.label} accept={slot.accept} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : router.push('/admin/dashboard')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-[#A0A0A0] hover:bg-white/5 hover:text-white transition">
            <ChevronLeft className="w-4 h-4" /> {step === 1 ? 'Cancelar' : 'Anterior'}
          </button>

          {step < 3 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C0001A] hover:bg-[#8A0012] text-white font-semibold text-sm transition racing-glow">
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C0001A] hover:bg-[#8A0012] disabled:opacity-60 text-white font-semibold text-sm transition racing-glow">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : <><CheckCircle2 className="w-4 h-4" /> Registrar Cliente</>}
            </button>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
