# Estrategia de Pruebas Automáticas y Calidad de Código

## 1. Objetivo y alcance

Esta estrategia cubre las funcionalidades del Sprint 2 de MotoLeasing: HU-01, HU-06, HU-07, HU-09, HU-12, HU-13, HU-17 y HU-19. Su objetivo es detectar regresiones antes de una entrega y aportar evidencia reproducible para la sustentación.

La suite nunca usa `backend/data/db.json`. Cada ejecución crea una base JSON y una carpeta de archivos temporales, levanta Express en un puerto libre y elimina esos recursos al terminar.

## 2. Pirámide de pruebas

| Nivel | Propósito | Implementación actual | Frecuencia |
|---|---|---|---|
| Unitarias | Validar reglas puras y cálculos aislados | `calculateScore` con y sin pagos | En cada cambio |
| Integración API | Validar ruta, autenticación, regla de negocio y persistencia juntas | 16 escenarios: Happy Path + alternativo para cada HU | En cada cambio |
| E2E | Validar recorridos completos desde la interfaz | Ejecución manual guiada en la demo; automatizar con Playwright cuando los flujos visuales se estabilicen | Antes de cada release |
| Performance | Detectar degradaciones evidentes | 20 solicitudes a `/api/health`, p95 menor a 500 ms en entorno local | En CI y antes del release |
| Estáticas | Detectar defectos de React, TypeScript y Next.js | ESLint Core Web Vitals + TypeScript estricto + build | En cada cambio |

La documentación local de Next.js 16 recomienda Playwright para E2E y usar pruebas E2E para componentes de servidor asíncronos. En este sprint la cobertura automática prioriza el contrato de la API, donde están las reglas críticas. El E2E de navegador es el siguiente incremento, no un reemplazo de estas pruebas.

## 3. Matriz de trazabilidad

| HU | Criterio de aceptación | Happy Path automático | Flujo alternativo automático |
|---|---|---|---|
| HU-01 | Avisar una cuota próxima sin duplicar cobros | Crea notificación para cuota que vence hoy | Conserva una sola notificación si ya existe |
| HU-06 | Autenticar de forma segura | Credenciales válidas entregan JWT y rol | Contraseña incorrecta devuelve 401 |
| HU-07 | Crear cliente, moto, contrato y score | Persiste las cuatro entidades y calcula el total | Correo duplicado devuelve 409 |
| HU-09 | Registrar una cuota semanal válida | Crea cuota pendiente | Monto cero devuelve 400 |
| HU-12 | Calcular total del contrato | `180000 x 18 = 3240000` | Cantidad decimal devuelve 400 |
| HU-13 | Registrar pago y actualizar estados | Actualiza cuota, saldo y score | Pago negativo devuelve 400 |
| HU-17 | Apagar por mora desde 7 días | Apaga la moto y registra el comando | Moto sin señal no recibe comando |
| HU-19 | Permitir control manual auditado | Admin apaga y queda registro del usuario | Encendido sin señal devuelve 409 |

## 4. Comandos y criterio de salida

Desde la raíz del proyecto:

```bash
npm test
npm run test:coverage
npm run lint
npm run typecheck
npm run build
npm run quality
```

Una entrega es aprobada cuando:

- todas las pruebas terminan en verde;
- ESLint y TypeScript terminan sin errores;
- el build de producción se genera correctamente;
- cada historia conserva al menos sus dos escenarios trazables;
- no se modifica la base local de demostración durante las pruebas.

## 5. Datos, ambientes y defectos

- Los datos de prueba son ficticios y deterministas.
- No se llama al webhook de n8n durante la suite.
- Un fallo debe registrarse con HU, escenario, resultado esperado, resultado real y evidencia del comando.
- Un defecto corregido requiere una prueba de regresión antes de cerrarse.
- No se usa `npm audit fix --force` automáticamente: una actualización mayor debe revisarse para evitar regresiones.

## 6. Guion de demo técnica (5 minutos)

1. Mostrar esta matriz y explicar el aislamiento de datos.
2. Ejecutar `npm test` y señalar los dos escenarios de cada HU.
3. Ejecutar `npm run test:coverage` y mostrar el resumen por archivo.
4. Ejecutar `npm run lint` y `npm run typecheck` para demostrar calidad estática.
5. Ejecutar `npm run build` o, si el tiempo es corto, mostrar el último resultado de `npm run quality`.
6. Provocar temporalmente un valor inválido solo si se desea demostrar que la suite falla; revertirlo antes de cerrar la demo.

## 7. Riesgos y próximos pasos

- Agregar Playwright para login, registro de cliente y control GPS desde Chromium.
- Separar las rutas de Express en módulos para elevar la cobertura por archivo.
- Ejecutar una prueba de carga dedicada con k6 o Artillery en un ambiente de staging; el umbral local actual es un detector de regresión, no una certificación de capacidad productiva.
- Revisar periódicamente dependencias con `npm audit` y actualizar mediante una rama separada con la suite completa.
