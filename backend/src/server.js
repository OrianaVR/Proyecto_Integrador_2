require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readDb, updateDb, ensureDb } = require('./db');
const { signToken, authenticate, authorize } = require('./auth');
const { id, addDays, daysBetween, calculateScore } = require('./utils');
const { createNotification } = require('./notifications');
const { runJobs, processAutomaticCollection } = require('./jobs');
const { seed } = require('./seed');
const { generarReporteFinanciero, exportarReportePDF, exportarReporteExcel } = require('./reports');

ensureDb();
const app = express();
const PORT = Number(process.env.PORT || 3001);
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => ALLOWED_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error('INVALID_FILE_TYPE')) });

app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(uploadDir));

const ok = (res, data, message) => res.json({ success: true, data, message });
const fail = (res, status, error) => res.status(status).json({ success: false, error });

function validateRequired(body, fields) {
  return fields.find(field => body[field] === undefined || body[field] === null || body[field] === '');
}

function clienteDetalle(db, clienteId) {
  const cliente = db.clientes.find(c => c.id === clienteId);
  if (!cliente) return null;
  const motocicleta = db.motocicletas.find(m => m.clienteId === clienteId) || null;
  const contrato = db.contratos.find(c => c.clienteId === clienteId) || null;
  if (contrato) contrato.cliente = cliente;
  if (contrato && motocicleta) contrato.motocicleta = motocicleta;
  const score = db.scores.find(s => s.clienteId === clienteId) || null;
  const cuotas = contrato ? db.cuotas.filter(c => c.contratoId === contrato.id) : [];
  const proximaCuota = cuotas.find(c => c.estado === 'pendiente') || cuotas.find(c => c.estado === 'vencido') || null;
  const diasMora = cuotas.reduce((max, c) => Math.max(max, c.diasMorosidad || 0), 0);
  return { cliente, motocicleta, contrato, score, diasMora, proximaCuota, historial: cuotas.map(c => ({ cuotaId:c.id, numeroCuota:c.numeroCuota, monto:c.monto, montoBase:c.montoBase, montoMultas:c.montoMultas, montoExcedentes:c.montoExcedentes, fechaVencimiento:c.fechaVencimiento, fechaPago:c.fechaPago, estado:c.estado, diasDiferencia:c.fechaPago ? Math.round((new Date(c.fechaPago)-new Date(c.fechaVencimiento))/86400000) : c.diasMorosidad || 0 })), multas: db.multas.filter(m => m.clienteId === clienteId), cargos: db.cargos.filter(c => c.clienteId === clienteId) };
}

// ───────────────────────────────── AUTH ─────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  const missing = validateRequired(req.body, ['email', 'password']);
  if (missing) return fail(res, 400, `El campo ${missing} es obligatorio`);
  const db = readDb();
  const user = db.usuarios.find(u => u.email.toLowerCase() === String(req.body.email).toLowerCase() && u.activo);
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) return fail(res, 401, 'Credenciales inválidas');
  const cliente = user.clienteId ? db.clientes.find(c => c.id === user.clienteId) : null;
  const safeUser = { id:user.id, email:user.email, rol:user.rol, clienteId:user.clienteId, activo:user.activo, ...(cliente || {}) };
  return ok(res, { token: signToken(user), user: safeUser });
});

app.get('/api/auth/me', authenticate, (req, res) => ok(res, { id:req.user.id, email:req.user.email, rol:req.user.rol, clienteId:req.user.clienteId }));

// ───────────────────────────── DASHBOARD ────────────────────────────────────
app.get('/api/dashboard/stats', authenticate, authorize('admin'), (_req, res) => {
  const db = readDb();
  const motosActivas = db.motocicletas.filter(m => m.estadoGPS === 'encendido').length;
  const motosBloqueadas = db.motocicletas.filter(m => m.estadoGPS === 'apagado').length;
  const clientesEnMora = new Set(db.cuotas.filter(c => c.estado === 'vencido').map(c => db.contratos.find(ct => ct.id === c.contratoId)?.clienteId).filter(Boolean)).size;
  const month = new Date().toISOString().slice(0,7);
  const recaudoMes = db.pagos.filter(p => p.fechaPago.slice(0,7) === month).reduce((s,p)=>s+p.monto,0);
  const prev = new Date(); prev.setMonth(prev.getMonth()-1); const prevMonth = prev.toISOString().slice(0,7);
  const recaudoMesAnterior = db.pagos.filter(p => p.fechaPago.slice(0,7) === prevMonth).reduce((s,p)=>s+p.monto,0);
  ok(res, { motosActivas, motosBloqueadas, clientesEnMora, recaudoMes, recaudoMesAnterior });
});

app.get('/api/dashboard/clientes', authenticate, authorize('admin'), (req,res) => {
  const db=readDb(); const page=Math.max(1,Number(req.query.page)||1); const limit=Math.min(100,Math.max(1,Number(req.query.limit)||20)); const q=String(req.query.search||'').toLowerCase();
  let rows=db.clientes.map(c=>clienteDetalle(db,c.id)).filter(Boolean);
  if(q) rows=rows.filter(r=>`${r.cliente.nombre} ${r.cliente.apellido} ${r.motocicleta?.placa||''}`.toLowerCase().includes(q));
  rows.sort((a,b)=>(b.diasMora||0)-(a.diasMora||0)); const total=rows.length; const data=rows.slice((page-1)*limit,page*limit);
  ok(res,{data,total,page,limit,totalPages:Math.ceil(total/limit)});
});

// ───────────────────────────── CLIENTES ────────────────────────────────────
app.get('/api/clientes', authenticate, authorize('admin'), (req,res)=>{
  const db=readDb(); const page=Math.max(1,Number(req.query.page)||1); const limit=Math.min(100,Math.max(1,Number(req.query.limit)||20)); const q=String(req.query.search||'').toLowerCase();
  let data=db.clientes.filter(c=>!q || `${c.nombre} ${c.apellido} ${c.email} ${c.documentoId}`.toLowerCase().includes(q));
  const total=data.length; data=data.slice((page-1)*limit,page*limit); ok(res,{data,total,page,limit,totalPages:Math.ceil(total/limit)});
});

app.get('/api/clientes/:id', authenticate, (req,res)=>{
  if(req.user.rol==='rider' && req.user.clienteId!==req.params.id) return fail(res,403,'No puedes consultar otro cliente');
  const detalle=clienteDetalle(readDb(),req.params.id); if(!detalle) return fail(res,404,'Cliente no encontrado'); ok(res,detalle);
});

app.post('/api/clientes', authenticate, authorize('admin'), (req,res)=>{
  const body=req.body; const missing=validateRequired(body,['nombre','apellido','email','telefono','documentoId','plataforma','ciudad','marca','modelo','año','placa','numeroSerie','color','montoSemanal','cuotasTotales','fechaInicio','fechaFin']); if(missing) return fail(res,400,`El campo ${missing} es obligatorio`);
  const result=updateDb(db=>{
    if(db.clientes.some(c=>c.email.toLowerCase()===String(body.email).toLowerCase())) throw new Error('EMAIL_EXISTS');
    if(db.clientes.some(c=>c.documentoId===String(body.documentoId))) throw new Error('DOC_EXISTS');
    if(db.motocicletas.some(m=>m.placa===String(body.placa).toUpperCase())) throw new Error('PLATE_EXISTS');
    if(body.dispositivoGPS && db.motocicletas.some(m=>m.dispositivoGPS===String(body.dispositivoGPS))) throw new Error('GPS_EXISTS');
    const clienteId=id('c'), motoId=id('m'), contratoId=id('ct');
    const cliente={id:clienteId,nombre:body.nombre,apellido:body.apellido,email:body.email,telefono:body.telefono,documentoId:String(body.documentoId),plataforma:body.plataforma,fechaRegistro:new Date().toISOString().slice(0,10),rol:'rider',activo:true,ciudad:body.ciudad};
    const moto={id:motoId,marca:body.marca,modelo:body.modelo,año:Number(body.año),placa:String(body.placa).toUpperCase(),numeroSerie:body.numeroSerie,color:body.color,estadoGPS:'apagado',dispositivoGPS:body.dispositivoGPS||null,disponible:true,clienteId:clienteId,creadoEn:new Date().toISOString(),vencimientoSOAT:body.vencimientoSOAT||null,vencimientoTecno:body.vencimientoTecno||null,documentos:[]};
    const monto=Number(body.montoSemanal), cuotas=Number(body.cuotasTotales), total=monto*cuotas;
    const contrato={id:contratoId,clienteId,motocicletaId:motoId,estado:'activo',fechaInicio:body.fechaInicio,fechaFin:body.fechaFin,montoSemanal:monto,totalContrato:total,saldoPendiente:total,cuotasTotales:cuotas,cuotasPagadas:0,observaciones:body.observaciones||null,creadoEn:new Date().toISOString(),actualizadoEn:new Date().toISOString()};
    db.clientes.push(cliente); db.motocicletas.push(moto); db.contratos.push(contrato);
    db.scores.push({...calculateScore([]),clienteId,cuotasPagadas:0,cuotasTotales:cuotas,ultimaActualizacion:new Date().toISOString().slice(0,10)});
    return {cliente,moto,contrato};
  });
  ok(res,result,'Cliente, motocicleta y contrato registrados');
});

// ───────────────────────────── CUOTAS ───────────────────────────────────────
app.post('/api/cuotas/calcular-total', authenticate, authorize('admin'), (req,res)=>{
  const monto=Number(req.body.montoSemanal); const cantidad=Number(req.body.cuotasTotales); if(!Number.isFinite(monto)||monto<=0||!Number.isInteger(cantidad)||cantidad<=0) return fail(res,400,'montoSemanal y cuotasTotales deben ser válidos');
  ok(res,{montoSemanal:monto,cuotasTotales:cantidad,totalContrato:monto*cantidad,formula:`${monto} x ${cantidad}`});
});

app.post('/api/cuotas', authenticate, authorize('admin'), async (req,res)=>{
  const { contratoId, numeroCuota, monto, fechaVencimiento }=req.body; const missing=validateRequired(req.body,['contratoId','numeroCuota','monto','fechaVencimiento']); if(missing) return fail(res,400,`El campo ${missing} es obligatorio`);
  if(!Number.isFinite(Number(monto))||Number(monto)<=0) return fail(res,400,'El monto debe ser un número mayor que cero');
  const result=updateDb(db=>{
    const contrato=db.contratos.find(c=>c.id===contratoId); if(!contrato) throw new Error('CONTRACT_NOT_FOUND');
    if(db.cuotas.some(c=>c.contratoId===contratoId && c.numeroCuota===Number(numeroCuota))) throw new Error('FEE_EXISTS');
    const cuota={id:id('cuota'),contratoId,numeroCuota:Number(numeroCuota),monto:Number(monto),montoBase:Number(monto),montoMultas:0,montoExcedentes:0,fechaVencimiento,fechaPago:null,estado:'pendiente',diasMorosidad:0,referencia:null}; db.cuotas.push(cuota); contrato.cuotasTotales=Math.max(contrato.cuotasTotales,Number(numeroCuota)); contrato.totalContrato=contrato.montoSemanal*contrato.cuotasTotales; contrato.saldoPendiente += Number(monto); contrato.actualizadoEn=new Date().toISOString(); return cuota;
  });
  const contrato=readDb().contratos.find(c=>c.id===contratoId); if(contrato) await createNotification({clienteId:contrato.clienteId,contratoId,cuotaId:result.id,tipo:'cuota_registrada',titulo:'Nueva cuota registrada',mensaje:`Se registró la cuota #${result.numeroCuota} por $${result.monto.toLocaleString('es-CO')}.`});
  ok(res,result,'Cuota semanal registrada');
});

app.get('/api/cuotas/contrato/:contratoId', authenticate, (req,res)=>{
  const db=readDb(); const contrato=db.contratos.find(c=>c.id===req.params.contratoId); if(!contrato) return fail(res,404,'Contrato no encontrado'); if(req.user.rol==='rider'&&req.user.clienteId!==contrato.clienteId) return fail(res,403,'No autorizado'); ok(res,db.cuotas.filter(c=>c.contratoId===contrato.id));
});

// ───────────────────────────── PAGOS ────────────────────────────────────────
app.post('/api/pagos', authenticate, authorize('admin'), upload.single('comprobante'), async (req,res)=>{
  const body=req.body; const missing=validateRequired(body,['contratoId','monto','metodoPago']); if(missing) return fail(res,400,`El campo ${missing} es obligatorio`);
  const result=updateDb(db=>{
    const contrato=db.contratos.find(c=>c.id===body.contratoId); if(!contrato) throw new Error('CONTRACT_NOT_FOUND');
    const cuota=body.cuotaId ? db.cuotas.find(c=>c.id===body.cuotaId && c.contratoId===body.contratoId) : db.cuotas.find(c=>c.contratoId===body.contratoId && ['vencido','pendiente'].includes(c.estado));
    const monto=Number(body.monto); if(!Number.isFinite(monto)||monto<=0) throw new Error('INVALID_AMOUNT');
    const pago={id:id('pago'),contratoId:contrato.id,cuotaId:cuota?.id||null,clienteId:contrato.clienteId,monto,metodoPago:body.metodoPago,referencia:body.referencia||null,comprobante:req.file?`/uploads/${req.file.filename}`:body.comprobante||null,registradoPor:req.user.id,fechaPago:new Date().toISOString(),notas:body.notas||null,estado:'PENDIENTE'}; db.pagos.push(pago);
    if(cuota){ cuota.estado='pagado'; cuota.fechaPago=pago.fechaPago.slice(0,10); cuota.diasMorosidad=0; cuota.referencia=pago.referencia; contrato.cuotasPagadas=Math.min(contrato.cuotasTotales,contrato.cuotasPagadas+1); }
    contrato.saldoPendiente=Math.max(0,contrato.saldoPendiente-monto); contrato.actualizadoEn=new Date().toISOString();
    const cuotas=db.cuotas.filter(c=>c.contratoId===contrato.id); const score=calculateScore(cuotas); const old=db.scores.find(s=>s.clienteId===contrato.clienteId); db.scores=db.scores.filter(s=>s.clienteId!==contrato.clienteId); db.scores.push({...old,...score,clienteId:contrato.clienteId,cuotasPagadas:contrato.cuotasPagadas,cuotasTotales:contrato.cuotasTotales,ultimaActualizacion:new Date().toISOString().slice(0,10)});
    return pago;
  });
  await createNotification({clienteId:result.clienteId,contratoId:result.contratoId,cuotaId:result.cuotaId,tipo:'pago',titulo:'Pago registrado',mensaje:`Se registró un pago de $${result.monto.toLocaleString('es-CO')}.`});
  ok(res,result,'Pago registrado correctamente');
});
// ───────────────────────────── MULTAS ───────────────────────────────────────
app.post('/api/multas', authenticate, authorize('admin'), async (req, res) => {
  const { clienteId, contratoId, monto, descripcion, fecha } = req.body;
  const missing = validateRequired(req.body, ['clienteId', 'monto', 'fecha']);
  if (missing) return fail(res, 400, `El campo ${missing} es obligatorio`);
  if (!Number.isFinite(Number(monto)) || Number(monto) <= 0) return fail(res, 400, 'El monto debe ser un número mayor que cero');
  const result = updateDb(db => {
    const cliente = db.clientes.find(c => c.id === clienteId);
    if (!cliente) throw new Error('CLIENTE_NOT_FOUND');
    const multa = {
      id: id('multa'),
      clienteId,
      contratoId: contratoId || null,
      monto: Number(monto),
      descripcion: descripcion || null,
      fecha,
      pagada: false,
      creadoEn: new Date().toISOString(),
    };
    db.multas.push(multa);
    // actualizar saldo pendiente del contrato si se indica
    if (contratoId) {
      const contrato = db.contratos.find(c => c.id === contratoId);
      if (contrato) contrato.saldoPendiente = Number(contrato.saldoPendiente) + Number(monto);
    }
    return multa;
  });
  ok(res, result, 'Multa registrada');
});

app.get('/api/multas/cliente/:clienteId', authenticate, (req, res) => {
  const db = readDb();
  const clienteId = req.params.clienteId;
  if (req.user.rol === 'rider' && req.user.clienteId !== clienteId) return fail(res, 403, 'No puedes consultar multas de otro cliente');
  const multas = db.multas.filter(m => m.clienteId === clienteId);
  ok(res, multas);
});

app.patch('/api/multas/:id/pagar', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const multa = db.multas.find(m => m.id === id);
  if (!multa) return fail(res, 404, 'Multa no encontrada');
  if (multa.pagada) return fail(res, 400, 'Multa ya está pagada');
  // Ajustar saldo pendiente del contrato si está asociado
  if (multa.contratoId) {
    const contrato = db.contratos.find(c => c.id === multa.contratoId);
    if (contrato) {
      contrato.saldoPendiente = Math.max(0, Number(contrato.saldoPendiente) - Number(multa.monto));
    }
  }
  multa.pagada = true;
  ok(res, multa, 'Multa marcada como pagada');
});
app.get('/api/pagos/cliente/:clienteId', authenticate, (req,res)=>{
  if(req.user.rol==='rider'&&req.user.clienteId!==req.params.clienteId) return fail(res,403,'No autorizado'); const db=readDb(); ok(res,db.pagos.filter(p=>p.clienteId===req.params.clienteId));
});

// ───────────────────────────── CARGOS ADICIONALES ──────────────────────────────────
app.post('/api/cargos-adicionales', authenticate, authorize('admin'), (req, res) => {
  const { clienteId, contratoId, concepto, monto } = req.body;
  const missing = validateRequired(req.body, ['clienteId', 'concepto', 'monto']);
  if (missing) return fail(res, 400, `El campo ${missing} es obligatorio`);
  if (!Number.isFinite(Number(monto)) || Number(monto) <= 0) return fail(res, 400, 'El monto debe ser un número mayor que cero');
  const result = updateDb(db => {
    const cliente = db.clientes.find(c => c.id === clienteId);
    if (!cliente) throw new Error('CLIENTE_NOT_FOUND');
    const cargo = {
      id: id('cargo'),
      clienteId,
      contratoId: contratoId || null,
      concepto: concepto || null,
      monto: Number(monto),
      pagada: false,
      creadoEn: new Date().toISOString(),
    };
    db.cargos.push(cargo);
    // actualizar saldo pendiente del contrato si se indica
    if (contratoId) {
      const contrato = db.contratos.find(c => c.id === contratoId);
      if (contrato) contrato.saldoPendiente = Number(contrato.saldoPendiente) + Number(monto);
    }
    return cargo;
  });
  ok(res, result, 'Cargo adicional registrado');
});

app.get('/api/cargos-adicionales/cliente/:clienteId', authenticate, (req, res) => {
  const db = readDb();
  const clienteId = req.params.clienteId;
  if (req.user.rol === 'rider' && req.user.clienteId !== clienteId) return fail(res, 403, 'No puedes consultar cargos de otro cliente');
  const cargos = db.cargos.filter(c => c.clienteId === clienteId);
  ok(res, cargos);
});

app.patch('/api/cargos-adicionales/:id/pagar', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const cargo = db.cargos.find(c => c.id === id);
  if (!cargo) return fail(res, 404, 'Cargo no encontrado');
  if (cargo.pagada) return fail(res, 400, 'Cargo ya está pagado');
  if (cargo.contratoId) {
    const contrato = db.contratos.find(c => c.id === cargo.contratoId);
    if (contrato) contrato.saldoPendiente = Math.max(0, Number(contrato.saldoPendiente) - Number(cargo.monto));
  }
  cargo.pagada = true;
  ok(res, cargo, 'Cargo marcado como pagado');
});

// ───────────────────────────── MANUAL PAYMENT VERIFICATION ──────────────────────────────
app.get('/api/pagos/pendientes', authenticate, authorize('admin'), (req, res) => {
  const db = readDb();
  const pending = db.pagos.filter(p => p.estado === 'PENDIENTE');
  ok(res, pending);
});

app.patch('/api/pagos/:id/aprobar', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const pago = db.pagos.find(p => p.id === id);
  if (!pago) return fail(res, 404, 'Pago no encontrado');
  if (pago.estado !== 'PENDIENTE') return fail(res, 400, 'Pago no está pendiente');
  if (pago.contratoId) {
    const contrato = db.contratos.find(c => c.id === pago.contratoId);
    if (contrato) contrato.saldoPendiente = Math.max(0, Number(contrato.saldoPendiente) - Number(pago.monto));
  }
  pago.estado = 'APROBADO';
  await encenderMotoIfMora(pago);
  ok(res, pago, 'Pago aprobado');
});

app.patch('/api/pagos/:id/rechazar', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const { razon } = req.body;
  const db = readDb();
  const pago = db.pagos.find(p => p.id === id);
  if (!pago) return fail(res, 404, 'Pago no encontrado');
  if (pago.estado !== 'PENDIENTE') return fail(res, 400, 'Pago no está pendiente');
  pago.estado = 'RECHAZADO';
  if (razon) pago.razonRechazo = razon;
  ok(res, pago, 'Pago rechazado');
});

// ───────────────────────────── GPS / MOTOS ──────────────────────────────────

// ───────────────────────────── GPS / MOTOS ──────────────────────────────────
app.get('/api/motocicletas', authenticate, authorize('admin'), (req,res)=>{
  const db=readDb(); const q=String(req.query.search||'').toLowerCase(); const gps=String(req.query.gps||'todos'); let motos=db.motocicletas.filter(m=>!q||`${m.placa} ${m.marca} ${m.modelo}`.toLowerCase().includes(q)); if(gps!=='todos') motos=motos.filter(m=>m.estadoGPS===gps); ok(res,motos);
});

app.get('/api/motocicletas/:id/gps', authenticate, (req,res)=>{
  const db=readDb(); const moto=db.motocicletas.find(m=>m.id===req.params.id); if(!moto) return fail(res,404,'Motocicleta no encontrada'); if(req.user.rol==='rider'&&moto.clienteId!==req.user.clienteId) return fail(res,403,'No autorizado'); ok(res,{estado:moto.estadoGPS,ultimaActualizacion:moto.actualizadoEn||null});
});

async function setGps(req,res,accion){
  const result=updateDb(db=>{ const moto=db.motocicletas.find(m=>m.id===req.params.id); if(!moto) throw new Error('MOTO_NOT_FOUND'); if(moto.estadoGPS==='sin_señal') throw new Error('GPS_NO_SIGNAL'); moto.estadoGPS=accion; moto.actualizadoEn=new Date().toISOString(); const command={id:id('gps'),motocicletaId:moto.id,accion,solicitadoPor:req.user.id,timestamp:new Date().toISOString(),resultado:'exitoso'}; db.comandosGPS.push(command); return {moto,command}; }); ok(res,result,`GPS ${accion==='encendido'?'encendido':'apagado'} correctamente`);
}

// Helper: intentar encender moto después de pago exitoso
async function encenderMotoIfMora(pago){
  const db = readDb();
  const contrato = db.contratos.find(c => c.id === pago.contratoId);
  if (!contrato) return; // no hay contrato asociado
  const moto = db.motocicletas.find(m => m.id === contrato.motocicletaId);
  if (!moto) return;
  // Si la moto está apagada o sin señal, intentar encender
  if (moto.estadoGPS !== 'encendido') {
    try {
      await encenderMoto(moto.id);
    } catch (e) {
      // Crear alerta de fallo y notificar admin
      await crearAlertaFallo({ clienteId: contrato.clienteId, motoId: moto.id, tipo: 'encendido', error: e.message });
    }
  }
}



// Core logic to encender una moto con reintentos
async function encenderMoto(motoId, attempt = 0){
  const MAX_ATTEMPTS = 3;
  const db = readDb();
  const moto = db.motocicletas.find(m => m.id === motoId);
  if (!moto) throw new Error('MOTO_NOT_FOUND');
  if (moto.estadoGPS === 'sin_señal') throw new Error('GPS_NO_SIGNAL');
  try {
    // Simular llamada al proveedor GPS (still unavailable)
    moto.estadoGPS = 'encendido';
    moto.actualizadoEn = new Date().toISOString();
    const command = { id: id('gps'), motocicletaId: moto.id, accion: 'encender', solicitadoPor: 'system-auto', timestamp: new Date().toISOString(), resultado: 'exitoso' };
    db.comandosGPS.push(command);
    // Notificar al cliente
    const contrato = db.contratos.find(c => c.motocicletaId === moto.id);
    if (contrato) {
      const cliente = db.clientes.find(cl => cl.id === contrato.clienteId);
      if (cliente) {
        await createNotification({
          clienteId: cliente.id,
          tipo: 'reconexion',
          titulo: 'Moto reconectada',
          mensaje: `Su motocicleta ${moto.placa} ha sido encendida automáticamente tras la confirmación de pago.`
        });
      }
    }
    // Persistir cambios
    updateDb(() => db);
    return;
  } catch (e) {
    // Log error
    const log = { id: id('log'), nivel: 'ERROR', mensaje: `Error al encender moto ${motoId}: ${e.message}`, timestamp: new Date().toISOString() };
    db.logs.push(log);
    if (attempt + 1 < MAX_ATTEMPTS) {
      // retry after short delay
      await new Promise(r => setTimeout(r, 500));
      return encenderMoto(motoId, attempt + 1);
    }
    throw e;
  }
}
  const MAX_ATTEMPTS = 3;
  const db = readDb();
  const moto = db.motocicletas.find(m => m.id === motoId);
  if (!moto) throw new Error('MOTO_NOT_FOUND');
  if (moto.estadoGPS === 'sin_señal') throw new Error('GPS_NO_SIGNAL');
  try {
    // Simular llamada al proveedor GPS (still unavailable)
    moto.estadoGPS = 'encendido';
    moto.actualizadoEn = new Date().toISOString();
    const command = { id: id('gps'), motocicletaId: moto.id, accion: 'encender', solicitadoPor: 'system-auto', timestamp: new Date().toISOString(), resultado: 'exitoso' };
    db.comandosGPS.push(command);
    // Notificar al cliente
    const contrato = db.contratos.find(c => c.motocicletaId === moto.id);
    if (contrato) {
      const cliente = db.clientes.find(cl => cl.id === contrato.clienteId);
      if (cliente) {
        await createNotification({
          clienteId: cliente.id,
          tipo: 'reconexion',
          titulo: 'Moto reconectada',
          mensaje: `Su motocicleta ${moto.placa} ha sido encendida automáticamente tras la confirmación de pago.`
        });
      }
    }
    // Persistir cambios
    updateDb(() => db);
    return;
  } catch (e) {
    // Log error
    const log = { id: id('log'), nivel: 'ERROR', mensaje: `Error al encender moto ${motoId}: ${e.message}`, timestamp: new Date().toISOString() };
    db.logs.push(log);
    if (attempt + 1 < MAX_ATTEMPTS) {
      // retry after short delay
      await new Promise(r => setTimeout(r, 500));
      return encenderMoto(motoId, attempt + 1);
    }
    throw e;
  }
}

// Helper: crear alerta de fallo crítico en encendido/apagado
async function crearAlertaFallo({ clienteId, motoId, tipo, error }) {
  const db = readDb();
  const alerta = {
    id: id('alerta'),
    clienteId,
    motoId,
    tipo,
    error,
    creadoEn: new Date().toISOString(),
    atendida: false,
    atendidaEn: null,
  };
  // Añadir a la colección de alertas
  updateDb(d => { if (!d.alertas) d.alertas = []; d.alertas.push(alerta); });
  // Notificar al administrador (asumimos usuario admin con email env ADMIN_EMAIL)
  const adminEmail = process.env.ADMIN_EMAIL || '';
  if (adminEmail) {
    await createNotification({
      clienteId: null,
      tipo: 'alerta',
      titulo: `Fallo de ${tipo} GPS`,
      mensaje: `Error en moto ${motoId}: ${error}`,
    });
  }
  return alerta;
}

// Endpoint para recibir webhook externo (p.ej. N8N) cuando se aprueba un pago
app.post('/api/webhooks/pago-aprobado', async (req, res) => {
  const { pagoId } = req.body;
  if (!pagoId) return fail(res, 400, 'pagoId es requerido');
  const db = readDb();
  const pago = db.pagos.find(p => p.id === pagoId);
  if (!pago) return fail(res, 404, 'Pago no encontrado');
  if (pago.estado !== 'APROBADO') return fail(res, 400, 'Pago no está aprobado');
  try {
    await encenderMotoIfMora(pago);
    ok(res, {msg:'Comando de encendido procesado (si correspondía)'}, 'Webhook procesado');
  } catch (e) {
    // Registrar log de error
    const log = { id: id('log'), nivel: 'ERROR', mensaje: `Error en webhook pago-aprobado para pago ${pagoId}: ${e.message}`, timestamp: new Date().toISOString() };
    db.logs.push(log);
    fail(res, 500, 'Error procesando encendido');
  }
});
app.post('/api/webhooks/pago-aprobado', async (req, res) => {
  const { pagoId } = req.body;
  if (!pagoId) return fail(res, 400, 'pagoId es requerido');
  const db = readDb();
  const pago = db.pagos.find(p=>p.id===pagoId);
  if (!pago) return fail(res, 404, 'Pago no encontrado');
  if (pago.estado !== 'APROBADO') return fail(res, 400, 'Pago no está aprobado');
  try {
    await encenderMotoIfMora(pago);
    ok(res, {msg:'Comando de encendido procesado (si correspondía)'}, 'Webhook procesado');
  } catch (e) {
    // Registrar log de error
    const log = { id: id('log'), nivel: 'ERROR', mensaje: `Error en webhook pago-aprobado para pago ${pagoId}: ${e.message}`, timestamp: new Date().toISOString() };
    db.logs.push(log);
    fail(res, 500, 'Error procesando encendido');
  }
});
app.post('/api/motocicletas/:id/gps/encender', authenticate, authorize('admin'), (req,res)=>setGps(req,res,'encendido').catch(e=>fail(res,e.message==='MOTO_NOT_FOUND'?404:409,e.message==='GPS_NO_SIGNAL'?'La motocicleta no tiene señal GPS':e.message)));
app.post('/api/motocicletas/:id/gps/apagar', authenticate, authorize('admin'), (req,res)=>setGps(req,res,'apagado').catch(e=>fail(res,e.message==='MOTO_NOT_FOUND'?404:409,e.message)));

// ───────────────────────────── MANUAL PAYMENT VERIFICATION ──────────────────────────────
app.get('/api/pagos/pendientes', authenticate, authorize('admin'), (req, res) => {
  const db = readDb();
  const pending = db.pagos.filter(p => p.estado === 'PENDIENTE');
  ok(res, pending);
});



app.patch('/api/pagos/:id/rechazar', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const { razon } = req.body;
  const db = readDb();
  const pago = db.pagos.find(p => p.id === id);
  if (!pago) return fail(res, 404, 'Pago no encontrado');
  if (pago.estado !== 'PENDIENTE') return fail(res, 400, 'Pago no está pendiente');
  pago.estado = 'RECHAZADO';
  if (razon) pago.razonRechazo = razon;
  ok(res, pago, 'Pago rechazado');
});

// ───────────────────────────── ALERTAS ADMINISTRATIVAS ──────────────────────────────
// Listar alertas pendientes (solo admin)
app.get('/api/alertas/pending', authenticate, authorize('admin'), (req, res) => {
  const db = readDb();
  const pending = (db.alertas || []).filter(a => !a.atendida);
  ok(res, pending);
});

// Marcar alerta como atendida
app.patch('/api/alertas/:id/resolver', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const alerta = db.alertas.find(a => a.id === id);
  if (!alerta) return fail(res, 404, 'Alerta no encontrada');
  alerta.atendida = true;
  alerta.atendidaEn = new Date().toISOString();
  ok(res, alerta, 'Alerta marcada como atendida');
});

// Mantener rutas existentes de desactivación para compatibilidad
// ───────────────────────────── DESACTIVACIONES ──────────────────────────────
app.get('/api/alertas/desactivacion', authenticate, authorize('admin'), (req,res)=>{
  const db=readDb(); const data=db.alertas.filter(a=>!a.atendida).map(a=>({...a,cliente:db.clientes.find(c=>c.id===a.clienteId),motocicleta:db.motocicletas.find(m=>m.id===a.motocicletaId)})); ok(res,data);
});
app.post('/api/alertas/:id/desactivar', authenticate, authorize('admin'), (req,res)=>{
  const result=updateDb(db=>{ const a=db.alertas.find(x=>x.id===req.params.id); if(!a) throw new Error('ALERT_NOT_FOUND'); const moto=db.motocicletas.find(m=>m.id===a.motocicletaId); if(!moto) throw new Error('MOTO_NOT_FOUND'); moto.estadoGPS='apagado'; a.atendida=true; a.atendidaEn=new Date().toISOString(); const command={id:id('gps'),motocicletaId:moto.id,accion:'apagar',solicitadoPor:req.user.id,timestamp:new Date().toISOString(),resultado:'exitoso'}; db.comandosGPS.push(command); return {alerta:a,motocicleta:moto,command}; }); ok(res,result,'Motocicleta desactivada');
});

// ───────────────────────────── NOTIFICACIONES / JOBS ────────────────────────
app.get('/api/notificaciones', authenticate, (req,res)=>{
  const db=readDb(); const clienteId=req.user.rol==='rider'?req.user.clienteId:req.query.clienteId; ok(res,db.notificaciones.filter(n=>!clienteId||n.clienteId===clienteId));
});
app.get('/api/notificaciones/cliente/:clienteId', authenticate, (req, res) => {
  if (req.user.rol === 'rider' && req.user.clienteId !== req.params.clienteId) return fail(res, 403, 'No autorizado');
  const db = readDb();
  const notificaciones = (db.notificaciones || []).filter(n => n.clienteId === req.params.clienteId);
  ok(res, notificaciones);
});
app.post('/api/jobs/cobro-automatico', authenticate, authorize('admin'), async (req, res) => {
  try {
    const fecha = req.body?.fecha || req.query?.fecha || null;
    const resultado = await processAutomaticCollection(fecha);
    ok(res, resultado, 'Proceso de cobro automático ejecutado correctamente');
  } catch (err) {
    fail(res, 500, err.message);
  }
});
app.post('/api/jobs/run', authenticate, authorize('admin'), async (_req,res)=>ok(res,await runJobs(),'Procesos automáticos ejecutados'));

// ───────────────────────────── REPORTES FINANCIEROS ─────────────────────────
app.get('/api/reportes/financiero', authenticate, authorize('admin'), (req, res) => {
  try {
    const { fechaInicio, fechaFin, periodo } = req.query;
    if (!fechaInicio || !fechaFin) {
      return fail(res, 400, 'Las fechas de inicio y fin son obligatorias');
    }
    const db = readDb();
    const reporte = generarReporteFinanciero(db, { fechaInicio, fechaFin, periodo });
    return ok(res, reporte, 'Reporte financiero generado');
  } catch (err) {
    return fail(res, 400, err.message);
  }
});

app.get('/api/reportes/financiero/pdf', authenticate, authorize('admin'), (req, res) => {
  try {
    const { fechaInicio, fechaFin, periodo } = req.query;
    if (!fechaInicio || !fechaFin) {
      return fail(res, 400, 'Las fechas de inicio y fin son obligatorias');
    }
    const db = readDb();
    const reporte = generarReporteFinanciero(db, { fechaInicio, fechaFin, periodo });
    exportarReportePDF(reporte, res);
  } catch (err) {
    return fail(res, 400, err.message);
  }
});

app.get('/api/reportes/financiero/excel', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { fechaInicio, fechaFin, periodo } = req.query;
    if (!fechaInicio || !fechaFin) {
      return fail(res, 400, 'Las fechas de inicio y fin son obligatorias');
    }
    const db = readDb();
    const reporte = generarReporteFinanciero(db, { fechaInicio, fechaFin, periodo });
    await exportarReporteExcel(reporte, res);
  } catch (err) {
    return fail(res, 400, err.message);
  }
});

app.get('/', (_req, res) => res.json({
  ok: true,
  message: 'MotoLeasing Backend funcionando correctamente',
  api: '/api',
  health: '/api/health'
}));

app.get('/api', (_req, res) => res.json({
  ok: true,
  message: 'MotoLeasing API funcionando correctamente',
  health: '/api/health'
}));

app.get('/api/health', (_req,res)=>ok(res,{status:'ok',service:'motoleasing-backend',timestamp:new Date().toISOString()}));
const BUSINESS_ERRORS = {
  EMAIL_EXISTS: [409, 'Ya existe un cliente registrado con ese correo'],
  DOC_EXISTS: [409, 'Ya existe un cliente registrado con ese documento'],
  PLATE_EXISTS: [409, 'Ya existe una motocicleta registrada con esa placa'],
  GPS_EXISTS: [409, 'Ese dispositivo GPS ya está asignado a otra motocicleta'],
  FEE_EXISTS: [409, 'Ya existe una cuota con ese número para este contrato'],
  CONTRACT_NOT_FOUND: [404, 'Contrato no encontrado'],
  INVALID_AMOUNT: [400, 'El monto debe ser un número mayor que cero'],
};
app.use((err,_req,res,_next)=>{ console.error(err); if(err instanceof multer.MulterError) return fail(res,400,err.code==='LIMIT_FILE_SIZE'?'El comprobante no puede superar los 5 MB':'El archivo del comprobante no es válido'); if(err.message==='INVALID_FILE_TYPE') return fail(res,400,'El comprobante debe ser un archivo PDF, JPG o PNG'); const known=BUSINESS_ERRORS[err.message]; if(known) return fail(res,known[0],known[1]); fail(res,500,'Error interno del servidor'); });

app.listen(PORT, async ()=>{ console.log(`MotoLeasing API escuchando en http://localhost:${PORT}`); try { if (readDb().usuarios.length === 0) await seed(); console.log('Jobs iniciales:', await runJobs()); } catch(e){ console.error('No se pudieron ejecutar jobs iniciales:',e.message); } });
setInterval(()=>runJobs().catch(e=>console.error('Job automático:',e.message)), 60*60*1000);
// ───────────────────────────── SCHEDULE CRON ───────────────────────────────────
// Notificación automática de cobro según configuración guardada
const cron = require('node-cron');
let notificationTask = null;
function scheduleNotificationCron() {
  const cfg = readDb().configuracion_notificacion?.[0] || { diaSemana: 0, hora: 0 };
  const expr = `${cfg.hora} ${cfg.diaSemana} * * *`;
  if (notificationTask) notificationTask.stop();
  notificationTask = cron.schedule(expr, async () => {
    console.log('Ejecutando proceso automático de cobro (cron) – configurado');
    try { await processAutomaticCollection(); console.log('Proceso automático de cobro completado'); }
    catch (err) { console.error('Error en proceso automático de cobro (cron):', err); }
  });
}
// inicializar al levantar el servidor
scheduleNotificationCron();
