# Contratos pendientes para el frontend

El frontend ya consume estos contratos bajo la base configurada en
`NEXT_PUBLIC_API_URL` (por defecto `http://localhost:3000/api`). Ninguna de
estas operaciones se simula: la interfaz solo muestra éxito después de recibir
una respuesta HTTP exitosa del backend.

## 1. Membresía activa

`GET /membresia/activa`

- Requiere `Authorization: Bearer <token>` y rol `CLIENTE`.
- `200`: devuelve la membresía activa con plan, clases disponibles y beneficios
  de sesiones.
- `404`: usar `{ "message": "No tienes una membresía activa" }` únicamente
  cuando el cliente realmente no tenga membresía.
- Si la ruta todavía no existe, no devolver ese mismo mensaje; así el frontend
  puede distinguir “sin membresía” de “integración pendiente”.

Respuesta esperada resumida:

```json
{
  "id": 10,
  "estado": "ACTIVA",
  "fecha_inicio": "2026-08-26",
  "fecha_fin": "2026-09-25",
  "clases_usadas": 2,
  "clases_disponibles": 8,
  "plan": { "id": 3, "nombre": "Platinum", "clases_ilimitadas": false, "limite_clases": 10 },
  "beneficios": [
    { "id": 7, "nombre": "Masaje", "cantidad_incluida": 2, "sesiones_usadas": 0, "sesiones_disponibles": 2 }
  ]
}
```

Como alternativa, el backend puede incluir el mismo objeto como
`membresia_activa` en la respuesta existente de `GET /perfil`.

## 2. Edición de perfil

`PATCH /perfil`

- Requiere autenticación y solo permite modificar al usuario del token.
- Recibe `multipart/form-data` con `nombre`, `apellido_paterno`,
  `apellido_materno`, `telefono` y `avatar` opcional.
- El avatar permitido en la interfaz es JPG, PNG o WebP de hasta 2 MB. El
  backend debe volver a validar contenido real, tamaño y extensión antes de
  almacenarlo.
- No se permite modificar correo, roles, permisos ni estado desde este flujo.
- `200`: devuelve el mismo formato actualizado de `GET /perfil`.

## 3. Compra y pago de membresía

`POST /orden-membresia`

```json
{ "plan_membresia_id": 3 }
```

- El frontend no envía precio, moneda, beneficios ni duración.
- El backend debe consultar el plan, recalcular el total y generar una orden
  idempotente asociada al cliente autenticado.
- Respuesta esperada:

```json
{
  "orden": { "id": 51, "estado": "PENDIENTE" },
  "pago": {
    "id": 92,
    "estado": "PENDIENTE",
    "qr_imagen_url": "/uploads/pagos/92.png",
    "qr_expiracion": "2026-08-26T18:30:00.000Z"
  },
  "message": "Orden creada"
}
```

`GET /pago/:pagoId`

- Solo el propietario de la orden o un rol administrativo puede consultar el
  pago.
- Estados reconocidos: `PENDIENTE`, `APROBADO`, `RECHAZADO`, `EXPIRADO` y
  `CANCELADO`.
- La membresía debe activarse de forma transaccional e idempotente en el
  backend. El frontend nunca activa una membresía por su cuenta.

## 4. Reserva de una clase

`POST /agenda/:agendaActividadId/reserva`

- Requiere cliente autenticado y membresía activa con clases disponibles.
- El backend valida categoría `CLASE`, vigencia, cupo, duplicados y saldo en una
  sola transacción.
- `200` o `201`: `{ "id": 123, "estado": "CONFIRMADA", "message": "Reserva confirmada" }`.
- Recomendado: una restricción única por cliente y horario para hacer la
  operación idempotente.

## 5. Solicitud de una sesión

`POST /cita-sesion`

```json
{
  "actividad_id": 8,
  "fecha_preferida": "2026-08-29",
  "hora_preferida": "10:30",
  "comentario": "Opcional, máximo 240 caracteres"
}
```

- Requiere cliente autenticado, membresía activa y beneficio disponible.
- El backend valida que la actividad sea categoría `SESION`, fecha futura,
  horario de atención, disponibilidad y saldo de la sesión.
- La preferencia puede quedar `PENDIENTE` hasta que el equipo confirme un
  horario; no debe descontarse dos veces ante reintentos.
- `200` o `201`: `{ "id": 35, "estado": "PENDIENTE", "message": "Solicitud registrada" }`.

## Reglas de seguridad comunes

- Validar autorización y pertenencia de cada recurso en el backend; ocultar un
  botón en React no constituye control de acceso.
- No confiar en precio, cupos, vigencia, rol ni saldo enviados por el navegador.
- Limitar frecuencia de login, pagos y reservas; registrar auditoría sin guardar
  tokens ni datos sensibles en logs.
- Usar transacciones e idempotencia en pagos, activaciones, cupos y descuentos
  de beneficios.
- En producción, exponer la API por HTTPS y restringir CORS al origen real del
  frontend.

## 6. Roles y permisos del panel

El panel toma la visibilidad de módulos de los códigos incluidos actualmente en
`GET /perfil`. Ese arreglo `permisos` debe seguir siendo la fuente de verdad para
la sesión autenticada. Un rol futuro, por ejemplo `MARKETING`, no requiere
cambios en el login: si recibe `galeria.ver`, `galeria.editar` o
`landing.editar`, el frontend habilitará el módulo visual correspondiente.

`GET /rol?incluir_permisos=true`

- Requiere `roles.ver`.
- Devuelve los roles reales y sus permisos; no debe depender de una lista
  hardcodeada en React.

```json
[
  {
    "id": 4,
    "nombre": "RECEPCIONISTA",
    "descripcion": "Personal de recepción",
    "permisos": [
      { "id": 8, "codigo": "agenda.ver", "modulo": "AGENDA", "accion": "VER", "descripcion": "Ver agenda" }
    ]
  }
]
```

`GET /permiso`

- Requiere `roles.asignar`.
- Devuelve el catálogo completo de permisos con `id`, `codigo`, `modulo`,
  `accion` y `descripcion`.

`PUT /rol/:rolId/permisos`

```json
{ "permiso_ids": [3, 8, 12] }
```

- Requiere `roles.asignar` y debe reemplazar el conjunto de permisos del rol de
  forma transaccional.
- Validar que todos los identificadores existan, impedir escalamiento de
  privilegios y registrar quién efectuó el cambio.
- El rol `ADMINISTRADOR` se muestra protegido en el frontend. El backend también
  debe impedir que se elimine accidentalmente el último acceso administrativo.
- `200`: `{ "message": "Permisos actualizados", "rol": { ... } }`.
- Al cambiar un rol, las sesiones deben obtener los permisos actualizados en su
  siguiente consulta a `/perfil`; para cambios críticos conviene invalidar las
  sesiones existentes del rol.

## 7. Categorías dinámicas de actividades en la landing

La landing ya agrupa automáticamente las actividades recibidas desde
`GET /actividad?visible_landing=true` por el valor de `categoria`. No requiere
una lista cerrada en React: si el backend devuelve una categoría nueva, se crea
su bloque y sus disciplinas se ordenan por `orden`.

Para que el cliente también pueda editar el título, la descripción y el orden
visual de cada categoría, el backend puede publicar:

`GET /categoria-actividad?visible_landing=true`

El frontend activa este contrato configurando:

```env
NEXT_PUBLIC_ACTIVITY_CATEGORIES_PATH=/categoria-actividad?visible_landing=true
```

Respuesta esperada:

```json
[
  {
    "id": 1,
    "codigo": "CLASE",
    "nombre": "Clases",
    "titulo_landing": "Movimiento",
    "subtitulo_landing": "CLASES INCLUIDAS SEGÚN TU MEMBRESÍA",
    "descripcion": "Descripción administrable de la categoría.",
    "orden": 10,
    "visible_landing": true,
    "estado": "ACTIVO"
  }
]
```

- `codigo` debe coincidir con `actividad.categoria` y ser estable; el texto
  editable vive en `nombre`, `titulo_landing`, `subtitulo_landing` y
  `descripcion`.
- Las categorías actuales se ordenan como `CLASE` (10), `SESION` (20) y
  `EXPERIENCIA` (30). Las futuras usan el `orden` entregado por este catálogo.
- Mientras el endpoint no exista, no se configura la variable y el frontend
  deriva las categorías directamente de las actividades, sin generar errores
  ni datos de prueba.
- Si la base de datos actual limita `categoria` mediante un `ENUM`, permitir
  nuevas categorías requiere una migración futura del backend. Este cambio no
  modifica esa estructura ni ninguna lógica de base de datos.

Los demás módulos de la landing continúan usando los contratos existentes:

- `GET /agenda?categoria=CLASE`: solo se considera la clase en curso o la
  siguiente que empieza dentro de dos horas.
- `GET /plan-membresia?visible_landing=true`: tres planes visibles a la vez y
  navegación lateral cuando existen más.
- `GET /landing/seccion/GALERIA`: se muestran todas sus imágenes en el carrusel
  y se mantiene el acceso a `/galeria`.
