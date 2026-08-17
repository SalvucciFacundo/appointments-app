# Delta para owner-portal

## MODIFIED Requirements

### Requirement: Owner authentication via API key stub

El dashboard y las rutas owner SHALL autenticarse con sesión server-side (cookie httpOnly) y exigir `role = OWNER`. Durante la transición dual, el backend MAY aceptar `X-API-Key` (mapeada al owner bootstrap) si no hay sesión válida, deshabilitable con `AUTH_DISABLE_API_KEY`. El frontend SHALL usar `credentials: "include"`, SHALL redirigir a `/login` ante `401` y MUST NOT persistir credenciales en `localStorage`.

(Previously: la autenticación era un stub con `X-API-Key` estática y `OWNER_ID` fijo del config.)

#### Scenario: Dashboard autenticado por sesión

- **Given** un usuario `role = OWNER` con cookie de sesión válida
- **When** el dashboard solicita datos owner
- **Then** la petición procede con `200`

#### Scenario: Sin sesión ni API key

- **Given** un request sin cookie de sesión válida ni `X-API-Key`
- **When** se solicita una ruta owner
- **Then** responde `401` y la SPA redirige a `/login`

#### Scenario: Transición dual con API key

- **Given** `AUTH_DISABLE_API_KEY=false` y sin cookie de sesión
- **When** un request incluye `X-API-Key` válida
- **Then** se mapea al owner bootstrap y procede con advertencia de deprecación

#### Scenario: API key deshabilitada

- **Given** `AUTH_DISABLE_API_KEY=true`
- **When** un request usa `X-API-Key`
- **Then** responde `401`

## ADDED Requirements

### Requirement: Guard de ruta del dashboard

La SPA MUST proteger `/dashboard` con un guard de sesión: sin usuario autenticado SHALL redirigir a `/login`. El usuario actual MUST obtenerse de `GET /api/auth/me` al cargar.

#### Scenario: Usuario no autenticado accede a /dashboard

- **Given** sin sesión activa
- **When** la SPA navega a `/dashboard`
- **Then** redirige a `/login`

#### Scenario: OWNER accede a /dashboard

- **Given** un OWNER autenticado
- **When** navega a `/dashboard`
- **Then** la ruta se renderiza con los datos del owner