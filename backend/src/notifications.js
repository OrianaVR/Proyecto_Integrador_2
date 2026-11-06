const { readDb, updateDb } = require('./db');
const { id } = require('./utils');

// HU-04: canales de notificación disponibles
const CANALES = ['whatsapp', 'sms', 'email'];
const CANAL_LABEL = { whatsapp: 'WhatsApp', sms: 'SMS', email: 'correo electrónico' };

/** Modo simulado (por defecto activo): sin proveedor configurado, el envío se registra como enviado. MESSAGING_SIMULATION=false lo desactiva. */
const simulacionActiva = () => process.env.MESSAGING_SIMULATION !== 'false';

/** Estado del proveedor de cada canal según las variables de entorno: 'configurado', 'simulado' o 'no_configurado' */
function estadoProveedores() {
  const n8n = Boolean(process.env.N8N_WEBHOOK_URL);
  const real = {
    whatsapp: Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN),
    sms: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM),
    email: Boolean((process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM) || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)),
  };
  return Object.fromEntries(CANALES.map(c => [c, real[c] || n8n ? 'configurado' : simulacionActiva() ? 'simulado' : 'no_configurado']));
}

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
      return { sent: response.ok, status: response.status, provider: 'whatsapp_cloud_api', messageId: data.messages?.[0]?.id || `wa-${Date.now()}`, response: data, error: response.ok ? undefined : (data.error?.message || `WhatsApp respondió ${response.status}`) };
    } catch (error) {
      console.error('[WhatsApp API Error]:', error.message);
      return { sent: false, provider: 'whatsapp_cloud_api', error: error.message };
    }
  }

  // 2. SMS via Twilio (API REST, sin dependencias adicionales)
  if (canal === 'sms' && twilioSid && twilioToken && twilioFrom) {
    try {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: destinatario, From: twilioFrom, Body: mensaje }),
      });
      const data = await response.json();
      return { sent: response.ok, status: response.status, provider: 'twilio_sms', messageId: data.sid || null, error: response.ok ? undefined : (data.message || `Twilio respondió ${response.status}`) };
    } catch (error) {
      console.error('[Twilio SMS Error]:', error.message);
      return { sent: false, provider: 'twilio_sms', error: error.message };
    }
  }

  // 3a. Email via SendGrid (API REST, sin dependencias adicionales)
  if (canal === 'email' && process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: destinatario }] }],
          from: { email: process.env.EMAIL_FROM },
          subject: metadata?.subject || 'Notificación MotoLeasing',
          content: [{ type: 'text/plain', value: mensaje }],
        }),
      });
      return { sent: response.ok, status: response.status, provider: 'sendgrid_email', messageId: response.headers.get('x-message-id') || null, error: response.ok ? undefined : `SendGrid respondió ${response.status}` };
    } catch (error) {
      console.error('[SendGrid Error]:', error.message);
      return { sent: false, provider: 'sendgrid_email', error: error.message };
    }
  }

  // 3b. Email via nodemailer (SMTP)
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
      return { sent: response.ok, status: response.status, provider: 'n8n_webhook', messageId: `n8n-${Date.now()}`, error: response.ok ? undefined : `n8n respondió ${response.status}` };
    } catch (error) {
      console.error('[n8n Webhook Error]:', error.message);
      return { sent: false, provider: 'n8n_webhook', error: error.message };
    }
  }

  // 5. Sin proveedor configurado: falla, salvo que el modo simulado esté activo (demo y entorno local)
  if (!simulacionActiva()) {
    return { sent: false, provider: 'ninguno', error: `El canal ${CANAL_LABEL[canal] || canal} no tiene un proveedor configurado` };
  }
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
  // HU-04: canal del perfil del cliente; si no tiene, el canal por defecto de la configuración general
  const config = readDb().configuracion_notificacion?.[0] || {};
  const canal = CANALES.includes(cliente.canalPreferido) ? cliente.canalPreferido : (CANALES.includes(config.canalPorDefecto) ? config.canalPorDefecto : (process.env.MESSAGING_CHANNEL || 'whatsapp'));
  const habilitados = Array.isArray(config.canalesHabilitados) ? config.canalesHabilitados : CANALES;
  const destinatario = canal === 'email' ? cliente.email : cliente.telefono;

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

  // El mensaje se envía exclusivamente por el canal asignado (sin pasar a otro canal si falla)
  let providerResult;
  if (!habilitados.includes(canal)) {
    providerResult = { sent: false, provider: 'ninguno', error: `El canal ${CANAL_LABEL[canal]} está deshabilitado en la configuración general` };
  } else if (!destinatario) {
    providerResult = { sent: false, provider: 'ninguno', error: `El cliente no tiene ${canal === 'email' ? 'correo electrónico' : 'teléfono'} registrado` };
  } else {
    providerResult = await sendMessagingProvider({ canal, destinatario, mensaje, metadata: { clienteId: cliente.id, contratoId: contrato?.id, cuotaId: cuota.id, monto: cuota.monto, numeroCuota: cuota.numeroCuota, subject: `Recordatorio de cuota #${cuota.numeroCuota}` } });
  }
  const ultimoError = providerResult.sent ? undefined : (providerResult.error || 'Error desconocido');
  if (ultimoError) console.warn(`Falló el envío por ${canal}: ${ultimoError}`);

  // Registrar en historial
  const notificacion = {
    id: id('not'),
    clienteId: cliente.id,
    contratoId: contrato?.id || null,
    cuotaId: cuota.id,
    tipo: 'cobro',
    canal,
    destinatario: destinatario || null,
    titulo: `Recordatorio de cuota #${cuota.numeroCuota}`,
    mensaje,
    monto: Number(cuota.monto),
    estado: providerResult.sent ? 'enviado' : 'fallido',
    proveedor: providerResult.provider || canal,
    messageId: providerResult.messageId || null,
    fecha: new Date().toISOString(),
    error: ultimoError,
    intentos: 1,
  };

  updateDb(db => {
    if (!db.notificaciones) db.notificaciones = [];
    db.notificaciones.push(notificacion);
    // HU-04: si el canal falla, se registra el evento en los logs y se notifica al administrador
    if (ultimoError) {
      if (!db.logs) db.logs = [];
      db.logs.push({ id: id('log'), nivel: 'ERROR', mensaje: `No se pudo enviar el recordatorio de la cuota #${cuota.numeroCuota} a ${cliente.nombre} ${cliente.apellido} por ${CANAL_LABEL[canal]}: ${ultimoError}`, timestamp: notificacion.fecha });
      db.notificaciones.push({ id: id('not'), clienteId: null, destinatario: 'admin', tipo: 'fallo_envio', titulo: 'Falló el envío de una notificación de cobro', mensaje: `${cliente.nombre} ${cliente.apellido} · cuota #${cuota.numeroCuota} · ${CANAL_LABEL[canal]}: ${ultimoError}`, notificacionId: notificacion.id, canal: 'sistema', estado: 'pendiente', fecha: notificacion.fecha });
    }
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
  CANALES,
  CANAL_LABEL,
  estadoProveedores,
  formatCOP,
  sendMessagingProvider,
  enviarRecordatorioCobro,
  createNotification,
};
