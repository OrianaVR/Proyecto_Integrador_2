'use client';

import AdminLayout from '@/components/layout/AdminLayout';
import { getConfigNotificaciones, saveConfigNotificaciones, saveProgramacion, runAutomaticCollection } from '@/services/api/endpoints';
import { getErrorMessage } from '@/services/api/client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, MessageCircle, Smartphone, Mail, CheckCircle2, AlertTriangle, Loader2, ExternalLink, CalendarClock, Send } from 'lucide-react';
import type { ConfiguracionNotificaciones, NotificationChannel } from '@/types';

// HU-04: configuración general del canal de notificación
const CANALES: { value: NotificationChannel; label: string; icon: typeof MessageCircle }[] = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'sms', label: 'SMS', icon: Smartphone },
  { value: 'email', label: 'Correo electrónico', icon: Mail },
];

const proveedorBadge: Record<string, { label: string; cls: string }> = {
  configurado: { label: 'Proveedor configurado', cls: 'text-green-400 bg-green-400/10 border-green-400/25' },
  simulado: { label: 'Modo simulado', cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/25' },
  no_configurado: { label: 'Sin proveedor', cls: 'text-red-400 bg-red-400/10 border-red-400/25' },
};

const canalLabel = (c: string) => CANALES.find(x => x.value === c)?.label ?? c;

// HU-03: día y hora del envío automático de cobros
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]; // lunes primero

function ProgramacionEnvio({ config, onGuardado, onEnviado }: {
  config: ConfiguracionNotificaciones;
  onGuardado: (c: ConfiguracionNotificaciones) => void;
  onEnviado: () => void;
}) {
  const [dia, setDia] = useState(String(config.diaSemana));
  const [hora, setHora] = useState(config.horaTexto);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setAviso(''); setError('');
    if (!hora) return setError('La hora de envío es obligatoria.');
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(hora)) return setError('La hora no es válida: usa el formato HH:MM (de 00:00 a 23:59).');
    setGuardando(true);
    try {
      const data = await saveProgramacion({ diaSemana: Number(dia), hora });
      onGuardado(data);
      setAviso(`Programación actualizada: los cobros se enviarán los ${DIAS[data.diaSemana].toLowerCase()} a las ${data.horaTexto}.`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally { setGuardando(false); }
  };

  // Envía ya los recordatorios de las cuotas que vencen hoy (para pruebas o si se necesita adelantar el envío)
  const enviarAhora = async () => {
    setAviso(''); setError(''); setEnviando(true);
    try {
      const r = await runAutomaticCollection();
      const total = Number(r.totalCuotasEvaluadas ?? 0), enviadas = Number(r.notifications ?? 0);
      setAviso(total === 0 ? 'Hoy no vence ninguna cuota: no había recordatorios por enviar.' : `Se procesaron ${total} cuota(s) que vencen hoy · ${enviadas} recordatorio(s) nuevo(s).`);
      onEnviado();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally { setEnviando(false); }
  };

  const proximo = new Date(config.proximoEnvio).toLocaleString('es-CO', { timeZone: config.zonaHoraria, weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <form onSubmit={guardar} className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5 space-y-4">
      <div>
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Programación del envío</p>
        <p className="text-xs text-[#555555] mt-1">Día y hora en que se envían automáticamente los recordatorios de las cuotas que vencen ese día (hora de Colombia).</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wide">Día de envío</span>
          <select value={dia} onChange={e => { setDia(e.target.value); setAviso(''); setError(''); }}
            className="mt-1.5 w-full px-3 py-2.5 rounded-xl bg-[#141414] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C0001A]/60">
            {ORDEN_DIAS.map(d => <option key={d} value={d}>{DIAS[d]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[#A0A0A0] uppercase tracking-wide">Hora de envío</span>
          <input type="time" value={hora} onChange={e => { setHora(e.target.value); setAviso(''); setError(''); }}
            className="mt-1.5 w-full px-3 py-2.5 rounded-xl bg-[#141414] border border-white/10 text-sm text-white focus:outline-none focus:border-[#C0001A]/60" />
        </label>
      </div>
      <p className="text-xs text-[#A0A0A0]">
        Próximo envío: <span className="text-white font-medium">{proximo}</span>
        {!config.programacionActiva && <span className="text-yellow-400"> · la programación se activa cuando el servidor está en ejecución</span>}
      </p>

      {error && (
        <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {aviso && (
        <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {aviso}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={enviarAhora} disabled={enviando}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-[#A0A0A0] hover:text-white hover:bg-white/5 disabled:opacity-60 transition">
          {enviando ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</> : <><Send className="w-4 h-4" /> Enviar recordatorios de hoy</>}
        </button>
        <button type="submit" disabled={guardando}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C0001A] text-white text-sm font-semibold hover:bg-[#a30016] disabled:opacity-60 transition">
          {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar programación'}
        </button>
      </div>
    </form>
  );
}

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<ConfiguracionNotificaciones | null>(null);
  const [porDefecto, setPorDefecto] = useState<NotificationChannel>('whatsapp');
  const [habilitados, setHabilitados] = useState<NotificationChannel[]>([]);
  const [errorCarga, setErrorCarga] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let activo = true;
    getConfigNotificaciones()
      .then(data => {
        if (!activo) return;
        setConfig(data); setPorDefecto(data.canalPorDefecto); setHabilitados(data.canalesHabilitados);
      })
      .catch(e => { if (activo) setErrorCarga(getErrorMessage(e)); });
    return () => { activo = false; };
  }, []);

  const alternar = (canal: NotificationChannel) => {
    setAviso(''); setError('');
    setHabilitados(p => p.includes(canal) ? p.filter(c => c !== canal) : [...p, canal]);
  };

  const guardar = async () => {
    setAviso(''); setError('');
    if (habilitados.length === 0) return setError('Habilita al menos un canal.');
    if (!habilitados.includes(porDefecto)) return setError('El canal por defecto debe estar habilitado.');
    setGuardando(true);
    try {
      const data = await saveConfigNotificaciones({ canalPorDefecto: porDefecto, canalesHabilitados: habilitados });
      setConfig(c => (c ? { ...c, ...data, fallidos: c.fallidos } : c));
      setAviso('Configuración guardada.');
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally { setGuardando(false); }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#C0001A]" /> Configuración
          </h1>
          <p className="text-sm text-[#666666] mt-0.5">Canales y horario de las notificaciones de cobro</p>
        </div>

        {errorCarga ? (
          <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> No se pudo cargar la configuración: {errorCarga}
          </div>
        ) : !config ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-[#C0001A]" /></div>
        ) : (
          <>
            {/* Canales */}
            <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider">Canales de notificación</p>
                <p className="text-xs text-[#555555] mt-1">Cada cliente recibe los cobros por el canal de su perfil. Si no tiene uno asignado, se usa el canal por defecto.</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {CANALES.map(({ value, label, icon: Icon }) => {
                  const activo = habilitados.includes(value);
                  const defecto = porDefecto === value;
                  const badge = proveedorBadge[config.proveedores[value]];
                  return (
                    <div key={value} className={`rounded-xl border p-4 space-y-3 transition ${defecto ? 'border-[#C0001A]/50 bg-[#C0001A]/5' : 'border-white/10 bg-[#141414]/60'}`}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${activo ? 'text-[#C0001A]' : 'text-[#555555]'}`} />
                        <p className="text-sm font-semibold text-white flex-1">{label}</p>
                      </div>
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>
                      <label className="flex items-center gap-2 text-xs text-[#A0A0A0] cursor-pointer">
                        <input type="checkbox" checked={activo} onChange={() => alternar(value)} className="accent-[#C0001A]" /> Habilitado
                      </label>
                      <label className="flex items-center gap-2 text-xs text-[#A0A0A0] cursor-pointer">
                        <input type="radio" name="por-defecto" checked={defecto} onChange={() => { setAviso(''); setError(''); setPorDefecto(value); }} className="accent-[#C0001A]" /> Canal por defecto
                      </label>
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-[#555555]">
                «Modo simulado»: no hay credenciales del proveedor en el servidor; el envío se registra pero no llega al cliente. Las credenciales se configuran en el archivo .env del backend.
              </p>

              {error && (
                <div role="alert" className="flex gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </div>
              )}
              {aviso && (
                <div role="status" className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {aviso}
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={guardar} disabled={guardando}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C0001A] text-white text-sm font-semibold hover:bg-[#a30016] disabled:opacity-60 transition">
                  {guardando ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar configuración'}
                </button>
              </div>
            </div>

            {/* Programación del envío (HU-03) */}
            <ProgramacionEnvio
              config={config}
              onGuardado={data => setConfig(c => (c ? { ...c, diaSemana: data.diaSemana, hora: data.hora, minuto: data.minuto, horaTexto: data.horaTexto, proximoEnvio: data.proximoEnvio, programacionActiva: data.programacionActiva } : c))}
              onEnviado={() => { getConfigNotificaciones().then(data => setConfig(c => (c ? { ...c, fallidos: data.fallidos } : c))).catch(() => {}); }}
            />

            {/* Envíos fallidos */}
            <div className="rounded-2xl border border-white/8 bg-[#1F1F1F]/60 p-5">
              <p className="text-xs font-semibold text-[#666666] uppercase tracking-wider mb-4">Envíos fallidos</p>
              {config.fallidos.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-green-400 py-2">
                  <CheckCircle2 className="w-4 h-4" /> No hay envíos fallidos.
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                  {config.fallidos.map(f => (
                    <div key={f.id} className="flex items-start gap-3 py-3">
                      <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">{f.titulo} · {canalLabel(f.canal)}</p>
                        <p className="text-xs text-red-400/80">{f.error}</p>
                        <p className="text-xs text-[#666666]">
                          {new Date(f.fecha).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                          {f.cliente && <> · {f.cliente.nombre} {f.cliente.apellido}</>}
                        </p>
                      </div>
                      {f.cliente && (
                        <Link href={`/admin/clientes/${f.cliente.id}`} className="inline-flex items-center gap-1 text-xs text-[#A0A0A0] hover:text-white shrink-0">
                          Ver ficha <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
