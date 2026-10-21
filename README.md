# MotoLeasing

Proyecto integrado con frontend Next.js y backend Express.

## Ejecutar todo junto (Windows)

Desde la carpeta raíz:

```cmd
npm install
cd backend
npm install
cd ..
npm run dev:all
```

El comando `npm run dev:all` abre el backend en `http://localhost:3001` y el frontend en `http://localhost:3000`.

La primera vez que arranca el backend, si la base JSON está vacía, crea automáticamente los usuarios y datos de demostración.

## Credenciales

- Admin: `admin@motoleasing.com` / `admin123`
- Rider: `rider@gmail.com` / `rider123`

## API

- Backend: `http://localhost:3001/api`
- Health: `http://localhost:3001/api/health`
- Frontend: `http://localhost:3000`

El frontend usa Axios y JWT. Las pantallas principales consultan y modifican la API real; ya no dependen de `mockData` para login, dashboard, clientes, motocicletas, desactivaciones ni portal rider.

## Calidad y pruebas automáticas

```bash
npm test              # Suite del Sprint 2
npm run test:coverage # Suite con cobertura
npm run quality       # ESLint + TypeScript + pruebas + build
```

La estrategia, matriz de trazabilidad y guion de la demo están en [`docs/Estrategia-Pruebas-Automaticas-Sprint-2.md`](docs/Estrategia-Pruebas-Automaticas-Sprint-2.md).
