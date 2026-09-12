require('dotenv').config();
const bcrypt = require('bcryptjs');
const { writeDb, EMPTY_DB } = require('./db');

function d(date, days) { const x = new Date(date); x.setDate(x.getDate() + days); return x.toISOString().slice(0,10); }

async function seed() {
  const adminHash = await bcrypt.hash('admin123', 12);
  const riderHash = await bcrypt.hash('rider123', 12);
  const db = structuredClone(EMPTY_DB);

  db.usuarios = [
    { id: 'admin-1', email: 'admin@motoleasing.com', passwordHash: adminHash, rol: 'admin', clienteId: null, activo: true },
    { id: 'user-c1', email: 'rider@gmail.com', passwordHash: riderHash, rol: 'rider', clienteId: 'c1', activo: true },
  ];

  const clients = [
    ['c1','Andrés','Martínez','andres.m@gmail.com','3104567890','1020345678','rappi','2024-01-15','Bogotá',true],
    ['c2','Valentina','Gómez','vale.gomez@gmail.com','3157891234','1023456789','didi','2024-02-10','Medellín',true],
    ['c3','Carlos','Pérez','carlos.p@hotmail.com','3219876543','1100234567','rappi','2024-03-05','Cali',true],
    ['c4','Luisa','Rodríguez','luisa.r@gmail.com','3001234567','1045678901','uber_eats','2024-03-20','Bogotá',true],
    ['c5','Miguel','Torres','miguel.t@gmail.com','3132345678','1067890123','didi','2024-04-01','Barranquilla',true],
    ['c6','Camila','Vargas','cami.v@gmail.com','3168901234','1089012345','rappi','2024-04-15','Bogotá',false],
    ['c7','Jorge','Hernández','jorge.h@gmail.com','3174567890','1012345678','uber_eats','2024-05-01','Pereira',true],
    ['c8','Sofía','Mora','sofia.mora@gmail.com','3185678901','1034567890','rappi','2024-05-20','Bogotá',true],
  ];
  db.clientes = clients.map(([id,nombre,apellido,email,telefono,documentoId,plataforma,fechaRegistro,ciudad,activo]) => ({ id,nombre,apellido,email,telefono,documentoId,plataforma,fechaRegistro,rol:'rider',activo,ciudad }));

  const motos = [
    ['m1','Honda','CB190R',2022,'ABC123','HND2022001','Rojo','encendido','c1','2025-08-30','2026-01-15'],
    ['m2','Yamaha','FZ-S',2023,'DEF456','YMH2023002','Azul','encendido','c2','2025-12-15','2026-02-10'],
    ['m3','Suzuki','GS150',2022,'GHI789','SUZ2022003','Negro','apagado','c3','2025-09-20','2025-10-05'],
    ['m4','Honda','XRE190',2023,'JKL012','HND2023004','Blanco','encendido','c4','2026-03-20','2026-03-20'],
    ['m5','KTM','Duke 200',2023,'MNO345','KTM2023005','Naranja','apagado','c5','2025-09-10','2025-11-01'],
    ['m6','Yamaha','MT-03',2022,'PQR678','YMH2022006','Gris','sin_señal','c6','2025-07-15','2025-08-15'],
    ['m7','Honda','CB160F',2023,'STU901','HND2023007','Azul Marino','encendido','c7','2026-05-01','2026-05-01'],
    ['m8','Bajaj','Pulsar NS200',2023,'VWX234','BJJ2023008','Rojo','encendido','c8','2026-05-20','2026-05-20'],
  ];
  db.motocicletas = motos.map(([id,marca,modelo,anio,placa,numeroSerie,color,estadoGPS,clienteId,vencimientoSOAT,vencimientoTecno]) => ({ id,marca,modelo,año:anio,placa,numeroSerie,color,estadoGPS,dispositivoGPS:`GPS-${placa}`,foto:null,disponible:false,clienteId,creadoEn:'2024-01-15',vencimientoSOAT,vencimientoTecno,documentos:[] }));

  const contracts = [
    ['ct1','c1','m1','activo','2024-01-15','2024-10-15',180000,3240000,360000,18,16],
    ['ct2','c2','m2','activo','2024-02-10','2024-11-10',200000,3600000,800000,18,14],
    ['ct3','c3','m3','suspendido','2024-03-05','2024-12-05',175000,3150000,1050000,18,12],
    ['ct4','c4','m4','activo','2024-03-20','2024-12-20',190000,3420000,570000,18,15],
    ['ct5','c5','m5','suspendido','2024-04-01','2025-01-01',210000,3780000,1470000,18,11],
    ['ct6','c6','m6','suspendido','2024-04-15','2025-01-15',185000,3330000,1480000,18,10],
    ['ct7','c7','m7','activo','2024-05-01','2025-02-01',170000,3060000,850000,18,13],
    ['ct8','c8','m8','activo','2024-05-20','2025-02-20',195000,3510000,975000,18,13],
  ];
  db.contratos = contracts.map(([id,clienteId,motocicletaId,estado,fechaInicio,fechaFin,montoSemanal,totalContrato,saldoPendiente,cuotasTotales,cuotasPagadas]) => ({ id,clienteId,motocicletaId,estado,fechaInicio,fechaFin,montoSemanal,totalContrato,saldoPendiente,cuotasTotales,cuotasPagadas,observaciones:null,creadoEn:fechaInicio,actualizadoEn:'2024-09-01' }));

  const amounts = { ct1:180000,ct2:200000,ct3:175000,ct4:190000,ct5:210000,ct6:185000,ct7:170000,ct8:195000 };
  const paid = { ct1:16,ct2:14,ct3:12,ct4:15,ct5:11,ct6:10,ct7:13,ct8:13 };
  for (const c of db.contratos) {
    for (let i=1;i<=c.cuotasTotales;i++) {
      const base = new Date(c.fechaInicio); base.setDate(base.getDate() + (i-1)*7);
      const fechaVencimiento = base.toISOString().slice(0,10);
      const isPaid = i <= paid[c.id];
      db.cuotas.push({ id:`cuota-${c.id}-${i}`, contratoId:c.id, numeroCuota:i, monto:amounts[c.id], fechaVencimiento, fechaPago:isPaid ? d(fechaVencimiento, -1) : null, estado:isPaid?'pagado':'pendiente', diasMorosidad:isPaid?0:0, referencia:null });
    }
  }
  // Fechas relativas para que el backend sea demostrable al ejecutarlo en cualquier momento.
  // Las cuotas pagadas quedan históricas; la próxima cuota de cada contrato queda futura,
  // excepto c3/c5/c6, que conservan mora para demostrar HU-17.
  const today = new Date();
  for (const c of db.contratos) {
    const unpaid = db.cuotas.filter(q => q.contratoId === c.id && q.numeroCuota > paid[c.id]);
    unpaid.forEach((q, index) => { q.fechaVencimiento = d(today, 3 + index * 7); });
  }
  for (const cid of ['ct3','ct5','ct6']) {
    const cuota = db.cuotas.find(q => q.contratoId === cid && q.numeroCuota === paid[cid] + 1);
    if (cuota) {
      const mora = cid === 'ct6' ? 34 : cid === 'ct5' ? 27 : 14;
      cuota.estado = 'vencido';
      cuota.diasMorosidad = mora;
      cuota.fechaVencimiento = d(today, -mora);
    }
  }

  const scoreSeed = { c1:[92,'excelente',94,.5,'subiendo'],c2:[78,'bueno',80,2.1,'estable'],c3:[41,'malo',42,12.5,'bajando'],c4:[87,'bueno',90,1,'subiendo'],c5:[35,'malo',36,18.3,'bajando'],c6:[29,'malo',30,22,'bajando'],c7:[84,'bueno',86,1.2,'subiendo'],c8:[81,'bueno',84,1.8,'subiendo'] };
  db.scores = Object.entries(scoreSeed).map(([clienteId,[puntaje,categoria,porcentajePuntual,diasPromedioMora,tendencia]]) => ({clienteId,puntaje,categoria,porcentajePuntual,diasPromedioMora,cuotasPagadas:db.contratos.find(c=>c.clienteId===clienteId)?.cuotasPagadas||0,cuotasTotales:db.contratos.find(c=>c.clienteId===clienteId)?.cuotasTotales||0,ultimaActualizacion:'2024-09-11',tendencia}));

  db.alertas = [
    {id:'ad1',clienteId:'c6',motocicletaId:'m6',motivo:'mora',diasMora:34,fechaProgramada:new Date(Date.now()+3600000).toISOString(),urgencia:'alta',atendida:false},
    {id:'ad2',clienteId:'c5',motocicletaId:'m5',motivo:'mora',diasMora:27,fechaProgramada:new Date(Date.now()+86400000).toISOString(),urgencia:'alta',atendida:false},
    {id:'ad3',clienteId:'c3',motocicletaId:'m3',motivo:'mora',diasMora:14,fechaProgramada:new Date(Date.now()+2*86400000).toISOString(),urgencia:'media',atendida:false},
  ];
  writeDb(db);
  console.log('Base de datos del MVP creada correctamente.');
}

if (require.main === module) seed().catch(err => { console.error(err); process.exit(1); });
module.exports = { seed };
