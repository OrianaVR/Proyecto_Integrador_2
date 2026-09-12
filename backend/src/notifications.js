const { updateDb } = require('./db');
const { id } = require('./utils');

async function sendWebhook(payload) {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return { sent: false, reason: 'N8N_WEBHOOK_URL no configurada' };
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return { sent: response.ok, status: response.status };
  } catch (error) {
    return { sent: false, reason: error.message };
  }
}

async function createNotification({ clienteId, tipo, titulo, mensaje, contratoId, cuotaId }) {
  const notification = {
    id: id('not'), clienteId, tipo, titulo, mensaje, contratoId: contratoId || null,
    cuotaId: cuotaId || null, estado: 'pendiente', fecha: new Date().toISOString(),
  };
  updateDb(db => db.notificaciones.push(notification));
  await sendWebhook(notification);
  return notification;
}

module.exports = { createNotification, sendWebhook };
