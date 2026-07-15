// ---- Types ----

export interface StoreData {
  id: string
  name: string
  slug: string
  description: string | null
  address: string
  phone: string | null
  latitude: number | null
  longitude: number | null
  specialty: string
  timezone: string
  slotDuration: number
  maxParallelBookings: number
  maxSlotsPerDay: number
  cancelationLimit: number
  businessHours: BusinessHour[]
  blockedDates: BlockedDateData[]
}

export interface BusinessHour {
  id: string
  dayOfWeek: number
  openTime: string
  closeTime: string
}

export interface BlockedDateData {
  id: string
  date: string
  reason: string | null
}

export interface CreateStoreInput {
  name: string
  description?: string
  address: string
  phone?: string
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

export interface BusinessHourInput {
  dayOfWeek: number
  openTime: string
  closeTime: string
}

export interface BlockedDateInput {
  date: string
  reason?: string
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

export async function createStore(data: CreateStoreInput): Promise<StoreData> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return handleResponse<StoreData>(res)
}

export async function getUserStores(): Promise<StoreData[]> {
  const res = await fetch(API_BASE, {
    headers: { "Content-Type": "application/json" },
  })
  if (res.status === 404) return []
  return handleResponse<StoreData[]>(res)
}

export async function getStoreById(storeId: string): Promise<StoreData | null> {
  const res = await fetch(`${API_BASE}?storeId=${storeId}`, {
    headers: { "Content-Type": "application/json" },
  })
  if (res.status === 404) return null
  return handleResponse<StoreData>(res)
}

/** @deprecated Use getUserStores() instead — returns list of stores */
export async function getCurrentStore(): Promise<StoreData | null> {
  const stores = await getUserStores()
  return stores[0] ?? null
}

export async function updateStore(id: string, data: UpdateStoreInput): Promise<StoreData> {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return handleResponse<StoreData>(res)
}

export async function updateHours(id: string, hours: BusinessHourInput[]): Promise<BusinessHour[]> {
  const res = await fetch(`${API_BASE}/${id}/hours`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(hours),
  })
  return handleResponse<BusinessHour[]>(res)
}

export async function addBlockedDate(
  id: string,
  date: string,
  reason?: string,
): Promise<BlockedDateData> {
  const body: BlockedDateInput = { date }
  if (reason) body.reason = reason

  const res = await fetch(`${API_BASE}/${id}/blocked-dates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return handleResponse<BlockedDateData>(res)
}

export async function removeBlockedDate(storeId: string, blockedDateId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${storeId}/blocked-dates/${blockedDateId}`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw {
      error: body.error ?? `Request failed with status ${res.status}`,
    } as ApiError
  }
}
