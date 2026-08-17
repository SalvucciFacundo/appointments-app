## Exploration: user-auth

### Current State

La autenticación actual es un stub de un único dueño. `backend/internal/http/router.go` aplica CORS, logging, recover y rate limit globalmente; las rutas públicas de descubrimiento, slots y booking quedan abiertas, mientras que el grupo de rutas owner usa `middleware.RequireAPIKey(cfg.APIKey)`. Ese middleware compara, en tiempo constante, el header `X-API-Key` con `API_KEY` y devuelve `401 unauthorized`; si `API_KEY` está vacío, desactiva la protección. El rate limiter clasifica como owner únicamente a quien presenta la API key válida.

`backend/internal/config/config.go` carga `API_KEY` y un `OWNER_ID` fijo, por defecto `dashboard-owner`. El router construye los handlers con ese `OWNER_ID`; `ListOwnerStores` y `CreateStore` lo usan como propietario, por lo que la identidad no proviene de la petición. Las operaciones owner por `storeID` reciben solamente el id del comercio en la capa HTTP/servicio y deben revisarse explícitamente antes de introducir múltiples usuarios: actualmente el mecanismo de identidad no permite demostrar quién es el propietario de cada petición.

En `frontend/src/App.tsx` `/dashboard` es una ruta client-side sin guard de sesión. `Dashboard.tsx` solicita la API key, la persiste en `localStorage` bajo `dashboard.apiKey` y la pasa a todas las funciones owner. `frontend/src/api/client.ts` agrega `X-API-Key` sólo cuando `options.apiKey` está presente; no maneja cookies, `Authorization`, refresh, usuario actual ni `401` global. La API pública no requiere credenciales y el booking anónimo sigue siendo el flujo principal.

La migración Go ya contiene una tabla `users`, pero sólo con `id`, `name`, `email` único e `image`: no tiene rol, credencial, verificación ni sesiones. `stores.owner_id` es `NOT NULL` y referencia `users(id)` con `ON DELETE CASCADE`; `appointments.user_id` es opcional y referencia usuarios con `ON DELETE SET NULL`. `appointments.status` tiene default `CONFIRMED`, pero `service.Book` siempre inserta explícitamente `PENDING` y genera `management_token`, por lo que el flujo público anónimo actual es PENDING.

El modelo histórico del monolito (`openspec.md`) definía `USER`, `OWNER` y `ADMIN`, Google/Auth.js, cuentas y sesiones. Un usuario autenticado podía crear una tienda y era promovido automáticamente a `OWNER`; el texto histórico también definía reservas autenticadas como `CONFIRMED` y anónimas como `PENDING`. La spec histórica de Auth.js no puede reutilizarse literalmente: presupone Next.js, Prisma, `src/auth.ts`, `proxy.ts` y `SessionProvider`, todos eliminados en la migración.

### Affected Areas

- `backend/migrations/00001_init.up.sql` — ampliar `users` y añadir credenciales, roles, sesiones y eventualmente verificación/rotación de tokens.
- `backend/internal/config/config.go` — secretos, cookies, URLs, proveedor OAuth, política de bootstrap owner y compatibilidad temporal con `API_KEY`.
- `backend/internal/store/` — queries parametrizadas para usuarios, sesiones, credenciales, roles, lookup de stores por owner y creación de appointments con `user_id`.
- `backend/internal/service/` — registro/login, hashing, expiración, validación de sesiones, promoción/invitación de owner y decisión PENDING/CONFIRMED.
- `backend/internal/http/middleware/requireapikey.go` y nuevo middleware de identidad/roles — reemplazar o combinar el stub sin perder el contrato de errores.
- `backend/internal/http/router.go` y handlers — endpoints `/auth/*`, `/me`, logout y autorización por usuario/rol en cada operación owner; no basta con proteger el prefijo.
- `frontend/src/api/client.ts`, `stores.ts` y `appointments.ts` — `credentials: "include"`, manejo consistente de `401`, usuario actual y retiro gradual del parámetro `apiKey`.
- `frontend/src/App.tsx` y `frontend/src/pages/Dashboard.tsx` — guard client-side, login/register, logout, estado de sesión y eliminación de la pantalla de API key.
- `backend/internal/http/middleware/middleware_test.go` y `frontend/src/api/client.test.ts` — las pruebas actuales asumen `X-API-Key`; deberán coexistir con pruebas de cookie/sesión y transición.
- `backend/internal/service/*_test.go` y handlers tests — pueden romperse al cambiar firmas para transportar actor/owner y al cambiar el status de bookings autenticados.
- `openspec/specs/user-auth/spec.md`, `owner-portal` y `go-api` — las specs actuales describen Auth.js/Next.js o el stub y deben actualizarse mediante el cambio, no copiarse sin adaptar.

### Approaches

1. **Sesión server-side con cookie httpOnly** — login crea una sesión aleatoria persistida en PostgreSQL; el navegador sólo recibe una cookie `Secure`, `HttpOnly`, `SameSite` y la API resuelve el usuario en cada request.
   - Pros: revocación inmediata, logout real, control central de roles, no expone credenciales/tokens a JavaScript, encaja con SPA same-origin detrás de nginx y con un SaaS multitenant pequeño.
   - Cons: una lectura adicional a DB (mitigable con TTL/cache), requiere CSRF para mutaciones si se usa cookie y limpieza de sesiones expiradas.
   - Effort: Medium.

2. **JWT access + refresh** — access token corto y refresh token rotatorio (idealmente en cookie httpOnly), con validación criptográfica en middleware y persistencia/revocación del refresh.
   - Pros: menos lecturas de sesión para cada request, buen camino si luego se separan servicios o existen clientes móviles.
   - Cons: revocación y rotación más complejas, riesgo de fugas/uso de tokens, el rol embebido puede quedar obsoleto, y el refresh store sigue siendo necesario para logout seguro.
   - Effort: High.

3. **Identidad propia + Google opcional** — email/password con Argon2id o bcrypt y sesiones server-side como núcleo; Google OAuth se agrega como segundo proveedor que vincula por email/provider account.
   - Pros: funciona sin depender de credenciales Google ni configuración OAuth para la demo, cubre clientes y owners, conserva la opción histórica de Google y facilita tests deterministas.
   - Cons: password reset, verificación de email y protección anti-abuso agregan trabajo; Google requiere callback, secretos y manejo de cuentas vinculadas.
   - Effort: Medium para propio; High si ambos se entregan en la primera iteración.

4. **Sólo Google OAuth** — identidad delegada a Google y sesión local server-side.
   - Pros: no se almacenan passwords, UX simple para una demo y continuidad con el monolito original.
   - Cons: bloquea usuarios sin Google, exige configuración de OAuth en Dokploy y no resuelve por sí solo bootstrap, roles ni autorización por tenant.
   - Effort: Medium.

### Recommendation

Para esta demo SaaS B2B2C desplegada en Dokploy, se recomienda **sesión server-side con cookie httpOnly + email/password mínimo**, dejando Google OAuth como segunda iteración compatible. Es la opción más fácil de revocar y auditar, reduce exposición en una SPA y evita convertir un access JWT de larga vida en una falsa sesión.

El mínimo de esta iteración debería ser: (1) migración de `users` con `role` (`USER`, `OWNER`, `ADMIN`) y hash de password, más una tabla `sessions` con token aleatorio hasheado y expiración; (2) `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout` y `GET /api/auth/me`; (3) middleware que resuelva el actor desde la cookie y middleware de rol; (4) autorización por `owner_id` en **cada** endpoint que recibe `storeID`, además de exigir `OWNER` para dashboard y `ADMIN` sólo en futuras rutas administrativas; (5) guard SPA y cliente API con `credentials: "include"`; (6) mantener booking anónimo como PENDING. El booking autenticado puede pasar a CONFIRMED sólo si se adopta explícitamente la regla histórica y se prueba; no debe cambiarse accidentalmente durante el trabajo de auth.

La asignación de `OWNER` no debería ocurrir automáticamente sólo porque un usuario crea una tienda: eso permite una escalada de privilegios en un sistema multitenant. Para la demo, usar bootstrap explícito por email configurado (`OWNER_BOOTSTRAP_EMAIL`) o una invitación/admin; después, incorporar onboarding con una transición controlada `USER → OWNER`. El `ADMIN` debe asignarse sólo por migración/operación administrativa, nunca desde input público.

La transición debe ser dual y reversible: durante un período, aceptar sesión válida y `X-API-Key`; la API key debe mapearse únicamente al owner bootstrap configurado, registrar advertencias de deprecación y quedar deshabilitable con una flag. El frontend debe migrar primero a sesión y retirar el almacenamiento de secretos en `localStorage`; no se debe “convertir” la API key en un JWT ni enviarla al build público. El rollback consiste en reactivar el stub mientras las migraciones nuevas permanecen compatibles y no destructivas.

### Risks

- La tabla `users` existe, pero no representa todavía una identidad autenticable; agregar sólo un `role` sin hashing/sesiones no constituye auth real.
- Cookie auth requiere política CSRF, `Secure` correcto detrás de Dokploy/proxy, CORS same-origin y no mezclar credenciales con `Access-Control-Allow-Origin: *`.
- El patrón actual permite que el contexto fijo `OWNER_ID` oculte verificaciones de ownership; cambiar sólo el middleware de ruta puede dejar IDOR entre stores.
- Persistir la API key en `localStorage` permite extracción por XSS y debe desaparecer en la migración; la compatibilidad temporal prolonga ese riesgo.
- Cambiar bookings autenticados a `CONFIRMED` altera capacidad, notificaciones y expectativas de la spec actual; requiere decisión y tests separados de la autenticación.
- Promover automáticamente a `OWNER` o confiar en el email del cliente puede producir escalada de privilegios o account takeover por vinculación insegura de OAuth.
- Las pruebas de router/middleware y el cliente Vitest codifican `X-API-Key`; cambiar contratos sin una fase dual rompe el dashboard y el despliegue existente.
- En varias instancias, sesiones server-side funcionan con PostgreSQL compartido, pero el rate limiter actual es in-memory y no es distribuido.

### Ready for Proposal

Yes — la exploración identifica el stub exacto, el modelo persistido, las diferencias históricas y una estrategia concreta. El siguiente paso debe convertir esta recomendación en una propuesta acotada, separando el MVP de sesión/roles/ownership de Google OAuth, recuperación de contraseña y administración avanzada.
