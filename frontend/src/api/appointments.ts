import { get, post, put } from "./client"
import type {
  Appointment,
  AppointmentAction,
  AppointmentStatus,
  CreateAppointmentInput,
} from "./types"

const BASE = "/api/stores"

export interface AppointmentFilters {
  date?: string // YYYY-MM-DD
  status?: AppointmentStatus
}

export function listAppointments(storeId: string, filters: AppointmentFilters = {}): Promise<Appointment[]> {
  const search = new URLSearchParams()
  if (filters.date) search.set("date", filters.date)
  if (filters.status) search.set("status", filters.status)
  const qs = search.toString()
  return get<Appointment[]>(`${BASE}/${encodeURIComponent(storeId)}/appointments${qs ? `?${qs}` : ""}`)
}

export function createAppointment(storeId: string, payload: CreateAppointmentInput): Promise<Appointment> {
  return post<Appointment>(`${BASE}/${encodeURIComponent(storeId)}/appointments`, payload)
}

export function updateStatus(
  storeId: string,
  appointmentId: string,
  action: AppointmentAction,
): Promise<Appointment> {
  return put<Appointment>(
    `${BASE}/${encodeURIComponent(storeId)}/appointments/${encodeURIComponent(appointmentId)}`,
    { action },
  )
}

export function reschedule(
  storeId: string,
  appointmentId: string,
  slot: { date: string; time: string },
): Promise<Appointment> {
  return put<Appointment>(
    `${BASE}/${encodeURIComponent(storeId)}/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
    slot,
  )
}
