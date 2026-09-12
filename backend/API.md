# API REST — MotoLeasing

Base URL: `http://localhost:3001/api`

Todas las rutas protegidas reciben:

`Authorization: Bearer <token>`

## Autenticación — HU-06

### POST `/auth/login`

```json
{ "email": "admin@motoleasing.com", "password": "admin123" }
```

Respuesta:

```json
{
  "success": true,
  "data": { "token": "...", "user": { "rol": "admin" } }
}
```

### GET `/auth/me`

Valida el JWT y devuelve el usuario autenticado.

## HU-07 — Cliente + motocicleta + contrato

### POST `/clientes`

Registra en una sola operación el rider, la moto y el contrato. También valida email, documento y placa duplicados.

Campos principales: `nombre`, `apellido`, `email`, `telefono`, `documentoId`, `plataforma`, `ciudad`, `marca`, `modelo`, `año`, `placa`, `numeroSerie`, `color`, `montoSemanal`, `cuotasTotales`, `fechaInicio`, `fechaFin`.

El total del contrato se calcula como:

`montoSemanal × cuotasTotales`

## HU-09 — Cuota semanal

### POST `/cuotas`

```json
{
  "contratoId": "ct1",
  "numeroCuota": 17,
  "monto": 180000,
  "fechaVencimiento": "2026-09-15"
}
```

No permite repetir el mismo número de cuota dentro del contrato.

## HU-12 — Cálculo

### POST `/cuotas/calcular-total`

```json
{ "montoSemanal": 180000, "cuotasTotales": 18 }
```

Devuelve `totalContrato = 3240000`.

## HU-13 — Pago + comprobante

### POST `/pagos`

Usa `multipart/form-data`:

- `contratoId`
- `cuotaId` (opcional)
- `monto`
- `metodoPago`
- `referencia` (opcional)
- `notas` (opcional)
- `comprobante` (archivo PDF/JPG/PNG, máximo 5 MB)

Al registrar el pago se actualizan cuota, saldo del contrato y score crediticio.

## HU-01 — Cobro automático

El job automático se ejecuta al iniciar el backend y cada hora.

- Marca cuotas vencidas.
- Busca cuotas que vencen dentro de 24 horas.
- Crea una notificación de cobro sin duplicarla.
- Si `N8N_WEBHOOK_URL` está configurada, envía la notificación al webhook de n8n.

### POST `/jobs/run`

Permite ejecutar el proceso manualmente desde un usuario admin para hacer una demostración.

## HU-17 — Apagado automático

El job revisa la mora máxima de cada contrato. Si alcanza `AUTO_SHUTDOWN_MORA_DAYS` (7 por defecto), cambia el GPS a `apagado` y registra el comando como `system-auto`.

## HU-19 — Control manual

### POST `/motocicletas/:id/gps/encender`

### POST `/motocicletas/:id/gps/apagar`

Solo admin. Cada acción queda registrada en `comandosGPS`.

### GET `/motocicletas/:id/gps`

Consulta el estado actual.

## Consultas usadas por el frontend

- `GET /dashboard/stats`
- `GET /dashboard/clientes`
- `GET /clientes`
- `GET /clientes/:id`
- `GET /motocicletas`
- `GET /cuotas/contrato/:contratoId`
- `GET /pagos/cliente/:clienteId`
- `GET /alertas/desactivacion`
- `GET /notificaciones`

## Persistencia

El MVP usa `backend/data/db.json`. Esto evita depender de MySQL/PostgreSQL durante la integración. El archivo se crea con `npm run seed` y no debe subirse al repositorio.
