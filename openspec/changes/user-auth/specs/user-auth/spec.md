# Delta para user-auth

El contrato de errores JSON sigue la spec `go-api` (`{"error":{code,message,field}}`); los códigos por endpoint se listan en cada requisito. Keywords RFC 2119.

## REMOVED Requirements

### Requirement: Auth.js Configuration

(Reason: Auth.js v5, Next.js y `src/auth.ts` fueron eliminados en la migración React+Go.)
(Migration: reemplazado por login con sesiones server-side en el backend Go — ver ADDED Requirements.)

### Requirement: Role Injection

(Reason: el rol ya no viaja en JWT; se persiste en `users.role` y se resuelve server-side desde la sesión.)
(Migration: `GET /api/auth/me` expone el rol del actor.)

### Requirement: Route Protection

(Reason: `src/proxy.ts` no existe; la protección pasa al middleware Go y al guard SPA.)
(Migration: ver ADDED "Middleware de sesión", "Middleware de rol" y la delta de `owner-portal`.)

### Requirement: API Route Handler

(Reason: eliminado con Next.js `app/api/auth/[...nextauth]`.)
(Migration: los endpoints `/api/auth/*` viven en el backend Go.)

### Requirement: Session Provider

(Reason: eliminado; la SPA consulta `GET /api/auth/me` con `credentials: "include"`.)
(Migration: el estado de sesión lo gestiona el cliente API y el guard de ruta.)

## ADDED Requirements

### Requirement: Registro con email y password

El sistema MUST exponer `POST /api/auth/register` aceptando `name`, `email` y `password`. MUST normalizar el email a minúsculas, validar formato y password de al menos 8 caracteres, y hashear con **Argon2id** antes de persistir. MUST crear el usuario con `role = USER` y `email_verified = false`; MUST NOT asignar `OWNER`/`ADMIN` desde input público. La verificación de email es no funcional: `verification_token` se genera pero no bloquea login.

- **Codes**: `201` creado; `400` validación con `field`; `409` `email_taken` con `field=email`.

#### Scenario: Registro exitoso

- GIVEN email y password válidos y no registrados
- WHEN `POST /api/auth/register`
- THEN responde `201` con `{id, name, email, role}` y sin hash
- AND el usuario queda `role = USER` salvo bootstrap OWNER

#### Scenario: Email duplicado

- GIVEN un email ya registrado
- WHEN `POST /api/auth/register`
- THEN responde `409` con `error.code = "email_taken"` y `field = "email"`

#### Scenario: Password inválido

- GIVEN password de 4 caracteres
- WHEN `POST /api/auth/register`
- THEN responde `400` con `field = "password"`

### Requirement: Login con sesión server-side

`POST /api/auth/login` (`email`, `password`) MUST verificar el hash Argon2id. Con credenciales válidas MUST crear una sesión (token aleatorio de 32 bytes, SHA-256 persistido, `expires_at` futuro configurable) y fijar cookie `HttpOnly`, `Secure` (producción), `SameSite=Lax`. Credenciales inválidas MUST responder `401` con `error.code = "invalid_credentials"` e idéntico mensaje para email inexistente o password incorrecto (sin enumeración de cuentas).

- **Codes**: `200` con perfil; `400` validación; `401` `invalid_credentials`.

#### Scenario: Login válido

- GIVEN un usuario registrado con password correcto
- WHEN `POST /api/auth/login`
- THEN responde `200` con perfil y cookie de sesión
- AND `sessions` guarda el token hasheado con `expires_at` futuro

#### Scenario: Password incorrecto

- GIVEN un usuario registrado
- WHEN `POST /api/auth/login` con password incorrecto
- THEN responde `401` con `error.code = "invalid_credentials"`

### Requirement: Logout

`POST /api/auth/logout` MUST invalidar la sesión actual (eliminar la fila) y limpiar la cookie. SHALL responder `204` incluso sin sesión válida (idempotente).

#### Scenario: Logout con sesión

- GIVEN una sesión válida
- WHEN `POST /api/auth/logout`
- THEN la fila de sesión se elimina y la cookie se invalida
- AND `GET /api/auth/me` responde `401`

### Requirement: Perfil actual (`/api/auth/me`)

`GET /api/auth/me` MUST devolver `{id, name, email, role}` del actor autenticado; sin sesión válida MUST responder `401` `unauthorized`.

- **Codes**: `200` con perfil; `401` `unauthorized`.

#### Scenario: Me autenticado

- GIVEN una cookie de sesión válida
- WHEN `GET /api/auth/me`
- THEN responde `200` con el perfil y `role`

#### Scenario: Me anónimo

- GIVEN sin cookie de sesión
- WHEN `GET /api/auth/me`
- THEN responde `401` `unauthorized`

### Requirement: Middleware de sesión

El middleware MUST resolver el actor desde la cookie httpOnly en cada request protegido, comparando el SHA-256 del token contra `sessions`. Sesión ausente, vencida o revocada MUST responder `401`. El sistema SHOULD limpiar periódicamente las sesiones expiradas.

#### Scenario: Sesión vencida

- GIVEN una sesión con `expires_at` en el pasado
- WHEN un request protegido la presenta
- THEN responde `401` `unauthorized`

### Requirement: Middleware de rol

Rutas owner MUST exigir `role = OWNER`; rutas admin futuras, `ADMIN`. Actor con rol insuficiente MUST recibir `403` `forbidden`.

#### Scenario: USER accede a ruta owner

- GIVEN un usuario con `role = USER` y sesión válida
- WHEN solicita una ruta del grupo owner
- THEN responde `403` `forbidden`

### Requirement: Autorización por `owner_id`

Cada endpoint que recibe `storeID` MUST verificar que `stores.owner_id` coincide con el actor autenticado; si no, `403` `forbidden`. La autorización por ownership no MUST limitarse al middleware de ruta.

#### Scenario: OWNER accede a store ajeno

- GIVEN un OWNER con sesión válida
- WHEN solicita un endpoint owner con `storeID` de otra tienda
- THEN responde `403` `forbidden`

### Requirement: Bootstrap de OWNER

El rol OWNER MUST asignarse únicamente por bootstrap explícito (`OWNER_BOOTSTRAP_EMAIL`) o migración/operación. MUST NOT promover automáticamente `USER → OWNER` al crear una tienda.

#### Scenario: Registro con email de bootstrap

- GIVEN `OWNER_BOOTSTRAP_EMAIL = owner@example.com`
- WHEN un usuario se registra con ese email
- THEN su `role` queda `OWNER`

#### Scenario: Creación de tienda sin promoción

- GIVEN un `USER` autenticado
- WHEN intenta crear una tienda
- THEN responde `403` y su rol sigue siendo `USER`

### Requirement: Protección CSRF

Las mutaciones autenticadas por cookie (POST/PATCH/PUT/DELETE) MUST incluir un token CSRF de doble envío (cookie + header `X-CSRF-Token`) validado por el backend; token ausente o inválido MUST responder `403` `csrf_invalid`. `POST /api/auth/login` y `POST /api/auth/register` (públicos) quedan exentos.

#### Scenario: Mutación sin token CSRF

- GIVEN una sesión válida
- WHEN `POST` a un endpoint owner sin `X-CSRF-Token`
- THEN responde `403` `csrf_invalid`

### Requirement: Transición dual con `X-API-Key`

Durante la transición, si no hay cookie de sesión válida, el backend MAY aceptar `X-API-Key` en rutas owner, mapeándola al owner bootstrap y registrando advertencia de deprecación. La sesión SHALL tener prioridad sobre la API key. `AUTH_DISABLE_API_KEY=true` MUST deshabilitar el fallback (`401`).

#### Scenario: Fallback a API key

- GIVEN sin cookie de sesión y `AUTH_DISABLE_API_KEY=false`
- WHEN un request envía `X-API-Key` válida
- THEN se mapea al owner bootstrap y el request procede

#### Scenario: API key deshabilitada

- GIVEN `AUTH_DISABLE_API_KEY=true`
- WHEN un request usa `X-API-Key`
- THEN responde `401` `unauthorized`

### Requirement: Booking anónimo PENDING

El flujo público de reserva MUST permanecer anónimo y con estado `PENDING`; la autenticación MUST NOT alterar el estado de las reservas en esta iteración.

#### Scenario: Reserva anónima

- GIVEN un visitante sin sesión
- WHEN reserva un slot
- THEN la cita se crea con estado `PENDING`

### Requirement: Migración de datos

La migración MUST ampliar `users` de forma aditiva y no destructiva: `role` NOT NULL default `'USER'`, `password_hash` NULL, `email_verified` default `false`, `verification_token` NULL. MUST crear `sessions` (`id`, `user_id` FK, `token_hash` unique, `expires_at`, `created_at`). Debe poder revertirse sin pérdida de datos existentes.

#### Scenario: Usuario pre-existente

- GIVEN filas existentes en `users` sin credenciales
- WHEN se aplica la migración
- THEN las filas se conservan con `role = USER` y `password_hash = NULL`

### Requirement: Tests de autenticación

El backend MUST incluir tests unitarios de service (hashing, login/logout, validación de sesión, CSRF, ownership) y de integración HTTP (transición dual, códigos de error). El frontend MUST incluir tests Vitest para el cliente API (credenciales, manejo de `401`, retiro de `localStorage`) y el guard de ruta.

#### Scenario: Pruebas de transición dual

- GIVEN tests Go y Vitest existentes que asumen `X-API-Key`
- WHEN se agrega la sesión por cookie
- THEN ambos mecanismos se prueban en coexistencia antes de deshabilitar la API key