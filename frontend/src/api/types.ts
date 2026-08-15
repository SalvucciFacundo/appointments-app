// ---- Types ----

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"

export type AppointmentAction = "CONFIRM" | "REJECT" | "COMPLETE"

export interface BusinessHour {
  id: string
  storeId: string
  dayOfWeek: number
  openTime: string // HH:MM
  closeTime: string // HH:MM
}

export interface BusinessHourInput {
  dayOfWeek: number
  openTime: string // HH:MM
  closeTime: string // HH:MM
}

export interface BlockedDate {
  id: string
  storeId: string
  date: string // YYYY-MM-DD
  reason: string | null
}

export interface BlockedDateInput {
  date: string
  reason?: string
}

/** Store card shown on the public landing page. */
export interface StoreCard {
  id: string
  name: string
  slug: string
  specialty: string
  address: string
  averageRating: number
  reviewCount: number
}

/** Store detail returned to the public store page (info + hours). */
export interface PublicStore {
  id: string
  name: string
  slug: string
  description: string | null
  address: string
  phone: string | null
  specialty: string
  timezone: string
  businessHours: BusinessHour[]
  averageRating: number
  reviewCount: number
}

/** Full owner store record (from the owner API). */
export interface Store {
  id: string
  name: string
  slug: string
  description: string | null
  address: string
  phone: string | null
  latitude: number | null
  longitude: number | null
  specialty: string
  ownerId: string
  timezone: string
  slotDuration: number
  maxParallelBookings: number
  maxSlotsPerDay: number
  cancelationLimit: number
  suspended: boolean
}

/** Owner store detail: store plus hours and blocked dates. */
export interface StoreDetail extends Store {
  businessHours: BusinessHour[]
  blockedDates: BlockedDate[]
}

export interface TimeSlot {
  start: string // HH:MM
  end: string // HH:MM
  available: boolean
  currentBookings: number
}

export interface Appointment {
  id: string
  storeId: string
  clientName: string
  clientPhone: string
  clientEmail: string
  dateTime: string // RFC3339 UTC
  service: string | null
  status: AppointmentStatus
  notes: string | null
  managementToken?: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Error contract: {error:{code,message,field}}. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    field?: string
  }
}

// ---- Input payloads ----

export interface CreateStoreInput {
  name: string
  description?: string
  address: string
  phone?: string
  latitude?: number
  longitude?: number
  specialty: string
}

export interface UpdateStoreInput {
  name?: string
  description?: string
  address?: string
  phone?: string
  latitude?: number
  longitude?: number
  specialty?: string
  slotDuration?: number
  maxParallelBookings?: number
  maxSlotsPerDay?: number
  cancelationLimit?: number
}

export interface BookInput {
  date: string // YYYY-MM-DD
  time: string // HH:MM
  clientName: string
  clientPhone: string
  clientEmail: string
  service?: string
  notes?: string
}

export interface CreateAppointmentInput {
  date: string // YYYY-MM-DD
  time: string // HH:MM
  clientName: string
  clientPhone: string
  clientEmail: string
  service?: string
  notes?: string
  status?: AppointmentStatus
}
