/**
 * Test Suite: HU-01 Notificación Automática de Cobro
 * Casos de Prueba:
 * - CP-HU01-01: Envío exitoso de notificación automática en la fecha de cobro con el monto adeudado.
 * - CP-HU01-02: Omisión de notificación cuando el cliente ya registró su pago completo antes de la fecha.
 */

const assert = require('assert');
const { readDb, updateDb } = require('./src/db');
const { processAutomaticCollection } = require('./src/jobs');
const { formatCOP } = require('./src/notifications');

async function runTests() {
  console.log('\n=============================================================');
  console.log('🧪 EJECUTANDO PRUEBAS AUTOMATIZADAS - HU-01 COBRO AUTOMÁTICO');
  console.log('=============================================================\n');

  const fechaTest = '2026-11-20';
  const clienteTestId = 'c1';
  const contratoTestId = 'ct1';
  const montoCuota = 180000;

  // Preparar estado de prueba en db
  updateDb(db => {
    // Limpiar notificaciones previas del test
    db.notificaciones = (db.notificaciones || []).filter(n => n.cuotaId !== 'cuota-test-unpaid' && n.cuotaId !== 'cuota-test-paid');

    // Cuota 1: Pendiente para CP-HU01-01
    db.cuotas = db.cuotas.filter(c => c.id !== 'cuota-test-unpaid' && c.id !== 'cuota-test-paid');
    db.cuotas.push({
      id: 'cuota-test-unpaid',
      contratoId: contratoTestId,
      numeroCuota: 98,
      monto: montoCuota,
      fechaVencimiento: fechaTest,
      fechaPago: null,
      estado: 'pendiente',
      diasMorosidad: 0,
      referencia: null,
    });

    // Cuota 2: Pagada previamente para CP-HU01-02
    db.cuotas.push({
      id: 'cuota-test-paid',
      contratoId: 'ct2',
      numeroCuota: 99,
      monto: 200000,
      fechaVencimiento: fechaTest,
      fechaPago: '2026-11-19',
      estado: 'pagado',
      diasMorosidad: 0,
      referencia: 'TRF-TEST-99',
    });
  });

  console.log(`[Escenario Configurado]: Fecha programada de cobro = ${fechaTest}`);
  console.log(`  - Cuota 1 (cuota-test-unpaid): PENDIENTE por ${formatCOP(montoCuota)}`);
  console.log(`  - Cuota 2 (cuota-test-paid): PAGADA previamente por ${formatCOP(200000)}\n`);

  // Ejecutar el proceso automático para la fecha
  const resultado = await processAutomaticCollection(fechaTest);

  console.log('[Resultado de Ejecución del Job]:', {
    fechaEjecucion: resultado.fechaEjecucion,
    totalCuotasEvaluadas: resultado.totalCuotasEvaluadas,
    notificacionesEnviadas: resultado.notifications,
    omitidosPorPago: resultado.omitidosPorPago.length,
    omitidosYaNotificados: resultado.omitidosYaNotificados.length,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // VALIDACIÓN CP-HU01-01: Envío exitoso con monto adeudado
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n--- VALIDANDO CP-HU01-01: Envío exitoso con monto adeudado ---');
  const envioUnpaid = resultado.enviadas.find(e => e.cuotaId === 'cuota-test-unpaid');

  assert.ok(envioUnpaid, '❌ CP-HU01-01 FALLÓ: No se envió notificación para la cuota pendiente.');
  console.log('  ✔ Notificación generada para la cuota pendiente.');

  assert.strictEqual(envioUnpaid.monto, montoCuota, '❌ CP-HU01-01 FALLÓ: El monto registrado en la notificación no coincide.');
  console.log(`  ✔ Monto validado correctamente: ${formatCOP(envioUnpaid.monto)}`);

  assert.ok(envioUnpaid.mensaje.includes(formatCOP(montoCuota)), '❌ CP-HU01-01 FALLÓ: El mensaje no incluye el monto formateado a pagar.');
  console.log(`  ✔ Mensaje incluye el monto total a pagar: "${formatCOP(montoCuota)}"`);

  assert.ok(envioUnpaid.telefono && envioUnpaid.telefono.length > 0, '❌ CP-HU01-01 FALLÓ: Destinatario telefónico no especificado.');
  console.log(`  ✔ Canal y destinatario válidos: ${envioUnpaid.canal.toUpperCase()} a ${envioUnpaid.telefono}`);

  // Verificar persistencia en el historial del cliente
  const dbDespues = readDb();
  const notifHistorial = dbDespues.notificaciones.find(n => n.cuotaId === 'cuota-test-unpaid');
  assert.ok(notifHistorial, '❌ CP-HU01-01 FALLÓ: La notificación no quedó registrada en el historial del cliente.');
  assert.strictEqual(notifHistorial.estado, 'enviado', '❌ CP-HU01-01 FALLÓ: El estado de la notificación debe ser "enviado".');
  console.log('  ✔ Notificación persistida exitosamente en el historial del cliente.');
  console.log('✅ CP-HU01-01 APROBADO CON ÉXITO\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // VALIDACIÓN CP-HU01-02: Omisión cuando el cliente ya pagó antes de la fecha
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- VALIDANDO CP-HU01-02: Omisión cuando el cliente ya pagó ---');
  const envioPaid = resultado.enviadas.find(e => e.cuotaId === 'cuota-test-paid');
  assert.strictEqual(envioPaid, undefined, '❌ CP-HU01-02 FALLÓ: Se envió notificación a una cuota que ya estaba pagada.');
  console.log('  ✔ Ningún mensaje fue enviado a la cuota ya pagada.');

  const omitidoPaid = resultado.omitidosPorPago.find(o => o.cuotaId === 'cuota-test-paid');
  assert.ok(omitidoPaid, '❌ CP-HU01-02 FALLÓ: La cuota pagada no fue catalogada en omitidosPorPago.');
  console.log(`  ✔ Cuota omitida explícitamente: "${omitidoPaid.motivo}"`);

  const notifPagadaEnDb = dbDespues.notificaciones.find(n => n.cuotaId === 'cuota-test-paid');
  assert.strictEqual(notifPagadaEnDb, undefined, '❌ CP-HU01-02 FALLÓ: No debe crearse notificación en db para cuotas pagadas.');
  console.log('  ✔ Verificado: no existe registro de cobro para cuotas pagadas.');
  console.log('✅ CP-HU01-02 APROBADO CON ÉXITO\n');

  // ─────────────────────────────────────────────────────────────────────────────
  // VALIDACIÓN ADICIONAL: Prevención de mensajes duplicados (Idempotencia)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('--- VALIDANDO PREVENCIÓN DE DUPLICADOS (Re-ejecución) ---');
  const reejecucion = await processAutomaticCollection(fechaTest);
  assert.strictEqual(reejecucion.notifications, 0, '❌ Falló idempotencia: Se enviaron notificaciones duplicadas en segunda corrida.');
  assert.ok(reejecucion.omitidosYaNotificados.some(o => o.cuotaId === 'cuota-test-unpaid'), '❌ Debe catalogarse en omitidosYaNotificados.');
  console.log('  ✔ Segunda ejecución no duplicó el mensaje. Omitido por ya notificado.');
  console.log('✅ PREVENCIÓN DE DUPLICADOS APROBADA CON ÉXITO\n');

  // Limpiar datos temporales del test
  updateDb(db => {
    db.cuotas = db.cuotas.filter(c => c.id !== 'cuota-test-unpaid' && c.id !== 'cuota-test-paid');
    db.notificaciones = db.notificaciones.filter(n => n.cuotaId !== 'cuota-test-unpaid' && n.cuotaId !== 'cuota-test-paid');
  });

  console.log('=============================================================');
  console.log('🎉 TODOS LOS CASOS DE PRUEBA CP-HU01-01 Y CP-HU01-02 PASARON');
  console.log('=============================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ ERROR EN PRUEBAS:', err.message);
  process.exit(1);
});
