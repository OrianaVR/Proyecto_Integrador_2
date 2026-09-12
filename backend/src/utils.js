const crypto = require('crypto');

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a, b = new Date()) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

function calculateScore(cuotas) {
  const paid = cuotas.filter(c => c.estado === 'pagado');
  if (!paid.length) return { puntaje: 50, categoria: 'regular', porcentajePuntual: 0, diasPromedioMora: 0, tendencia: 'estable' };
  const puntual = paid.filter(c => (c.diasMorosidad || 0) <= 0).length;
  const avgMora = paid.reduce((sum, c) => sum + (c.diasMorosidad || 0), 0) / paid.length;
  const score = Math.max(0, Math.min(100, Math.round(100 - avgMora * 3 + (puntual / paid.length) * 15 - 15)));
  const categoria = score >= 90 ? 'excelente' : score >= 70 ? 'bueno' : score >= 50 ? 'regular' : 'malo';
  return { puntaje: score, categoria, porcentajePuntual: Math.round((puntual / paid.length) * 100), diasPromedioMora: Number(avgMora.toFixed(1)), tendencia: score >= 75 ? 'subiendo' : score < 50 ? 'bajando' : 'estable' };
}

module.exports = { id, todayISO, addDays, daysBetween, calculateScore };
