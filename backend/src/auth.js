const jwt = require('jsonwebtoken');
const { readDb } = require('./db');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function signToken(user) {
  return jwt.sign({ sub: user.id, rol: user.rol, email: user.email }, SECRET, { expiresIn: '8h' });
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, error: 'Token requerido' });
  try {
    const payload = jwt.verify(token, SECRET);
    const db = readDb();
    const user = db.usuarios.find(u => u.id === payload.sub && u.activo);
    if (!user) return res.status(401).json({ success: false, error: 'Usuario no válido' });
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) return res.status(403).json({ success: false, error: 'No tienes permisos para esta operación' });
    next();
  };
}

module.exports = { signToken, authenticate, authorize };
