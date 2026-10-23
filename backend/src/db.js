const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = process.env.MOTOLEASING_DB_FILE
  ? path.resolve(process.env.MOTOLEASING_DB_FILE)
  : path.join(DATA_DIR, 'db.json');

const EMPTY_DB = {
  usuarios: [],
  clientes: [],
  motocicletas: [],
  contratos: [],
  cuotas: [],
  pagos: [],
  scores: [],
  alertas: [],
  notificaciones: [],
  cargos: [],
  comandosGPS: [],
  multas: [],
  liquidaciones: [],
  logs: [],
};

function ensureDb() {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  if (!fs.existsSync(DB_FILE)) writeDb(EMPTY_DB);
}

function readDb() {
  ensureDb();
  // Completa las colecciones que falten en bases creadas antes de agregarlas (multas, cargos, logs, etc.)
  return { ...structuredClone(EMPTY_DB), ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
}

function writeDb(db) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const temp = `${DB_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(temp, DB_FILE);
}

function updateDb(mutator) {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return result;
}

module.exports = { DB_FILE, EMPTY_DB, readDb, writeDb, updateDb, ensureDb };
