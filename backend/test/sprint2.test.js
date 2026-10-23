const { after, before, beforeEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'motoleasing-tests-'));
process.env.MOTOLEASING_DB_FILE = path.join(testDirectory, 'db.json');
process.env.MOTOLEASING_UPLOAD_DIR = path.join(testDirectory, 'uploads');
process.env.JWT_SECRET = 'test-secret-not-for-production';
delete process.env.N8N_WEBHOOK_URL;

const { app } = require('../src/server');
const { writeDb, readDb } = require('../src/db');
const { signToken } = require('../src/auth');
const { calculateScore } = require('../src/utils');

let server;
let baseUrl;
let fixture;
let adminToken;

function isoDate(offsetDays) {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + offsetDays);
  return value.toISOString().slice(0, 10);
}

function clone(value) {
  return structuredClone(value);
}

async function api(route, { method = 'GET', token = adminToken, body } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

before(async () => {
  const [adminHash, riderHash] = await Promise.all([
    bcrypt.hash('admin123', 4),
    bcrypt.hash('rider123', 4),
  ]);
  fixture = {
    usuarios: [
      { id: 'admin-1', email: 'admin@motoleasing.com', passwordHash: adminHash, rol: 'admin', clienteId: null, activo: true },
      { id: 'user-c1', email: 'rider@gmail.com', passwordHash: riderHash, rol: 'rider', clienteId: 'c1', activo: true },
    ],
    clientes: [
      { id: 'c1', nombre: 'Ana', apellido: 'Rider', email: 'rider@gmail.com', telefono: '3000000000', documentoId: '1001', plataforma: 'rappi', fechaRegistro: isoDate(-30), rol: 'rider', activo: true, ciudad: 'Bogotá' },
    ],
    motocicletas: [
      { id: 'm1', marca: 'Honda', modelo: 'CB', año: 2025, placa: 'ABC123', numeroSerie: 'SERIE-1', color: 'Rojo', estadoGPS: 'encendido', dispositivoGPS: 'GPS-1', disponible: true, clienteId: 'c1', creadoEn: new Date().toISOString(), documentos: [] },
    ],
    contratos: [
      { id: 'ct1', clienteId: 'c1', motocicletaId: 'm1', estado: 'activo', fechaInicio: isoDate(-30), fechaFin: isoDate(90), montoSemanal: 100, totalContrato: 400, saldoPendiente: 400, cuotasTotales: 4, cuotasPagadas: 0, creadoEn: new Date().toISOString(), actualizadoEn: new Date().toISOString() },
    ],
    cuotas: [
      { id: 'cuota-1', contratoId: 'ct1', numeroCuota: 1, monto: 100, fechaVencimiento: isoDate(10), fechaPago: null, estado: 'pendiente', diasMorosidad: 0, referencia: null },
    ],
    pagos: [],
    scores: [{ clienteId: 'c1', puntaje: 50, categoria: 'regular', porcentajePuntual: 0, diasPromedioMora: 0, cuotasPagadas: 0, cuotasTotales: 4, ultimaActualizacion: isoDate(0), tendencia: 'estable' }],
    alertas: [],
    notificaciones: [],
    comandosGPS: [],
  };
  writeDb(clone(fixture));
  adminToken = signToken(fixture.usuarios[0]);
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => writeDb(clone(fixture)));

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  fs.rmSync(testDirectory, { recursive: true, force: true });
});

describe('Pruebas unitarias', () => {
  test('calcula score excelente para pagos puntuales', () => {
    assert.deepEqual(calculateScore([{ estado: 'pagado', diasMorosidad: 0 }]), {
      puntaje: 100,
      categoria: 'excelente',
      porcentajePuntual: 100,
      diasPromedioMora: 0,
      tendencia: 'subiendo',
    });
  });

  test('devuelve score inicial cuando no existen pagos', () => {
    assert.equal(calculateScore([]).puntaje, 50);
    assert.equal(calculateScore([]).categoria, 'regular');
  });
});

describe('HU-06 - Inicio de sesión seguro', () => {
  test('Happy Path: autentica credenciales válidas y entrega JWT', async () => {
    const { response, payload } = await api('/api/auth/login', {
      method: 'POST', token: null, body: { email: 'admin@motoleasing.com', password: 'admin123' },
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.user.rol, 'admin');
    assert.ok(payload.data.token);
  });

  test('Flujo alternativo: rechaza una contraseña incorrecta', async () => {
    const { response, payload } = await api('/api/auth/login', {
      method: 'POST', token: null, body: { email: 'admin@motoleasing.com', password: 'incorrecta' },
    });
    assert.equal(response.status, 401);
    assert.equal(payload.error, 'Credenciales inválidas');
  });
});

describe('HU-07 - Registro de cliente, moto y contrato', () => {
  const newClient = {
    nombre: 'Luis', apellido: 'Prueba', email: 'luis@example.com', telefono: '3111111111',
    documentoId: '2002', plataforma: 'didi', ciudad: 'Medellín', marca: 'Yamaha',
    modelo: 'FZ', año: 2026, placa: 'XYZ789', numeroSerie: 'SERIE-2', color: 'Azul',
    dispositivoGPS: 'GPS-2', montoSemanal: 180000, cuotasTotales: 18,
    fechaInicio: isoDate(0), fechaFin: isoDate(126),
  };

  test('Happy Path: crea las tres entidades y el score inicial', async () => {
    const { response, payload } = await api('/api/clientes', { method: 'POST', body: newClient });
    assert.equal(response.status, 200);
    assert.equal(payload.data.contrato.totalContrato, 3240000);
    const db = readDb();
    assert.ok(db.scores.some(score => score.clienteId === payload.data.cliente.id));
  });

  test('Flujo alternativo: impide registrar un correo duplicado', async () => {
    const { response, payload } = await api('/api/clientes', {
      method: 'POST', body: { ...newClient, email: 'rider@gmail.com' },
    });
    assert.equal(response.status, 409);
    assert.match(payload.error, /correo/);
  });
});

describe('HU-09 - Registro de cuota semanal', () => {
  test('Happy Path: registra una cuota válida', async () => {
    const { response, payload } = await api('/api/cuotas', {
      method: 'POST', body: { contratoId: 'ct1', numeroCuota: 2, monto: 100, fechaVencimiento: isoDate(17) },
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.estado, 'pendiente');
    assert.ok(readDb().cuotas.some(cuota => cuota.numeroCuota === 2));
  });

  test('Flujo alternativo: rechaza montos no positivos', async () => {
    const { response, payload } = await api('/api/cuotas', {
      method: 'POST', body: { contratoId: 'ct1', numeroCuota: 2, monto: 0, fechaVencimiento: isoDate(17) },
    });
    assert.equal(response.status, 400);
    assert.match(payload.error, /mayor que cero/);
  });
});

describe('HU-12 - Cálculo del total semanal', () => {
  test('Happy Path: multiplica monto por cantidad de cuotas', async () => {
    const { response, payload } = await api('/api/cuotas/calcular-total', {
      method: 'POST', body: { montoSemanal: 180000, cuotasTotales: 18 },
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.totalContrato, 3240000);
  });

  test('Flujo alternativo: rechaza una cantidad decimal', async () => {
    const { response } = await api('/api/cuotas/calcular-total', {
      method: 'POST', body: { montoSemanal: 180000, cuotasTotales: 1.5 },
    });
    assert.equal(response.status, 400);
  });
});

describe('HU-13 - Registro de pago', () => {
  test('Happy Path: registra el pago y actualiza cuota, saldo y score', async () => {
    const { response, payload } = await api('/api/pagos', {
      method: 'POST', body: { contratoId: 'ct1', cuotaId: 'cuota-1', monto: 100, metodoPago: 'nequi', referencia: 'REF-1' },
    });
    assert.equal(response.status, 200);
    assert.equal(payload.data.monto, 100);
    const db = readDb();
    assert.equal(db.cuotas[0].estado, 'pagado');
    assert.equal(db.contratos[0].saldoPendiente, 300);
    assert.equal(db.scores[0].puntaje, 100);
  });

  test('Flujo alternativo: rechaza un pago negativo', async () => {
    const { response, payload } = await api('/api/pagos', {
      method: 'POST', body: { contratoId: 'ct1', monto: -1, metodoPago: 'efectivo' },
    });
    assert.equal(response.status, 400);
    assert.match(payload.error, /mayor que cero/);
  });
});

describe('HU-01 - Notificación automática de cobro', () => {
  test('Happy Path: genera aviso para una cuota que vence hoy', async () => {
    const db = readDb();
    db.cuotas[0].fechaVencimiento = isoDate(0);
    writeDb(db);
    const { response, payload } = await api('/api/jobs/run', { method: 'POST' });
    assert.equal(response.status, 200);
    assert.equal(payload.data.notifications, 1);
    assert.equal(readDb().notificaciones[0].tipo, 'cobro');
  });

  test('Flujo alternativo: no duplica una notificación existente', async () => {
    const db = readDb();
    db.cuotas[0].fechaVencimiento = isoDate(0);
    db.notificaciones.push({ id: 'not-1', clienteId: 'c1', contratoId: 'ct1', cuotaId: 'cuota-1', tipo: 'cobro', titulo: 'Aviso', mensaje: 'Aviso', estado: 'pendiente', fecha: new Date().toISOString() });
    writeDb(db);
    const { payload } = await api('/api/jobs/run', { method: 'POST' });
    assert.equal(payload.data.notifications, 0);
    assert.equal(readDb().notificaciones.length, 1);
  });
});

describe('HU-17 - Apagado automático por mora', () => {
  test('Happy Path: apaga una moto con siete o más días de mora', async () => {
    const db = readDb();
    db.cuotas[0] = { ...db.cuotas[0], estado: 'vencido', fechaVencimiento: isoDate(-10), diasMorosidad: 10 };
    writeDb(db);
    const { payload } = await api('/api/jobs/run', { method: 'POST' });
    assert.equal(payload.data.shutdowns, 1);
    assert.equal(readDb().motocicletas[0].estadoGPS, 'apagado');
  });

  test('Flujo alternativo: no envía comando a una moto sin señal', async () => {
    const db = readDb();
    db.cuotas[0] = { ...db.cuotas[0], estado: 'vencido', fechaVencimiento: isoDate(-10), diasMorosidad: 10 };
    db.motocicletas[0].estadoGPS = 'sin_señal';
    writeDb(db);
    const { payload } = await api('/api/jobs/run', { method: 'POST' });
    assert.equal(payload.data.shutdowns, 0);
    assert.equal(readDb().comandosGPS.length, 0);
  });
});

describe('HU-19 - Control manual de la motocicleta', () => {
  test('Happy Path: un admin apaga la moto y queda auditoría', async () => {
    const { response } = await api('/api/motocicletas/m1/gps/apagar', { method: 'POST' });
    assert.equal(response.status, 200);
    const db = readDb();
    assert.equal(db.motocicletas[0].estadoGPS, 'apagado');
    assert.equal(db.comandosGPS[0].solicitadoPor, 'admin-1');
  });

  test('Flujo alternativo: no permite encender una moto sin señal', async () => {
    const db = readDb();
    db.motocicletas[0].estadoGPS = 'sin_señal';
    writeDb(db);
    const { response, payload } = await api('/api/motocicletas/m1/gps/encender', { method: 'POST' });
    assert.equal(response.status, 409);
    assert.match(payload.error, /señal GPS/i);
  });
});

describe('Prueba básica de performance', () => {
  test('20 consultas de salud responden con p95 menor a 500 ms', async () => {
    const durations = [];
    for (let index = 0; index < 20; index += 1) {
      const start = performance.now();
      const response = await fetch(`${baseUrl}/api/health`);
      durations.push(performance.now() - start);
      assert.equal(response.status, 200);
    }
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
    assert.ok(p95 < 500, `p95 esperado < 500 ms; obtenido ${p95.toFixed(2)} ms`);
  });
});
