// HU-14: integración con la pasarela de pagos (formato de eventos tipo Wompi).
// La pasarela envía un evento "transaction.updated" firmado; el sistema valida la firma,
// (opcional) confirma la transacción consultando la API de la pasarela y concilia el pago contra la cuota.
const crypto = require('crypto');

const PREFIJO_REFERENCIA = 'ML-';
const ESTADO_EXITOSO = 'APPROVED';
const ESTADOS = ['APPROVED', 'DECLINED', 'VOIDED', 'ERROR', 'PENDING'];
const ESTADO_LABEL = { APPROVED: 'aprobada', DECLINED: 'rechazada', VOIDED: 'anulada/devuelta', ERROR: 'con error', PENDING: 'pendiente' };

/** Sin credenciales reales se trabaja en modo simulación (sandbox local) */
const simulacionPasarela = () => process.env.PASARELA_SIMULACION !== 'false';
const SECRETO_SANDBOX = 'motoleasing-sandbox-events';

/** Secreto de eventos (en Wompi: "Eventos" en el panel de desarrolladores) */
function secretoEventos() {
  return process.env.PASARELA_EVENTS_SECRET || (simulacionPasarela() ? SECRETO_SANDBOX : '');
}

/** Referencia de pago de una cuota: es la que se envía a la pasarela al crear el cobro */
const referenciaCuota = cuotaId => `${PREFIJO_REFERENCIA}${cuotaId}`;

/** Admite reintentos con sufijo: ML-<cuotaId> o ML-<cuotaId>_<intento> */
function cuotaDeReferencia(cuotas, referencia) {
  const ref = String(referencia || '');
  return cuotas.find(c => ref === referenciaCuota(c.id) || ref.startsWith(`${referenciaCuota(c.id)}_`)) || null;
}

const valorRuta = (obj, ruta) => ruta.split('.').reduce((v, k) => (v == null ? undefined : v[k]), obj);

/** checksum = SHA256(valores de signature.properties + timestamp + secreto) */
function calcularChecksum(evento, secreto) {
  const props = evento?.signature?.properties || [];
  const cadena = props.map(p => String(valorRuta(evento.data, p) ?? '')).join('') + String(evento?.timestamp ?? '') + secreto;
  return crypto.createHash('sha256').update(cadena).digest('hex');
}

function firmaValida(evento) {
  const secreto = secretoEventos();
  const recibido = String(evento?.signature?.checksum || '').toLowerCase();
  if (!secreto || !recibido || !(evento?.signature?.properties || []).length) return false;
  const esperado = calcularChecksum(evento, secreto);
  return recibido.length === esperado.length && crypto.timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
}

/** Construye un evento firmado (lo usa el simulador del sandbox local) */
function construirEvento(transaction) {
  const evento = {
    event: 'transaction.updated',
    data: { transaction },
    sent_at: new Date().toISOString(),
    timestamp: Math.floor(Date.now() / 1000),
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum: '' },
  };
  evento.signature.checksum = calcularChecksum(evento, secretoEventos());
  return evento;
}

/**
 * Verificación contra la API de la pasarela (fuente de verdad), si está configurada:
 * PASARELA_API_URL (p. ej. https://sandbox.wompi.co/v1) y PASARELA_PRIVATE_KEY.
 * Devuelve la transacción, null si la pasarela no la encuentra, o la del evento si no hay API configurada.
 */
async function confirmarConPasarela(transaction) {
  const base = process.env.PASARELA_API_URL;
  if (!base) return transaction;
  const res = await fetch(`${base.replace(/\/$/, '')}/transactions/${encodeURIComponent(transaction.id)}`, {
    headers: process.env.PASARELA_PRIVATE_KEY ? { Authorization: `Bearer ${process.env.PASARELA_PRIVATE_KEY}` } : {},
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`La pasarela respondió HTTP ${res.status}`);
  const body = await res.json();
  return body.data || null;
}

module.exports = {
  ESTADOS,
  ESTADO_EXITOSO,
  ESTADO_LABEL,
  simulacionPasarela,
  referenciaCuota,
  cuotaDeReferencia,
  firmaValida,
  construirEvento,
  confirmarConPasarela,
};
