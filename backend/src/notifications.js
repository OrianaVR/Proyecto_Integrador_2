const { updateDb } = require('./db');
const { id } = require('./utils');

function formatCOP(num) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(num || 0);
}

/**
 * Proveedor de mensajería (WhatsApp / SMS / Webhook)
 * Soporta integración con WhatsApp Cloud API, Twilio, Webhook n8n o modo simulación controlado.
 */
async function sendMessagingProvider({ canal = 'whatsapp', destinatario, mensaje, metadata = {} }) {
  const provider = (process.env.MESSAGING_PROVIDER || 'whatsapp').toLowerCase();
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  const whatsappApiUrl = process.env.WHATSAPP_API_URL;
  const whatsappToken = process.env.WHATSAPP_API_TOKEN;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM;
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  // 1. WhatsApp Cloud API
  if (canal === 'whatsapp' && whatsappApiUrl && whatsappToken) {
    try {
      const response = await fetch(whatsappApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: destinatario?.replace(/\D/g, '') || '',
          type: 'text',
          text: { body: mensaje },
        }),
      });
      const data = await response.json();
      return { sent: response.ok, status: response.status, provider: 'whatsapp_cloud_api', messageId: data.messages?.[0]?.id || `wa-${Date.now()}`, response: data };
    } catch (error) {
      console.error('[WhatsApp API Error]:', error.message);
      return { sent: false, provider: 'whatsapp_cloud_api', error: error.message };
    }
  }

  // 2. SMS via Twilio
  if (canal === 'sms' && twilioSid && twilioToken && twilioFrom) {
    try {
      const twilio = require('twilio')(twilioSid, twilioToken);
      const sms = await twilio.messages.create({
        body: mensaje,
        from: twilioFrom,
        to: destinatario,
      });
      return { sent: true, status: 200, provider: 'twilio_sms', messageId: sms.sid };
    } catch (error) {
      console.error('[Twilio SMS Error]:', error.message);
      return { sent: false, provider: 'twilio_sms', error: error.message };
    }
  }

  // 3. Email via nodemailer
  if (canal === 'email' && smtpHost && smtpUser && smtpPass) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort) || 587,
        secure: Number(smtpPort) === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });
      const info = await transporter.sendMail({
        from: smtpUser,
        to: destinatario,
        subject: metadata?.subject || 'Notificación MotoLeasing',
        text: mensaje,
        html: `<p>${mensaje.replace(/\n/g, '<br/>')}</p>`,
      });
      return { sent: true, status: 200, provider: 'nodemailer_email', messageId: info.messageId };
    } catch (error) {
      console.error('[Email Error]:', error.message);
      return { sent: false, provider: 'nodemailer_email', error: error.message };
    }
  }

  // 4. n8n webhook (fallback)
  if (n8nUrl) {
    try {
      const response = await fetch(n8nUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canal, destinatario, mensaje, metadata, timestamp: new Date().toISOString() }),
      });
      return { sent: response.ok, status: response.status, provider: 'n8n_webhook', messageId: `n8n-${Date.now()}` };
    } catch (error) {
      console.error('[n8n Webhook Error]:', error.message);
      return { sent: false, provider: 'n8n_webhook', error: error.message };
    }
  }

  // 5. Simulated / default provider
  const simulatedId = `msg-${canal}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  console.log(`[Mensajería ${canal.toUpperCase()} Enviada a ${destinatario}]:`);
  console.log(`"${mensaje}"`);
  return { sent: true, status: 200, provider: `${canal}_service`, messageId: simulatedId, timestamp: new Date().toISOString() };
}

/**
 * Crea y registra un recordatorio formal de cobro automático con el monto a pagar
 */
async function enviarRecordatorioCobro({ cliente, contrato, cuota, motocicleta }) {
  if (!cliente || !cuota) throw new Error('Cliente y cuota son obligatorios para el recordatorio');

  // Las cuotas sin desglose (p. ej. las del seed) usan su monto como base
  const base = Number(cuota.montoBase ?? cuota.monto), multas = Number(cuota.montoMultas ?? 0), excedentes = Number(cuota.montoExcedentes ?? 0);
  const montoBase = formatCOP(base);
  const montoMultas = formatCOP(multas);
  const montoExcedentes = formatCOP(excedentes);
  const totalMonto = formatCOP(base + multas + excedentes);
  const canalPreferido = cliente.canalPreferido || (process.env.MESSAGING_CHANNEL || 'whatsapp');
  const telefono = cliente.telefono || 'Sin número';
  const email = cliente.email;

  const mensaje = [
    `🏍️ *Recordatorio de Cobro - MotoLeasing*`,
    `Hola ${cliente.nombre}, hoy es tu fecha programada de cobro de tu leasing.`,
    `📌 *Cuota:* #${cuota.numeroCuota}`,
    `🛵 *Motocicleta:* ${motocicleta ? `${motocicleta.marca} ${motocicleta.modelo} (${motocicleta.placa})` : 'Asignada'}`,
    `💰 *Monto base:* ${montoBase}`,
    `⚖️ *Multas:* ${montoMultas}`,
    `📈 *Excedentes:* ${montoExcedentes}`,
    `🧾 *Total a pagar:* ${totalMonto}`,
    `📅 *Fecha de vencimiento:* ${cuota.fechaVencimiento}`,
    `Recuerda realizar tu pago oportunamente a través de Nequi, Daviplata o Transferencia para mantener tu servicio GPS activo y cuidar tu score crediticio.`,
  ].join('\n');

  // Determinar orden de canales (preferido primero, luego los demás)
  const allChannels = ['whatsapp', 'sms', 'email'];
  const channelsToTry = [canalPreferido, ...allChannels.filter(c => c !== canalPreferido)];

  let providerResult = null;
  let intentos = 0;
  let ultimoError = undefined;
  for (const canal of channelsToTry) {
    intentos++;
    const destinatario = canal === 'email' ? email : telefono;
    providerResult = await sendMessagingProvider({ canal, destinatario, mensaje, metadata: { clienteId: cliente.id, contratoId: contrato?.id, cuotaId: cuota.id, monto: cuota.monto, numeroCuota: cuota.numeroCuota } });
    if (providerResult.sent) break; // éxito, salir del bucle
    ultimoError = providerResult.error || 'Error desconocido';
    console.warn(`Intento ${intentos} falló vía ${canal}: ${ultimoError}`);
  }

  // Registrar en historial
  const notificacion = {
    id: id('not'),
    clienteId: cliente.id,
    contratoId: contrato?.id || null,
    cuotaId: cuota.id,
    tipo: 'cobro',
    canal: providerResult?.provider?.replace('_service', '') || canalPreferido,
    destinatario: providerResult?.provider === 'nodemailer_email' ? email : telefono,
    titulo: `Recordatorio de cuota #${cuota.numeroCuota}`,
    mensaje,
    monto: Number(cuota.monto),
    estado: providerResult?.sent ? 'enviado' : 'fallido',
    proveedor: providerResult?.provider || canalPreferido,
    messageId: providerResult?.messageId || null,
    fecha: new Date().toISOString(),
    error: providerResult?.sent ? undefined : ultimoError,
    intentos,
  };

  updateDb(db => {
    if (!db.notificaciones) db.notificaciones = [];
    db.notificaciones.push(notificacion);
  });

  return notificacion;
}

/**
 * Notificación genérica para pagos o alertas
 */
async function createNotification({ clienteId, tipo, titulo, mensaje, contratoId, cuotaId, monto = null }) {
  const notification = {
    id: id('not'),
    clienteId,
    tipo,
    titulo,
    mensaje,
    monto: monto ? Number(monto) : null,
    contratoId: contratoId || null,
    cuotaId: cuotaId || null,
    canal: 'sistema',
    estado: 'enviado',
    fecha: new Date().toISOString(),
  };

  updateDb(db => {
    if (!db.notificaciones) db.notificaciones = [];
    db.notificaciones.push(notification);
  });

  if (process.env.N8N_WEBHOOK_URL) {
    await sendMessagingProvider({ canal: 'webhook', destinatario: 'n8n', mensaje, payload: notification });
  }

  return notification;
}

module.exports = {
  formatCOP,
  sendMessagingProvider,
  enviarRecordatorioCobro,
  createNotification,
};
