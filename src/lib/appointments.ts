// ---- Types ----

export interface AppointmentData {
  id: string
  storeId: string
  clientName: string
  clientPhone: string
  clientEmail: string
  dateTime: string
  service: string | null
  status: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAppointmentInput {
  clientName: string
  clientPhone: string
  clientEmail: string
  dateTime: string
  service?: string
  notes?: string
  status?: "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED"
}

export interface ApiError {
  error: string
  errors?: { field: string; message: string }[]
}

// ---- Helpers ----

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err: ApiError = {
      error: body.error ?? body.message ?? `Request failed with status ${res.status}`,
      errors: body.errors,
    }
    throw err
  }
  return res.json()
}

const API_BASE = "/api/stores"

// ---- API Client Functions ----

export async function listAppointments(
  storeId: string,
  filters?: { date?: string; status?: string },
): Promise<AppointmentData[]> {
  const params = new URLSearchParams()
  if (filters?.date) params.set("date", filters.date)
  if (filters?.status) params.set("status", filters.status)

  const qs = params.toString()
  const url = `${API_BASE}/${storeId}/appointments${qs ? `?${qs}` : ""}`

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
  })
  return handleResponse<AppointmentData[]>(res)
}

export async function createAppointment(
  storeId: string,
  data: CreateAppointmentInput,
): Promise<AppointmentData> {
  const res = await fetch(`${API_BASE}/${storeId}/appointments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return handleResponse<AppointmentData>(res)
}

export async function updateAppointmentStatus(
  storeId: string,
  id: string,
  action: "CONFIRM" | "REJECT" | "COMPLETE",
): Promise<AppointmentData> {
  const res = await fetch(`${API_BASE}/${storeId}/appointments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  })
  return handleResponse<AppointmentData>(res)
}

export async function rescheduleAppointment(
  storeId: string,
  id: string,
  dateTime: string,
): Promise<AppointmentData> {
  const res = await fetch(`${API_BASE}/${storeId}/appointments/${id}/reschedule`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dateTime }),
  })
  return handleResponse<AppointmentData>(res)
}
