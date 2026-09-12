const { readDb, updateDb } = require('./db');
const { daysBetween } = require('./utils');
const { createNotification } = require('./notifications');

async function processAutomaticCollection() {
  const db = readDb();
  const now = new Date();
  const pending = db.cuotas.filter(c => c.estado === 'pendiente');
  let notifications = 0;

  for (const cuota of pending) {
    const due = new Date(`${cuota.fechaVencimiento}T23:59:59`);
    const diffDays = Math.ceil((due - now) / 86400000);
    const exists = db.notificaciones.some(n => n.cuotaId === cuota.id && n.tipo === 'cobro');
    if (!exists && diffDays >= 0 && diffDays <= 1) {
      const contrato = db.contratos.find(c => c.id === cuota.contratoId);
      if (contrato) {
        const cliente = db.clientes.find(c => c.id === contrato.clienteId);
        await createNotification({
          clienteId: contrato.clienteId, contratoId: contrato.id, cuotaId: cuota.id,
          tipo: 'cobro', titulo: 'Cuota semanal próxima a vencer',
          mensaje: `Hola ${cliente?.nombre || 'rider'}, tu cuota #${cuota.numeroCuota} vence el ${cuota.fechaVencimiento}.`,
        });
        notifications += 1;
      }
    }
  }
  return { notifications };
}

function markOverdueFees() {
  const result = updateDb(db => {
    let updated = 0;
    const now = new Date();
    for (const cuota of db.cuotas) {
      if (cuota.estado === 'pendiente' && new Date(`${cuota.fechaVencimiento}T23:59:59`) < now) {
        cuota.estado = 'vencido';
        cuota.diasMorosidad = daysBetween(`${cuota.fechaVencimiento}T23:59:59`, now);
        updated += 1;
      }
      if (cuota.estado === 'vencido') cuota.diasMorosidad = daysBetween(`${cuota.fechaVencimiento}T23:59:59`, now);
    }
    return updated;
  });
  return result;
}

function autoShutdownMotos() {
  const threshold = Number(process.env.AUTO_SHUTDOWN_MORA_DAYS || 7);
  return updateDb(db => {
    let shutdowns = 0;
    const now = new Date().toISOString();
    for (const contrato of db.contratos) {
      const cuotasMora = db.cuotas.filter(c => c.contratoId === contrato.id && c.estado === 'vencido');
      const maxMora = cuotasMora.reduce((max, c) => Math.max(max, c.diasMorosidad || 0), 0);
      if (maxMora < threshold) continue;
      const moto = db.motocicletas.find(m => m.id === contrato.motocicletaId);
      if (!moto || moto.estadoGPS === 'apagado') continue;
      moto.estadoGPS = 'apagado';
      moto.disponible = false;
      const command = { id: `gps-${Date.now()}-${moto.id}`, motocicletaId: moto.id, accion: 'apagar', solicitadoPor: 'system-auto', timestamp: now, resultado: 'exitoso' };
      db.comandosGPS.push(command);
      let alerta = db.alertas.find(a => a.motocicletaId === moto.id && !a.atendida && a.motivo === 'mora');
      if (!alerta) {
        alerta = { id: `alerta-${Date.now()}-${moto.id}`, clienteId: contrato.clienteId, motocicletaId: moto.id, motivo: 'mora', diasMora: maxMora, fechaProgramada: now, urgencia: maxMora >= 30 ? 'alta' : maxMora >= 15 ? 'media' : 'baja', atendida: false };
        db.alertas.push(alerta);
      }
      shutdowns += 1;
    }
    return shutdowns;
  });
}

async function runJobs() {
  const overdue = markOverdueFees();
  const collection = await processAutomaticCollection();
  const shutdowns = autoShutdownMotos();
  return { overdue, ...collection, shutdowns, executedAt: new Date().toISOString() };
}

module.exports = { runJobs, markOverdueFees, processAutomaticCollection, autoShutdownMotos };
