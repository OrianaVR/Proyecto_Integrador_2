require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { readDb, updateDb, ensureDb } = require('./db');
const { signToken, authenticate, authorize } = require('./auth');
const { id, calculateScore } = require('./utils');
const { createNotification, CANALES, estadoProveedores } = require('./notifications');
const { runJobs, processAutomaticCollection } = require('./jobs');
const { seed } = require('./seed');
const { generarReporteFinanciero, exportarReportePDF, exportarReporteExcel } = require('./reports');
const { ESTADOS, ESTADO_EXITOSO, ESTADO_LABEL, simulacionPasarela, referenciaCuota, cuotaDeReferencia, firmaValida, construirEvento, confirmarConPasarela } = require('./pasarela');

ensureDb();
const app = express();
const PORT = Number(process.env.PORT || 3001);
const uploadDir = process.env.MOTOLEASING_UPLOAD_DIR
  ? path.resolve(process.env.MOTOLEASING_UPLOAD_DIR)
  : path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const upload = multer({ storage, defParamCharset: 'utf8', limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => ALLOWED_TYPES.includes(file.mimetype) ? cb(null, true) : cb(new Error('INVALID_FILE_TYPE')) });

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
  return { cliente, motocicleta, contrato, score, diasMora, proximaCuota, historial: cuotas.map(c => ({ cuotaId:c.id, numeroCuota:c.numeroCuota, monto:c.monto, montoBase:c.montoBase, montoMultas:c.montoMultas, montoExcedentes:c.montoExcedentes, fechaVencimiento:c.fechaVencimiento, fechaPago:c.fechaPago, estado:c.estado, diasDiferencia:c.fechaPago ? Math.round((new Date(c.fechaPago)-new Date(c.fechaVencimiento))/86400000) : c.diasMorosidad || 0 })), multas: (db.multas || []).filter(m => m.clienteId === clienteId), cargos: (db.cargos || []).filter(c => c.clienteId === clienteId) };
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

// HU-04: canal de notificación preferido del cliente (null = usa el canal por defecto de la configuración general)
app.patch('/api/clientes/:id/canal', authenticate, authorize('admin'), (req,res)=>{
  const canal=req.body.canal ?? null;
  if(canal!==null && !CANALES.includes(canal)) return fail(res,400,'El canal debe ser whatsapp, sms o email');
  const db=readDb(); if(!db.clientes.some(c=>c.id===req.params.id)) return fail(res,404,'Cliente no encontrado');
  const cliente=updateDb(db=>{ const c=db.clientes.find(x=>x.id===req.params.id); c.canalPreferido=canal; return c; });
  ok(res,cliente,'Canal de notificación actualizado');
});

const DOCUMENT_KEYS = ['cedula', 'contrato_firmado', 'soat', 'tecnomecanica', 'tarjeta_propiedad', 'licencia'];

function discardUploads(req) {
  for (const file of Object.values(req.files || {}).flat()) fs.rmSync(file.path, { force: true });
}

app.post('/api/clientes', authenticate, authorize('admin'), upload.fields(DOCUMENT_KEYS.map(name => ({ name, maxCount: 1 }))), async (req,res)=>{
  const body=req.body; const missing=validateRequired(body,['nombre','apellido','email','telefono','documentoId','plataforma','ciudad','marca','modelo','año','placa','numeroSerie','color','montoSemanal','cuotasTotales','fechaInicio','fechaFin']); if(missing) { discardUploads(req); return fail(res,400,`El campo ${missing} es obligatorio`); }
  // Contraseña inicial del rider: su número de documento
  const passwordHash=await bcrypt.hash(String(body.documentoId),12);
  let result;
  try { result=updateDb(db=>{
    if(db.clientes.some(c=>c.email.toLowerCase()===String(body.email).toLowerCase()) || db.usuarios.some(u=>u.email.toLowerCase()===String(body.email).toLowerCase())) throw new Error('EMAIL_EXISTS');
    if(db.clientes.some(c=>c.documentoId===String(body.documentoId))) throw new Error('DOC_EXISTS');
    if(db.motocicletas.some(m=>m.placa===String(body.placa).toUpperCase())) throw new Error('PLATE_EXISTS');
    if(body.dispositivoGPS && db.motocicletas.some(m=>m.dispositivoGPS===String(body.dispositivoGPS))) throw new Error('GPS_EXISTS');
    const clienteId=id('c'), motoId=id('m'), contratoId=id('ct');
    const cliente={id:clienteId,nombre:body.nombre,apellido:body.apellido,email:body.email,telefono:body.telefono,documentoId:String(body.documentoId),plataforma:body.plataforma,fechaRegistro:new Date().toISOString().slice(0,10),rol:'rider',activo:true,ciudad:body.ciudad,canalPreferido:CANALES.includes(body.canalPreferido)?body.canalPreferido:null};
    const moto={id:motoId,marca:body.marca,modelo:body.modelo,año:Number(body.año),placa:String(body.placa).toUpperCase(),numeroSerie:body.numeroSerie,color:body.color,estadoGPS:'apagado',dispositivoGPS:body.dispositivoGPS||null,disponible:true,clienteId:clienteId,creadoEn:new Date().toISOString(),vencimientoSOAT:body.vencimientoSOAT||null,vencimientoTecno:body.vencimientoTecno||null,documentos:[]};
    for (const [tipo, [file]] of Object.entries(req.files || {})) moto.documentos.push({id:id('doc'),motocicletaId:motoId,tipo,nombre:file.originalname,url:`/uploads/${file.filename}`,fechaSubida:new Date().toISOString(),subidoPor:req.user.id});
    const monto=Number(body.montoSemanal), cuotas=Number(body.cuotasTotales), total=monto*cuotas;
    const contrato={id:contratoId,clienteId,motocicletaId:motoId,estado:'activo',fechaInicio:body.fechaInicio,fechaFin:body.fechaFin,montoSemanal:monto,totalContrato:total,saldoPendiente:total,cuotasTotales:cuotas,cuotasPagadas:0,observaciones:body.observaciones||null,creadoEn:new Date().toISOString(),actualizadoEn:new Date().toISOString()};
    db.clientes.push(cliente); db.motocicletas.push(moto); db.contratos.push(contrato);
    db.scores.push({...calculateScore([]),clienteId,cuotasPagadas:0,cuotasTotales:cuotas,ultimaActualizacion:new Date().toISOString().slice(0,10)});
    db.usuarios.push({id:id('user'),email:body.email,passwordHash,rol:'rider',clienteId,activo:true});
    return {cliente,moto,contrato};
  }); } catch (e) { discardUploads(req); throw e; }
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
    // Desglose (HU-02): el formulario envía montoBase, multas y excedentes
    const cuota={id:id('cuota'),contratoId,numeroCuota:Number(numeroCuota),monto:Number(monto),montoBase:Number(req.body.montoBase ?? monto),montoMultas:Number(req.body.multas ?? req.body.montoMultas ?? 0),montoExcedentes:Number(req.body.excedentes ?? req.body.montoExcedentes ?? 0),fechaVencimiento,fechaPago:null,estado:'pendiente',diasMorosidad:0,referencia:null}; db.cuotas.push(cuota); // Una cuota dentro del plazo del contrato ya está incluida en el total (por montoSemanal): solo se suma la diferencia
    const incluido=Number(numeroCuota)<=contrato.cuotasTotales?contrato.montoSemanal:0, diferencia=Number(monto)-incluido; contrato.cuotasTotales=Math.max(contrato.cuotasTotales,Number(numeroCuota)); contrato.totalContrato += diferencia; contrato.saldoPendiente += diferencia; contrato.actualizadoEn=new Date().toISOString(); return cuota;
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
    // El contrato (si se indica) debe ser del mismo cliente; si no, el saldo no se actualizaría
    if (contratoId && !db.contratos.some(c => c.id === contratoId && c.clienteId === clienteId)) throw new Error('CONTRACT_NOT_FOUND');
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
  const existente = db.multas.find(m => m.id === id);
  if (!existente) return fail(res, 404, 'Multa no encontrada');
  if (existente.pagada) return fail(res, 400, 'Multa ya está pagada');
  const multa = updateDb(db => {
    const multa = db.multas.find(m => m.id === id);
    // Ajustar saldo pendiente del contrato si está asociado
    if (multa.contratoId) {
      const contrato = db.contratos.find(c => c.id === multa.contratoId);
      if (contrato) {
        contrato.saldoPendiente = Math.max(0, Number(contrato.saldoPendiente) - Number(multa.monto));
      }
    }
    multa.pagada = true;
    return multa;
  });
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
    // El contrato (si se indica) debe ser del mismo cliente; si no, el saldo no se actualizaría
    if (contratoId && !db.contratos.some(c => c.id === contratoId && c.clienteId === clienteId)) throw new Error('CONTRACT_NOT_FOUND');
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
  const existente = db.cargos.find(c => c.id === id);
  if (!existente) return fail(res, 404, 'Cargo no encontrado');
  if (existente.pagada) return fail(res, 400, 'Cargo ya está pagado');
  const cargo = updateDb(db => {
    const cargo = db.cargos.find(c => c.id === id);
    if (cargo.contratoId) {
      const contrato = db.contratos.find(c => c.id === cargo.contratoId);
      if (contrato) contrato.saldoPendiente = Math.max(0, Number(contrato.saldoPendiente) - Number(cargo.monto));
    }
    cargo.pagada = true;
    return cargo;
  });
  ok(res, cargo, 'Cargo marcado como pagado');
});

// ───────────────────────────── MANUAL PAYMENT VERIFICATION ──────────────────────────────
app.get('/api/pagos/pendientes', authenticate, authorize('admin'), (req, res) => {
  const db = readDb();
  // Se incluyen cliente, moto y cuota para mostrarlos en la pantalla de verificación (HU-15); el más antiguo primero
  const pending = db.pagos
    .filter(p => p.estado === 'PENDIENTE')
    .sort((a, b) => a.fechaPago.localeCompare(b.fechaPago))
    .map(p => {
      const contrato = db.contratos.find(c => c.id === p.contratoId);
      return {
        ...p,
        cliente: db.clientes.find(c => c.id === p.clienteId) || null,
        motocicleta: contrato ? db.motocicletas.find(m => m.id === contrato.motocicletaId) || null : null,
        cuota: p.cuotaId ? db.cuotas.find(c => c.id === p.cuotaId) || null : null,
      };
    });
  ok(res, pending);
});

app.patch('/api/pagos/:id/aprobar', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const db = readDb();
  const pago = db.pagos.find(p => p.id === id);
  if (!pago) return fail(res, 404, 'Pago no encontrado');
  if (pago.estado !== 'PENDIENTE') return fail(res, 400, 'Pago no está pendiente');
  // El saldo, la cuota y el score ya se actualizaron al registrar el pago (POST /api/pagos): aquí solo se confirma
  const aprobado = updateDb(db => {
    const pago = db.pagos.find(p => p.id === id);
    pago.estado = 'APROBADO';
    return pago;
  });
  await encenderMotoIfMora(aprobado);
  ok(res, aprobado, 'Pago aprobado');
});

app.patch('/api/pagos/:id/rechazar', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const { razon } = req.body;
  const db = readDb();
  const existente = db.pagos.find(p => p.id === id);
  if (!existente) return fail(res, 404, 'Pago no encontrado');
  if (existente.estado !== 'PENDIENTE') return fail(res, 400, 'Pago no está pendiente');
  const pago = updateDb(db => {
    const pago = db.pagos.find(p => p.id === id);
    pago.estado = 'RECHAZADO';
    if (razon) pago.razonRechazo = razon;
    // El pago se aplicó al registrarlo: al rechazarlo se revierte (saldo, cuota y score)
    const contrato = db.contratos.find(c => c.id === pago.contratoId);
    if (contrato) {
      contrato.saldoPendiente = Number(contrato.saldoPendiente) + Number(pago.monto);
      const cuota = pago.cuotaId ? db.cuotas.find(c => c.id === pago.cuotaId) : null;
      if (cuota && cuota.estado === 'pagado') {
        cuota.estado = new Date(`${cuota.fechaVencimiento}T23:59:59`) < new Date() ? 'vencido' : 'pendiente';
        cuota.fechaPago = null;
        contrato.cuotasPagadas = Math.max(0, contrato.cuotasPagadas - 1);
      }
      contrato.actualizadoEn = new Date().toISOString();
      const cuotas=db.cuotas.filter(c=>c.contratoId===contrato.id); const score=calculateScore(cuotas); const old=db.scores.find(s=>s.clienteId===contrato.clienteId); db.scores=db.scores.filter(s=>s.clienteId!==contrato.clienteId); db.scores.push({...old,...score,clienteId:contrato.clienteId,cuotasPagadas:contrato.cuotasPagadas,cuotasTotales:contrato.cuotasTotales,ultimaActualizacion:new Date().toISOString().slice(0,10)});
    }
    return pago;
  });
  ok(res, pago, 'Pago rechazado');
});

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
    // Simular llamada al proveedor GPS (still unavailable) y persistir los cambios
    const contrato = updateDb(db => {
      const moto = db.motocicletas.find(m => m.id === motoId);
      moto.estadoGPS = 'encendido';
      moto.actualizadoEn = new Date().toISOString();
      const command = { id: id('gps'), motocicletaId: moto.id, accion: 'encender', solicitadoPor: 'system-auto', timestamp: new Date().toISOString(), resultado: 'exitoso' };
      db.comandosGPS.push(command);
      return db.contratos.find(c => c.motocicletaId === moto.id);
    });
    // Notificar al cliente
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
    return;
  } catch (e) {
    // Log error
    const log = { id: id('log'), nivel: 'ERROR', mensaje: `Error al encender moto ${motoId}: ${e.message}`, timestamp: new Date().toISOString() };
    updateDb(db => { db.logs.push(log); });
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
  // HU-20: una sola alerta abierta por moto y tipo de fallo (no se duplica en cada reintento)
  const abierta = (db.alertas || []).find(a => a.motocicletaId === motoId && a.tipo === tipo && !a.atendida);
  if (abierta) return abierta;
  const alerta = {
    id: id('alerta'),
    clienteId,
    motoId,
    motocicletaId: motoId,
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
  // El webhook no usa JWT: se protege con una clave compartida (header x-webhook-secret = WEBHOOK_SECRET del .env)
  if (!process.env.WEBHOOK_SECRET) return fail(res, 503, 'El webhook no está configurado');
  if (req.get('x-webhook-secret') !== process.env.WEBHOOK_SECRET) return fail(res, 401, 'Webhook no autorizado');
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
    updateDb(db => { db.logs.push(log); });
    fail(res, 500, 'Error procesando encendido');
  }
});
// ───────────────────────── HU-14 VERIFICACIÓN AUTOMÁTICA (PASARELA) ─────────────────────────
/**
 * Concilia una transacción de la pasarela contra la cuota y el saldo pendiente del cliente.
 * APLICADO: pago aprobado y aplicado (cuota pagada, saldo descontado, score actualizado).
 * RECHAZADA: la entidad bancaria rechazó/anuló la transacción → el saldo no cambia.
 * NO_ENCONTRADA: la referencia o la transacción no existen → el saldo no cambia.
 * REVISION: aprobada pero el monto no coincide o la cuota ya estaba pagada → la revisa el admin.
 */
async function conciliarTransaccion(tx) {
  const estado = String(tx.status || '').toUpperCase();
  const registro = updateDb(db => {
    if (!db.transacciones_pasarela) db.transacciones_pasarela = [];
    const previa = db.transacciones_pasarela.find(t => t.transaccionId === tx.id);
    // La pasarela puede reenviar el mismo evento: no se aplica dos veces
    if (previa && (previa.estado === estado || previa.resultado === 'APLICADO')) return { ...previa, duplicada: true };

    const monto = Number(tx.amount_in_cents) / 100;
    const noEncontrada = estado === 'NOT_FOUND';
    const cuota = noEncontrada ? null : cuotaDeReferencia(db.cuotas, tx.reference);
    const contrato = cuota ? db.contratos.find(c => c.id === cuota.contratoId) : null;
    const reg = {
      id: previa?.id || id('tx'), transaccionId: tx.id, referencia: tx.reference || null, estado, monto,
      metodo: tx.payment_method_type || null, cuotaId: cuota?.id || null, numeroCuota: cuota?.numeroCuota ?? null,
      contratoId: contrato?.id || null, clienteId: contrato?.clienteId || null, pagoId: null,
      resultado: '', mensaje: '', alDia: false, fecha: new Date().toISOString(),
    };

    if (noEncontrada) {
      reg.resultado = 'NO_ENCONTRADA'; reg.mensaje = 'La pasarela no encontró la transacción: el saldo pendiente se mantiene';
    } else if (!cuota || !contrato) {
      reg.resultado = 'NO_ENCONTRADA'; reg.mensaje = 'La referencia de pago no corresponde a ninguna cuota: el saldo pendiente se mantiene';
    } else if (estado !== ESTADO_EXITOSO) {
      reg.resultado = 'RECHAZADA'; reg.mensaje = `Transacción ${ESTADO_LABEL[estado] || estado.toLowerCase()} por la entidad bancaria: el saldo pendiente se mantiene`;
    } else if (cuota.estado === 'pagado') {
      reg.resultado = 'REVISION'; reg.mensaje = `La cuota #${cuota.numeroCuota} ya estaba pagada: revisa si es un pago duplicado`;
    } else if (monto !== Number(cuota.monto)) {
      reg.resultado = 'REVISION'; reg.mensaje = `El monto recibido ($${monto.toLocaleString('es-CO')}) no coincide con la cuota #${cuota.numeroCuota} ($${Number(cuota.monto).toLocaleString('es-CO')})`;
    } else {
      const fechaPago = new Date().toISOString();
      const pago = { id: id('pago'), contratoId: contrato.id, cuotaId: cuota.id, clienteId: contrato.clienteId, monto, metodoPago: 'pasarela', referencia: tx.id, comprobante: null, registradoPor: 'pasarela', fechaPago, notas: `Verificado automáticamente (referencia ${tx.reference})`, estado: 'APROBADO' };
      db.pagos.push(pago);
      cuota.estado = 'pagado'; cuota.fechaPago = fechaPago.slice(0, 10); cuota.diasMorosidad = 0; cuota.referencia = tx.id;
      contrato.cuotasPagadas = Math.min(contrato.cuotasTotales, contrato.cuotasPagadas + 1);
      contrato.saldoPendiente = Math.max(0, contrato.saldoPendiente - monto); contrato.actualizadoEn = fechaPago;
      const cuotas = db.cuotas.filter(c => c.contratoId === contrato.id); const score = calculateScore(cuotas); const old = db.scores.find(s => s.clienteId === contrato.clienteId); db.scores = db.scores.filter(s => s.clienteId !== contrato.clienteId); db.scores.push({ ...old, ...score, clienteId: contrato.clienteId, cuotasPagadas: contrato.cuotasPagadas, cuotasTotales: contrato.cuotasTotales, ultimaActualizacion: fechaPago.slice(0, 10) });
      reg.pagoId = pago.id; reg.resultado = 'APLICADO';
      reg.alDia = !cuotas.some(c => c.estado === 'vencido');
      reg.mensaje = reg.alDia ? 'Pago verificado y aplicado: el cliente quedó al día' : 'Pago verificado y aplicado: el cliente aún tiene cuotas vencidas';
    }

    if (reg.resultado !== 'APLICADO') {
      db.logs.push({ id: id('log'), nivel: 'WARN', mensaje: `Pasarela ${tx.id} (${tx.reference || 'sin referencia'}): ${reg.mensaje}`, timestamp: reg.fecha });
      db.notificaciones.push({ id: id('not'), clienteId: null, destinatario: 'admin', tipo: 'fallo_pago', titulo: reg.resultado === 'REVISION' ? 'Pago por pasarela requiere revisión' : 'Falló una transacción de la pasarela', mensaje: reg.mensaje, contratoId: reg.contratoId, cuotaId: reg.cuotaId, canal: 'sistema', estado: 'pendiente', fecha: reg.fecha });
    }
    db.transacciones_pasarela = db.transacciones_pasarela.filter(t => t.transaccionId !== tx.id);
    db.transacciones_pasarela.push(reg);
    return reg;
  });
  if (registro.duplicada) return registro;

  if (registro.resultado === 'APLICADO') {
    await createNotification({ clienteId: registro.clienteId, contratoId: registro.contratoId, cuotaId: registro.cuotaId, tipo: 'pago', monto: registro.monto, titulo: 'Pago confirmado', mensaje: `Recibimos tu pago de $${registro.monto.toLocaleString('es-CO')} de la cuota #${registro.numeroCuota}.${registro.alDia ? ' Tu cuenta está al día.' : ''}` });
    // Habilitación: si ya no tiene cuotas vencidas, se reactiva la moto apagada por mora
    if (registro.alDia) await encenderMotoIfMora({ contratoId: registro.contratoId });
  } else if (registro.resultado === 'RECHAZADA' && registro.clienteId) {
    await createNotification({ clienteId: registro.clienteId, contratoId: registro.contratoId, cuotaId: registro.cuotaId, tipo: 'pago_fallido', monto: registro.monto, titulo: 'Tu pago no fue aprobado', mensaje: `La transacción de $${registro.monto.toLocaleString('es-CO')} de la cuota #${registro.numeroCuota} fue ${ESTADO_LABEL[registro.estado] || 'rechazada'} por tu banco. Tu saldo pendiente no cambió; intenta pagar de nuevo.` });
  }
  return registro;
}

/** Valida el evento de la pasarela y concilia la transacción */
async function procesarEventoPasarela(evento) {
  const tx = evento?.data?.transaction;
  if (!tx?.id) throw new Error('PASARELA_EVENTO_INVALIDO');
  if (!firmaValida(evento)) throw new Error('PASARELA_FIRMA_INVALIDA');
  if (evento.event !== 'transaction.updated' || String(tx.status).toUpperCase() === 'PENDING') return { ignorado: true, transaccionId: tx.id };
  // Si hay API de la pasarela configurada, se confirma la transacción con ella (no se confía solo en el evento)
  const confirmada = await confirmarConPasarela(tx);
  if (!confirmada) return conciliarTransaccion({ ...tx, status: 'NOT_FOUND' });
  return conciliarTransaccion({ ...tx, status: confirmada.status, amount_in_cents: confirmada.amount_in_cents, reference: confirmada.reference });
}

// Webhook que llama la pasarela (no usa JWT: se valida con la firma del evento)
app.post('/api/webhooks/pasarela', async (req, res) => {
  // El secreto de sandbox es público (está en el código): el webhook externo exige el secreto real del .env
  if (!process.env.PASARELA_EVENTS_SECRET) return fail(res, 503, 'La pasarela de pagos no está configurada');
  const resultado = await procesarEventoPasarela(req.body);
  ok(res, resultado, resultado.ignorado ? 'Evento recibido sin cambios' : resultado.mensaje);
});

// Sandbox local: simula la respuesta de la pasarela para una cuota (solo en modo simulación)
app.post('/api/pagos/pasarela/simular', authenticate, authorize('admin'), async (req, res) => {
  if (!simulacionPasarela()) return fail(res, 403, 'La simulación de la pasarela está desactivada');
  const { cuotaId, estado = 'APPROVED', monto, referencia } = req.body;
  if (!ESTADOS.includes(estado)) return fail(res, 400, 'Estado de transacción no válido');
  const cuota = cuotaId ? readDb().cuotas.find(c => c.id === cuotaId) : null;
  if (cuotaId && !cuota) return fail(res, 404, 'Cuota no encontrada');
  const valor = monto !== undefined ? Number(monto) : Number(cuota?.monto);
  if (!Number.isFinite(valor) || valor <= 0) return fail(res, 400, 'El monto debe ser un número mayor que cero');
  const evento = construirEvento({ id: `sim-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, reference: referencia || (cuota ? referenciaCuota(cuota.id) : ''), status: estado, amount_in_cents: Math.round(valor * 100), currency: 'COP', payment_method_type: 'PSE' });
  const resultado = await procesarEventoPasarela(evento);
  ok(res, resultado, resultado.mensaje);
});

app.get('/api/pagos/pasarela/transacciones', authenticate, authorize('admin'), (req, res) => {
  const db = readDb();
  const lista = (db.transacciones_pasarela || [])
    .filter(t => !req.query.clienteId || t.clienteId === req.query.clienteId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .map(t => ({ ...t, cliente: db.clientes.find(c => c.id === t.clienteId) || null }));
  ok(res, { simulacion: simulacionPasarela(), transacciones: lista });
});

// HU-20: si el comando manual falla por falta de señal, se registra una alerta de fallo para el admin
async function falloControlGps(req,res,accion,e){
  if(e.message==='MOTO_NOT_FOUND') return fail(res,404,'Motocicleta no encontrada');
  if(e.message==='GPS_NO_SIGNAL'){
    const moto=readDb().motocicletas.find(m=>m.id===req.params.id);
    await crearAlertaFallo({ clienteId: moto?.clienteId || null, motoId: req.params.id, tipo: accion, error: 'GPS_NO_SIGNAL' });
    return fail(res,409,'La motocicleta no tiene señal GPS. Se registró una alerta de fallo.');
  }
  return fail(res,409,e.message);
}
app.post('/api/motocicletas/:id/gps/encender', authenticate, authorize('admin'), (req,res)=>setGps(req,res,'encendido').catch(e=>falloControlGps(req,res,'encendido',e)));
app.post('/api/motocicletas/:id/gps/apagar', authenticate, authorize('admin'), (req,res)=>setGps(req,res,'apagado').catch(e=>falloControlGps(req,res,'apagado',e)));

// ───────────────────────────── ALERTAS ADMINISTRATIVAS ──────────────────────────────
// Listar alertas pendientes (solo admin)
app.get('/api/alertas/pending', authenticate, authorize('admin'), (req, res) => {
  const db = readDb();
  const pending = (db.alertas || []).filter(a => !a.atendida);
  ok(res, pending);
});

// HU-20: fallos del control remoto (las alertas de fallo tienen `tipo`; las de desactivación tienen `motivo`), la más reciente primero
app.get('/api/alertas/fallos', authenticate, authorize('admin'), (req, res) => {
  const db = readDb();
  const fallos = (db.alertas || [])
    .filter(a => a.tipo && !a.atendida)
    .sort((a, b) => String(b.creadoEn).localeCompare(String(a.creadoEn)))
    .map(a => ({ ...a, cliente: db.clientes.find(c => c.id === a.clienteId) || null, motocicleta: db.motocicletas.find(m => m.id === a.motocicletaId) || null }));
  ok(res, fallos);
});

// Marcar alerta como atendida
app.patch('/api/alertas/:id/resolver', authenticate, authorize('admin'), (req, res) => {
  const { id } = req.params;
  const db = readDb();
  if (!db.alertas.some(a => a.id === id)) return fail(res, 404, 'Alerta no encontrada');
  const alerta = updateDb(db => {
    const alerta = db.alertas.find(a => a.id === id);
    alerta.atendida = true;
    alerta.atendidaEn = new Date().toISOString();
    return alerta;
  });
  ok(res, alerta, 'Alerta marcada como atendida');
});

// Mantener rutas existentes de desactivación para compatibilidad
// ───────────────────────────── DESACTIVACIONES ──────────────────────────────
app.get('/api/alertas/desactivacion', authenticate, authorize('admin'), (req,res)=>{
  // Solo alertas de desactivación (las de fallo GPS no tienen motivo y se listan en /api/alertas/pending)
  const db=readDb(); const data=db.alertas.filter(a=>!a.atendida && a.motivo).map(a=>({...a,cliente:db.clientes.find(c=>c.id===a.clienteId),motocicleta:db.motocicletas.find(m=>m.id===a.motocicletaId)})); ok(res,data);
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
    // Sin fecha, se toman las cuotas que vencen hoy en Colombia (HU-03)
    const fecha = req.body?.fecha || req.query?.fecha || fechaColombia();
    const resultado = await processAutomaticCollection(fecha);
    ok(res, resultado, 'Proceso de cobro automático ejecutado correctamente');
  } catch (err) {
    fail(res, 500, err.message);
  }
});
app.post('/api/jobs/run', authenticate, authorize('admin'), async (_req,res)=>ok(res,await runJobs(),'Procesos automáticos ejecutados'));

// ───────────────────────────── CONFIGURACIÓN GENERAL DE NOTIFICACIONES (HU-04) ─────────────────
function configNotificaciones(db) {
  const cfg = db.configuracion_notificacion?.[0] || {};
  const p = programacion(db);
  return {
    ...cfg,
    canalPorDefecto: CANALES.includes(cfg.canalPorDefecto) ? cfg.canalPorDefecto : 'whatsapp',
    canalesHabilitados: Array.isArray(cfg.canalesHabilitados) ? cfg.canalesHabilitados : [...CANALES],
    // HU-03: programación del envío automático de cobros
    diaSemana: p.diaSemana, hora: p.hora, minuto: p.minuto, horaTexto: p.horaTexto,
    proximoEnvio: proximoEnvio(p), programacionActiva: cronActivo, zonaHoraria: ZONA_HORARIA,
  };
}

/** Crea el registro de configuración si la base aún no lo tiene */
function asegurarConfig(db) {
  if (!Array.isArray(db.configuracion_notificacion) || !db.configuracion_notificacion.length) db.configuracion_notificacion = [{ id: 'conf-1', diaSemana: 3, hora: 8, minuto: 0 }];
  return db.configuracion_notificacion[0];
}

// HU-03: día y hora del envío automático de cobros
app.put('/api/configuracion/programacion', authenticate, authorize('admin'), (req, res) => {
  const { diaSemana, hora } = req.body;
  if (hora === undefined || hora === null || String(hora).trim() === '') return fail(res, 400, 'La hora de envío es obligatoria');
  const partes = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hora).trim());
  if (!partes) return fail(res, 400, 'La hora no es válida: usa el formato HH:MM (de 00:00 a 23:59)');
  const dia = Number(diaSemana);
  if (diaSemana === undefined || diaSemana === null || String(diaSemana).trim() === '' || !Number.isInteger(dia) || dia < 0 || dia > 6) return fail(res, 400, 'El día de envío no es válido');
  updateDb(db => { Object.assign(asegurarConfig(db), { diaSemana: dia, hora: Number(partes[1]), minuto: Number(partes[2]) }); });
  // Se reprograma el cron de inmediato, sin reiniciar el servidor
  if (cronActivo) scheduleNotificationCron();
  ok(res, configNotificaciones(readDb()), 'Programación de envío actualizada');
});

app.get('/api/configuracion/notificaciones', authenticate, authorize('admin'), (_req, res) => {
  const db = readDb();
  // Últimos envíos de cobro fallidos, para que el administrador los revise
  const fallidos = (db.notificaciones || [])
    .filter(n => n.tipo === 'cobro' && n.estado === 'fallido')
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
    .slice(0, 20)
    .map(n => ({ ...n, cliente: db.clientes.find(c => c.id === n.clienteId) || null }));
  ok(res, { ...configNotificaciones(db), proveedores: estadoProveedores(), fallidos });
});

app.put('/api/configuracion/notificaciones', authenticate, authorize('admin'), (req, res) => {
  const { canalPorDefecto, canalesHabilitados } = req.body;
  if (!CANALES.includes(canalPorDefecto)) return fail(res, 400, 'El canal por defecto debe ser whatsapp, sms o email');
  if (!Array.isArray(canalesHabilitados) || canalesHabilitados.length === 0 || !canalesHabilitados.every(c => CANALES.includes(c))) return fail(res, 400, 'Selecciona al menos un canal habilitado válido');
  if (!canalesHabilitados.includes(canalPorDefecto)) return fail(res, 400, 'El canal por defecto debe estar habilitado');
  const config = updateDb(db => {
    Object.assign(asegurarConfig(db), { canalPorDefecto, canalesHabilitados: [...new Set(canalesHabilitados)] });
    return configNotificaciones(db);
  });
  ok(res, { ...config, proveedores: estadoProveedores() }, 'Configuración de notificaciones guardada');
});

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
  CLIENTE_NOT_FOUND: [404, 'Cliente no encontrado'],
  MOTO_NOT_FOUND: [404, 'Motocicleta no encontrada'],
  ALERT_NOT_FOUND: [404, 'Alerta no encontrada'],
  PASARELA_EVENTO_INVALIDO: [400, 'El evento de la pasarela no es válido'],
  PASARELA_FIRMA_INVALIDA: [401, 'La firma del evento de la pasarela no es válida'],
};
app.use((err,req,res,_next)=>{ const esDocumento=req.path==='/api/clientes'; if(err instanceof multer.MulterError||err.message==='INVALID_FILE_TYPE') discardUploads(req); if(err instanceof multer.MulterError) return fail(res,400,err.code==='LIMIT_FILE_SIZE'?(esDocumento?'Cada documento no puede superar los 5 MB':'El comprobante no puede superar los 5 MB'):(esDocumento?'Los documentos enviados no son válidos':'El archivo del comprobante no es válido')); if(err.message==='INVALID_FILE_TYPE') return fail(res,400,esDocumento?'Los documentos deben ser archivos PDF, JPG o PNG':'El comprobante debe ser un archivo PDF, JPG o PNG'); const known=BUSINESS_ERRORS[err.message]; if(known) return fail(res,known[0],known[1]); console.error(err); fail(res,500,'Error interno del servidor'); });

// ───────────────────────────── SCHEDULE CRON ───────────────────────────────────
// Notificación automática de cobro según configuración guardada (HU-03)
const cron = require('node-cron');
// El horario se interpreta en hora de Colombia aunque el servidor esté en otra zona (p. ej. UTC en la nube).
// Colombia está en UTC-5 todo el año (no tiene horario de verano).
const ZONA_HORARIA = 'America/Bogota';
const OFFSET_COLOMBIA_HORAS = 5;
let notificationTask = null;
let cronActivo = false;

const dos = n => String(n).padStart(2, '0');

/** Día (0 = domingo … 6 = sábado), hora y minuto configurados; por defecto miércoles 8:00 */
function programacion(db = readDb()) {
  const cfg = db.configuracion_notificacion?.[0] || {};
  const valido = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
  const diaSemana = valido(cfg.diaSemana, 0, 6) ? cfg.diaSemana : 3;
  const hora = valido(cfg.hora, 0, 23) ? cfg.hora : 8;
  const minuto = valido(cfg.minuto, 0, 59) ? cfg.minuto : 0;
  // Formato de node-cron: minuto hora díaDelMes mes díaDeLaSemana
  return { diaSemana, hora, minuto, horaTexto: `${dos(hora)}:${dos(minuto)}`, expresion: `${minuto} ${hora} * * ${diaSemana}` };
}

/** "Ahora" desplazado a Colombia: sus campos UTC (getUTCDay, getUTCHours…) son la fecha y hora de Colombia */
const ahoraEnColombia = () => new Date(Date.now() - OFFSET_COLOMBIA_HORAS * 3600000);
const fechaColombia = () => ahoraEnColombia().toISOString().slice(0, 10);

/** Próxima fecha y hora (ISO, UTC) en que el cron enviará los cobros */
function proximoEnvio({ diaSemana, hora, minuto }) {
  const d = ahoraEnColombia();
  let dias = (diaSemana - d.getUTCDay() + 7) % 7;
  if (dias === 0 && d.getUTCHours() * 60 + d.getUTCMinutes() >= hora * 60 + minuto) dias = 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + dias, hora + OFFSET_COLOMBIA_HORAS, minuto)).toISOString();
}

function scheduleNotificationCron() {
  const p = programacion();
  if (notificationTask) notificationTask.stop();
  notificationTask = cron.schedule(p.expresion, async () => {
    console.log('Ejecutando proceso automático de cobro (cron) – configurado');
    try { await processAutomaticCollection(fechaColombia()); console.log('Proceso automático de cobro completado'); }
    catch (err) { console.error('Error en proceso automático de cobro (cron):', err); }
  }, { timezone: ZONA_HORARIA });
  cronActivo = true;
  console.log(`Cobros programados: ${p.expresion} (${ZONA_HORARIA})`);
}

function startServer(port = PORT) {
  const server = app.listen(port, async ()=>{
    console.log(`MotoLeasing API escuchando en http://localhost:${server.address().port}`);
    try {
      if (readDb().usuarios.length === 0) await seed();
      // HU-03: los cobros no se envían al arrancar ni cada hora, solo en el día y la hora configurados
      console.log('Jobs iniciales:', await runJobs({ cobro: false }));
    } catch(e) {
      console.error('No se pudieron ejecutar jobs iniciales:',e.message);
    }
  });
  const timer = setInterval(()=>runJobs({ cobro: false }).catch(e=>console.error('Job automático:',e.message)), 60*60*1000);
  timer.unref();
  // inicializar al levantar el servidor
  scheduleNotificationCron();
  server.on('close', () => { clearInterval(timer); if (notificationTask) notificationTask.stop(); });
  return server;
}

if (require.main === module) startServer();

module.exports = { app, startServer };
