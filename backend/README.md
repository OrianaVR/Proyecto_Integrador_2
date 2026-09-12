# MotoLeasing Backend

API REST para las HU del MVP:

- HU-01 Notificación automática de cobro
- HU-06 Inicio de sesión seguro
- HU-07 Registro de clientes y asociación de motos
- HU-09 Registro de cuota semanal
- HU-12 Cálculo del total semanal
- HU-13 Registro de pago con comprobante
- HU-17 Apagado automático de motos
- HU-19 Control manual de la motocicleta

## Ejecutar

```bash
cd backend
npm install
copy .env.example .env   # Windows CMD
npm run dev
```

Linux/macOS: `cp .env.example .env`.

La API queda en `http://localhost:3001/api`.

## Credenciales de prueba

- Admin: `admin@motoleasing.com` / `admin123`
- Rider: `rider@gmail.com` / `rider123`

El almacenamiento del MVP es un JSON local para que el backend funcione sin instalar MySQL/PostgreSQL. La capa de persistencia está aislada en `src/db.js`, por lo que puede sustituirse posteriormente por PostgreSQL sin cambiar las rutas.
