# OpenSpec: Sistema de Gestión de Turnos para Tiendas y Servicios (SaaS B2B2C)

Este documento especifica el diseño funcional, la arquitectura técnica y el modelo de datos para la aplicación de reservas de turnos diseñada para tiendas de servicios (peluquerías, veterinarias, estéticas, etc.).

---

## 1. Visión General del Proyecto

La plataforma es una solución SaaS multitenant simplificada. Permite a las tiendas registrarse, configurar su oferta de turnos y gestionar su agenda. Por otro lado, permite a los clientes descubrir tiendas, agendar turnos de forma directa y recibir recordatorios automatizados.

### Tecnologías Clave
*   **Framework**: Next.js (App Router)
*   **Lenguaje**: TypeScript
*   **Base de Datos & ORM**: PostgreSQL con Prisma ORM
*   **Autenticación**: Auth.js (NextAuth) con Google Provider
*   **Envío de Emails**: Resend (Capa gratuita de respaldo y confirmaciones)
*   **Recordatorios de WhatsApp**: Meta Cloud API (WhatsApp Business oficial) utilizando un número centralizado de la plataforma.
*   **Integración de Calendario**: Google Calendar API (Sincronización unidireccional opcional para el dueño).
*   **Estilos**: Vanilla CSS / CSS Modules (Aesthetics Premium y Modernas).

---

## 2. Roles y Flujos de Usuario

### 2.1 Cliente Anónimo (Sin Registrar)
*   **Landing Page**: 
    *   Buscador y filtros por especialidad (peluquería, veterinaria, etc.).
    *   Listado de tiendas registradas con su puntuación media y datos básicos.
*   **Página Única de la Tienda**:
    *   Información de la tienda (descripción, dirección, horarios).
    *   Visualizador de turnos disponibles (vistas por Día, Semana y Mes).
    *   **Reserva Directa**: Selección de un slot libre e ingreso de datos básicos (Nombre, Apellido, Celular, Email).
    *   **Estado Inicial**: Al no estar registrado, el turno ingresa con estado `PENDING` (Pendiente de confirmación por el dueño).
*   **Gestión de Turno**:
    *   Acceso a través de un link único enviado por Email.
    *   Permite cancelar o reprogramar el turno de forma autónoma siempre y cuando se encuentre fuera del límite de horas de anticipación configurado por la tienda.

### 2.2 Cliente Autenticado (Google Auth)
*   Tiene todos los permisos del Cliente Anónimo.
*   **Reserva Instantánea**: Los turnos de clientes autenticados ingresan directamente como `CONFIRMED`.
*   **Historial**: Panel para ver sus turnos pasados y futuros.
*   **Favoritos**: Posibilidad de marcar tiendas como favoritas para acceder a ellas directamente desde su perfil de usuario.
*   **Sistema de Reseñas**: Puede dejar una calificación (1-5 estrellas) y un comentario en las tiendas donde haya reservado turnos.

### 2.3 Dueño de la Tienda (Autenticado con Google Auth)

*   **Onboarding y Flag de OWNER**: Cualquier usuario autenticado con `role: USER` puede crear una tienda. Al completar el registro exitoso de la tienda, el sistema actualiza su `role` a `OWNER` automáticamente. No hay un paso de verificación manual — si creaste una tienda, sos dueño. Si el usuario ya tenía `role: OWNER` pero su tienda fue suspendida, se le muestra un mensaje de contacto con el admin.
*   **Registro de Tienda**: Proceso de onboarding para crear su tienda (Nombre, Dirección, Especialidad, Fotos).
*   **Configuración de Agenda**:
    *   Definición de días y horarios de atención.
    *   Configuración de la duración de cada turno (ej. 30 min, 45 min, 60 min).
    *   Configuración del límite de turnos simultáneos (capacidad).
    *   **Políticas de Cancelación**: Definición del límite de horas previas para cancelaciones autónomas de los clientes (ej. 2, 4 o 12 horas antes).
    *   **Bloqueo de Días**: Calendario para seleccionar días específicos (feriados, vacaciones, enfermedad) en los cuales no se atenderá, bloqueando turnos automáticamente.
*   **Dashboard Único**:
    *   Visualización de la agenda diaria, semanal y mensual con los turnos reservados.
    *   **Notificaciones en Tiempo Real**: Alerta sonora/visual al recibir reservas `PENDING`.
    *   **Modal de Confirmación de Turno Anónimo**:
        *   Muestra los datos del cliente.
        *   Botón **"Contactar por WhatsApp"**: Genera un link gratuito directo de WhatsApp (`https://wa.me/[telefono]?text=[mensaje_personalizado]`) para abrir el chat y coordinar sin costos de API.
        *   Acciones para **Confirmar** (cambia a `CONFIRMED` y activa el recordatorio automático) o **Rechazar/Cancelar**.
    *   CRUD de Turnos: Cancelar turno, modificar horario/fecha, liberar slot, o marcar como "Completado".

*   **Panel de Estadísticas (Analytics)**:
    *   Métricas clave de negocio: Total de turnos agendados, completados y cancelados.
    *   Gráficos/indicadores de días y horarios con mayor demanda para optimizar la agenda.
    *   Clientes más recurrentes (fidelización).
*   **Integraciones en Perfil**:
    *   Activar/desactivar sincronización con Google Calendar.
    *   Configuración de recordatorios (si quiere WhatsApp, Email o ambos).

### 2.4 Administrador de la Plataforma (Admin General)
*   **Acceso de Seguridad**: Filtro por rol `ADMIN` en el middleware de Next.js.
*   **Dashboard Global**:
    *   Métricas generales: Cantidad de tiendas activas, volumen de turnos general, tasa de entrega de notificaciones (WhatsApp/Email).
*   **Gestión de Tiendas (CRUD)**:
    *   Listado de tiendas, creadores e historial.
    *   Acción para suspender o desactivar tiendas de la visualización pública.
*   **Moderación de Comentarios**:
    *   Listado de reseñas para eliminar comentarios ofensivos o sospechosos de spam.


---

## 3. Modelo de Datos (Prisma Schema Tentativo)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  USER
  OWNER
  ADMIN
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  CANCELLED
  COMPLETED
}

model User {
  id            String        @id @default(cuid())
  name          String?
  email         String?       @unique
  emailVerified DateTime?
  image         String?
  role          Role          @default(USER)
  accounts      Account[]
  sessions      Session[]
  
  // Relaciones
  store         Store?        // Si es OWNER, tiene una tienda
  reviews       Review[]      // Si es USER, puede dejar reviews
  appointments  Appointment[] // Si es USER, turnos asociados a su cuenta
  favoriteStores Store[]      @relation("UserFavorites") // Tiendas favoritas
}

model Store {
  id            String        @id @default(cuid())
  name          String
  slug          String        @unique // Para la URL única de la tienda
  description   String?
  address       String
  phone         String?
  specialty     String        // Ej: "Peluquería", "Veterinaria"
  ownerId       String        @unique
  owner         User          @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  
  // Configuración de Agenda
  timezone            String  @default("America/Argentina/Buenos_Aires") // IANA timezone de la tienda
  slotDuration        Int     @default(60) // Duración en minutos de cada turno
  maxParallelBookings Int     @default(1)  // Cuántos clientes pueden agendar el mismo slot horario
  maxSlotsPerDay      Int     @default(0)  // Límite total de turnos por día (0 = sin límite)
  cancelationLimit    Int     @default(2)  // Límite de cancelación autónoma en horas antes del turno
  businessHours BusinessHour[]
  blockedDates  BlockedDate[]

  // Relaciones
  appointments  Appointment[]
  reviews       Review[]
  calendarSync  CalendarSync?
  favoritedBy   User[]        @relation("UserFavorites") // Clientes que la marcaron favorita
}

model BlockedDate {
  id        String   @id @default(cuid())
  storeId   String
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  date      DateTime @db.Date // Solo fecha, sin hora (día completo bloqueado)
  reason    String?  // Ej: "Feriado", "Vacaciones", "Enfermedad"
}



model BusinessHour {
  id        String   @id @default(cuid())
  storeId   String
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  dayOfWeek Int      // 0 = Domingo, 1 = Lunes, etc.
  openTime  String   // Formato "HH:MM" en hora local de la tienda
  closeTime String   // Formato "HH:MM" en hora local. Si closeTime <= openTime, cruza la medianoche (ej: 20:00-02:00)
}

model Appointment {
  id          String            @id @default(cuid())
  storeId     String
  store       Store             @relation(fields: [storeId], references: [id], onDelete: Cascade)
  userId      String?           // Opcional por si es cliente anónimo
  user        User?             @relation(fields: [userId], references: [id])
  
  // Datos del cliente (obligatorios siempre, incluso si es anónimo)
  clientName  String
  clientPhone String
  clientEmail String

  // Detalles del Turno
  dateTime    DateTime          // Siempre en UTC; convertir a timezone de la store para display
  service     String?           // Ej: "Corte de pelo", "Baño", "Consulta general"
  status      AppointmentStatus @default(CONFIRMED)
  notes       String?
  
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([storeId, dateTime])  // Crítico: consulta de agenda y búsqueda de slots libres
}

model Review {
  id        String   @id @default(cuid())
  storeId   String
  store     Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  rating    Int      // 1 al 5
  comment   String?
  createdAt DateTime @default(now())

  @@unique([storeId, userId]) // Un cliente = una reseña por tienda
}

model CalendarSync {
  id           String   @id @default(cuid())
  storeId      String   @unique
  store        Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  accessToken  String
  refreshToken String
  expiryDate   DateTime
  calendarId   String?  // Id del calendario creado para la tienda
}

// Modelos necesarios para Auth.js (NextAuth)
model Account {
  id                 String  @id @default(cuid())
  userId             String
  type               String
  provider           String
  providerAccountId  String
  refresh_token      String?  @db.Text
  access_token       String?  @db.Text
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String?  @db.Text
  session_state      String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 4. Estrategia de Recordatorios e Integraciones

### 4.1 WhatsApp (Meta Cloud API)

La integración de WhatsApp tiene **dos canales distintos** con costos y autorizaciones diferentes:

#### 4.1.1 Link Directo (Gratuito — para el dueño)
*   Cuando un cliente anónimo reserva (estado `PENDING`), el dueño ve en el dashboard un botón "Contactar por WhatsApp".
*   Este botón genera un link **gratuito** `https://wa.me/<telefono>` con un mensaje predefinido.
*   No requiere API Key, no tiene costo, no necesita template aprobado. Es simplemente un deep link que abre WhatsApp.

#### 4.1.2 Recordatorio Automático (API de Meta — con costos)
*   **Arquitectura**: Número virtual central de la plataforma de turnos, verificado en Meta Business.
*   **Requisitos previos**: Template de mensaje aprobado por Meta, número verificado, y WABA (WhatsApp Business Account) activa.
*   **Flujo**:
    1. El backend corre un Cron Job (ej. cada 15 minutos).
    2. Busca turnos que ocurran exactamente en la próxima hora (e.g. 60 minutos adelante) con estado `CONFIRMED`.
    3. Dispara una petición HTTP a la API de Meta enviando el template pre-aprobado (ej: *"Hola {{1}}, te recordamos tu turno en {{2}} para el día {{3}} a las {{4}} hs."*).
    4. Guarda el `messageId` de la respuesta para tracking de entrega.
*   **Fallback**: Si la API de WhatsApp falla (cupo diario excedido, token expirado), cae en el envío por Email como respaldo.

### 4.2 Email (Resend)
*   **Uso doble**:
    1. **Confirmación**: Email enviado inmediatamente después de realizar la reserva con los detalles del turno y el link único de cancelación/reprogramación.
    2. **Respaldo**: En caso de que falle el envío de WhatsApp o como canal secundario, se envía un recordatorio 1 hora antes.

### 4.3 Google Calendar
*   **Flujo Unidireccional**:
    1. Al reservar un turno en la app, si la tienda tiene `CalendarSync` configurado, la app realiza un insert en la API de Google Calendar de esa cuenta.
    2. Si el turno se cancela o modifica desde la app, se actualiza o elimina el evento correspondiente en Google Calendar usando el ID del evento guardado.

---

## 5. Próximos Pasos de Diseño y UX
*   **Landing Page**: Diseño limpio con tarjetas de tiendas, filtros tipo píldoras por categorías e indicador visual de valoración por estrellas.
*   **Dashboard del Dueño**: Calendario interactivo premium con vista de bloques de horas, drag-and-drop para mover turnos (opcional/futuro), y estados representados por colores amigables (ej: Verde = Completado, Azul = Confirmado, Rojo = Cancelado).
