# Plan de Desarrollo: Sistema de Turnos

Este documento desglosa el plan de tareas paso a paso para construir la aplicación basándonos en la especificación técnica en `openspec.md`. Cada fase debe completarse y validarse antes de pasar a la siguiente.

---

## Fase 1: Inicialización del Proyecto y Base de Datos
*   [ ] **1.1 Inicializar Next.js**: Configurar el proyecto de Next.js en TypeScript utilizando App Router.
*   [ ] **1.2 Configurar Base de Datos**: Levantar PostgreSQL y conectar Prisma ORM.
*   [ ] **1.3 Definir Esquema de Datos**: Crear los modelos (`User`, `Store`, `Appointment`, `Review`, `BlockedDate`, `BusinessHour`, `CalendarSync`) definidos en `openspec.md` y correr la migración inicial.

## Fase 2: Autenticación y Control de Roles
*   [ ] **2.1 Configurar Auth.js (NextAuth)**: Integrar login con Google Provider.
*   [ ] **2.2 Middleware de Rutas**: Implementar middleware de Next.js para proteger rutas:
    *   `/admin/*` -> Exclusivo para rol `ADMIN`.
    *   `/dashboard/*` -> Exclusivo para rol `OWNER` (redireccionar al onboarding si no tiene una tienda registrada).
    *   `/perfil/*` -> Exclusivo para usuarios autenticados (`USER`).
*   [ ] **2.3 Sembrado de Datos (Seed)**: Script para insertar tiendas y usuarios de prueba (incluyendo un administrador de prueba).

## Fase 3: Portal del Dueño (Owner Onboarding & Configuración)
*   [ ] **3.1 Registro de Tienda (Onboarding)**: Formulario paso a paso para que un `OWNER` registre su negocio (nombre, dirección, especialidad, etc.).
*   [ ] **3.2 Configuración de Agenda**:
    *   CRUD de horarios semanales de atención (`BusinessHour`).
    *   Formulario para definir la duración del slot de turno y capacidad.
    *   Selector de días bloqueados (`BlockedDate`) para vacaciones o feriados.
    *   Configuración del límite de cancelación (horas de anticipación).

## Fase 4: Dashboard y Gestión de Turnos del Dueño
*   [ ] **4.1 Calendario del Dueño**: UI interactiva premium para visualizar la agenda del día, semana y mes.
*   [ ] **4.2 CRUD de Turnos del Dueño**: Modales para cancelar turnos, modificar fechas/horas de reservas y marcar turnos como completados.
*   [ ] **4.3 Alertas de Reservas Pendientes (`PENDING`)**:
    *   Notificación en el dashboard al recibir reservas de clientes no registrados.
    *   Modal con detalles y botón dinámico a `https://wa.me/...` para coordinar de forma gratuita por WhatsApp.
    *   Acción para confirmar (`CONFIRMED`) o rechazar la reserva.

## Fase 5: Landing Page y Flujo del Cliente
*   [ ] **5.1 Landing Page Pública**: Buscador con filtros por especialidad y tarjetas premium de tiendas registradas con su calificación media.
*   [ ] **5.2 Página de la Tienda**:
    *   Visualizador del calendario interactivo del cliente (slots libres calculados dinámicamente restando turnos existentes, horas de negocio y días bloqueados).
*   [ ] **5.3 Formulario de Reserva**:
    *   Para no registrados: Ingresar nombre, celular e email (el turno entra como `PENDING`).
    *   Para registrados: Reserva con 1 click (el turno entra como `CONFIRMED`).
*   [ ] **5.4 Panel de Perfil de Cliente**:
    *   Visualizar historial de turnos e indicador de estados.
    *   Guardar y listar tiendas favoritas.
    *   Sistema de reseñas y comentarios (máximo 1 reseña por cliente a cada tienda).

## Fase 6: Notificaciones Automáticas (Resend & WhatsApp API)
*   [ ] **6.1 Emails de Reserva (Resend)**:
    *   Enviar email inmediato de confirmación con link único de cancelación y reprogramación al crear la cita.
*   [ ] **6.2 Cron Job de Recordatorios**:
    *   Implementar un Endpoint API en Next.js protegido para ejecutar tareas cron (ej. vía Vercel Cron).
    *   El cron busca turnos a 1 hora de comenzar y dispara:
        *   Notificación oficial de WhatsApp vía **Meta Cloud API** (usando plantilla aprobada).
        *   Email de recordatorio de respaldo vía **Resend**.

## Fase 7: Integración con Google Calendar
*   [ ] **7.1 Flujo OAuth de Google Calendar**: Configurar los scopes necesarios y guardar el `accessToken` y `refreshToken` del dueño al activar la sincronización.
*   [ ] **7.2 Sincronización de Reservas**:
    *   Al confirmar un turno (`CONFIRMED`), insertarlo dinámicamente como evento en el Google Calendar del dueño.
    *   Al cancelar o modificar el turno, sincronizar el evento en Google Calendar usando el id del evento guardado.

## Fase 8: Panel de Administración Global y Estadísticas
*   [ ] **8.1 Dashboard de Estadísticas del Dueño**: Gráficos e indicadores de ventas estimadas, tasa de asistencia, horarios pico y clientes recurrentes.
*   [ ] **8.2 Panel del Admin General**:
    *   CRUD de gestión y suspensión de tiendas.
    *   Moderador de comentarios y reseñas.
    *   Métricas globales del uso de la plataforma.

## Fase 9: PWA y Lanzamiento
*   [ ] **9.1 Configuración de PWA**: Configurar manifest y service workers para que la aplicación sea instalable en dispositivos móviles.
*   [ ] **9.2 Optimización de Rendimiento e Interfaz**: Animaciones de carga y transiciones CSS fluidas.
*   [ ] **9.3 Despliegue**: Subir a producción (ej. Vercel, Supabase/Neon PostgreSQL).
