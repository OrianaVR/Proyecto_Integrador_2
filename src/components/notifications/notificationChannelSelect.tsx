'use client';

import { useState } from 'react';
import { BellRing, CheckCircle2, Loader2 } from 'lucide-react';
import { updateCanalCliente } from '@/services/api/endpoints';
import { getErrorMessage } from '@/services/api/client';
import type { NotificationChannel } from '@/types';

/** HU-04: el administrador elige por qué canal se le envían las notificaciones de cobro a este cliente. */
export default function CanalNotificacionSelect({ clienteId, canal }: { clienteId: string; canal?: NotificationChannel | null }) {
  const [valor, setValor] = useState<string>(canal ?? '');
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);

  const cambiar = async (nuevo: string) => {
    const anterior = valor;
    setValor(nuevo); setGuardando(true); setGuardado(false);
    try {
      await updateCanalCliente(clienteId, (nuevo || null) as NotificationChannel | null);
      setGuardado(true);
    } catch (error: unknown) {
      setValor(anterior);
      alert(getErrorMessage(error, 'No se pudo actualizar el canal'));
    } finally { setGuardando(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
      <BellRing className="w-3.5 h-3.5 text-[#666666]" />
      <label htmlFor="canal-cliente" className="text-[#666666]">Notificaciones por</label>
      <select id="canal-cliente" value={valor} disabled={guardando} onChange={e => cambiar(e.target.value)}
        className="px-2.5 py-1 rounded-lg bg-[#141414] border border-white/10 text-white focus:outline-none focus:border-[#C0001A]/60 disabled:opacity-60">
        <option value="">Configuración general</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="sms">SMS</option>
        <option value="email">Correo electrónico</option>
      </select>
      {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C0001A]" />}
      {guardado && !guardando && <span className="inline-flex items-center gap-1 text-green-400"><CheckCircle2 className="w-3.5 h-3.5" /> Guardado</span>}
    </div>
  );
}
