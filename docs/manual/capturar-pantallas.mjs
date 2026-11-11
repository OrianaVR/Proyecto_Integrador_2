import fs from 'node:fs/promises';
import path from 'node:path';

const DEBUG_URL = process.env.CHROME_DEBUG_URL ?? 'http://127.0.0.1:9222';
const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_URL ?? 'http://localhost:3001/api';
const OUTPUT_DIR = path.resolve('docs/manual/capturas');

const pages = [
  ['01-inicio-sesion', '/login'],
  ['02-dashboard', '/admin/dashboard'],
  ['03-perfil-cliente', '/admin/clientes/c1'],
  ['04-nuevo-cliente', '/admin/clientes/nuevo'],
  ['05-motocicletas', '/admin/motocicletas'],
  ['06-verificacion-pagos', '/admin/pagos'],
  ['07-desactivaciones', '/admin/desactivaciones'],
  ['08-alertas-gps', '/admin/alertas-gps'],
  ['09-reportes-financieros', '/admin/reportes'],
  ['10-configuracion', '/admin/configuracion'],
];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login fallido: HTTP ${response.status}`);
  const body = await response.json();
  return body.data;
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const version = await fetch(`${DEBUG_URL}/json/version`).then(response => response.json());
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });

  const rootSend = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });

  const { targetId } = await rootSend('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await rootSend('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, sessionId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const navigate = async route => {
    await send('Page.navigate', { url: `${APP_URL}${route}` });
    await delay(2200);
  };

  const evaluate = expression => send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  const screenshot = async name => {
    const { data } = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await fs.writeFile(path.join(OUTPUT_DIR, `${name}.png`), Buffer.from(data, 'base64'));
    console.log(`Capturada ${name}.png`);
  };

  await navigate('/login');
  await screenshot('01-inicio-sesion');

  const admin = await login('admin@motoleasing.com', 'admin123');
  await evaluate(`localStorage.setItem('auth_token', ${JSON.stringify(admin.token)}); localStorage.setItem('moto-auth', ${JSON.stringify(JSON.stringify({ state: { user: admin.user, token: admin.token, isAuth: true }, version: 0 }))});`);
  for (const [name, route] of pages.slice(1)) {
    await navigate(route);
    await screenshot(name);
  }

  const rider = await login('rider@gmail.com', 'rider123');
  await evaluate(`localStorage.setItem('auth_token', ${JSON.stringify(rider.token)}); localStorage.setItem('moto-auth', ${JSON.stringify(JSON.stringify({ state: { user: rider.user, token: rider.token, isAuth: true }, version: 0 }))});`);
  await navigate('/rider/mi-estado');
  await screenshot('11-portal-cliente');

  await rootSend('Target.closeTarget', { targetId });
  socket.close();
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
