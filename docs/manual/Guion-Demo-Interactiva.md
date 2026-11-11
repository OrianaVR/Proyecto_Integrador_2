# Guion de demo interactiva de MotoLeasing

## Objetivo

Demostrar en 10 a 12 minutos que MotoLeasing conecta la gestión administrativa del leasing con la consulta del cliente, usando datos reales de demostración y la API local.

## Preparación previa

1. Desde la raíz del proyecto, ejecutar `npm install`.
2. Desde `backend`, ejecutar `npm install`.
3. Abrir una terminal en `backend` y ejecutar `npm start`.
4. Abrir otra terminal en la raíz y ejecutar `npm run dev`.
5. Confirmar que `http://localhost:3001/api/health` responde con `status: ok`.
6. Abrir `http://localhost:3000/login`.
7. Mantener el zoom del navegador en 100 % y cerrar notificaciones o pestañas ajenas.

Importante: para la sustentación se usa `npm start` en el backend. El modo `npm run dev` observa archivos y puede reiniciarse cuando cambia la base JSON de demostración.

## Credenciales

| Perfil | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@motoleasing.com` | `admin123` |
| Cliente | `rider@gmail.com` | `rider123` |

## Recorrido principal

### 1 Inicio y propósito 45 segundos

Explicar que la plataforma centraliza clientes, motocicletas, pagos, control GPS, notificaciones y reportes. Iniciar como administrador con el botón `Admin demo`.

### 2 Dashboard y búsqueda 1 minuto

Mostrar los indicadores generales, buscar `Andrés` y abrir su perfil. Señalar la cuota, los días de mora, el score y el estado GPS.

### 3 Perfil y gestión de cobro 2 minutos

En el perfil de Andrés, explicar el resumen del contrato, la próxima cuota y el score. Abrir `Registrar pago` solo para mostrar el formulario; no confirmar el registro si se quiere conservar el conjunto de datos intacto.

### 4 Registro de cliente 1 minuto 30 segundos

Entrar en `Nuevo Cliente` y recorrer las tres etapas: datos personales, motocicleta y documentos. Explicar los formatos admitidos y la validación de duplicados. No guardar un cliente durante la demo principal.

### 5 Motocicletas y control GPS 1 minuto

Mostrar búsqueda, filtros y estados. Explicar que `sin señal` impide ejecutar el comando y genera una alerta. No cambiar el GPS de la moto usada por el portal del cliente antes de mostrar ese portal.

### 6 Operación y alertas 1 minuto 30 segundos

Abrir `Desactivaciones` para mostrar urgencias por mora. Luego abrir `Alertas GPS` y explicar las opciones `Reintentar apagado` y `Marcar como resuelta`. No ejecutar acciones destructivas durante la explicación.

### 7 Reportes y configuración 1 minuto 30 segundos

En `Reportes Financieros`, cambiar el rango y generar el reporte. Mostrar los botones PDF y Excel. En `Configuración`, enseñar canales, modo simulado, día y hora de envío. No pulsar `Enviar recordatorios de hoy` durante una sustentación compartida.

### 8 Portal del cliente 1 minuto 30 segundos

Cerrar sesión e ingresar con `Rider demo`. Mostrar la motocicleta asignada, vencimientos, saldo, avance del contrato, próxima cuota y score. Cerrar con la idea de trazabilidad: los datos administrados se reflejan en la vista del cliente.

## Frase de cierre

“MotoLeasing permite operar el leasing desde un solo lugar y brinda al cliente visibilidad sobre su contrato, su motocicleta y sus obligaciones. La demo recorrió el flujo completo desde la gestión administrativa hasta la consulta del cliente.”

## Plan de contingencia

- Si la API no responde, comprobar que `npm start` sigue activo en `backend`.
- Si el puerto está ocupado, cerrar la instancia anterior y volver a iniciar los dos servicios.
- Si una pantalla conserva una sesión equivocada, usar `Cerrar sesión` y volver a elegir el perfil demo.
- Si no hay internet, la app sigue funcionando localmente; la fuente web usa una tipografía de reserva.
- Si falla una acción que modifica datos, continuar con las capturas incluidas en el manual y explicar el resultado esperado.

## Lista de verificación del equipo

- [ ] Portátil conectado a corriente.
- [ ] Backend y frontend activos.
- [ ] Salud de API confirmada.
- [ ] Credenciales copiadas en una nota privada.
- [ ] Navegador en 100 % y sin extensiones visibles.
- [ ] Manual abierto como respaldo.
- [ ] Presentador principal y persona de apoyo definidos.
- [ ] Recorrido ensayado en menos de 12 minutos.

