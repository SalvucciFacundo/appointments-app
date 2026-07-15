// Client-side fetch wrappers for Google Calendar sync

interface CalendarStatusResponse {
  enabled: boolean
  calendarId: string | null
  lastSyncError: string | null
  lastSyncAt: string | null
}

interface AuthUrlResponse {
  url: string
}

interface ApiError {
  error: string
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err: ApiError = {
      error: body.error ?? body.message ?? `Request failed with status ${res.status}`,
    }
    throw err
  }
  return res.json()
}

/**
 * Get the current CalendarSync status for a store.
 */
export async function getCalendarStatus(
  storeId: string,
): Promise<CalendarStatusResponse> {
  const res = await fetch(`/api/stores/${storeId}/calendar`, {
    headers: { "Content-Type": "application/json" },
  })
  return handleResponse<CalendarStatusResponse>(res)
}

/**
 * Initiate Google Calendar connection.
 * Returns the OAuth URL; the caller should redirect the user to it.
 */
export async function enableCalendar(storeId: string): Promise<AuthUrlResponse> {
  const res = await fetch(`/api/stores/${storeId}/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  })
  return handleResponse<AuthUrlResponse>(res)
}

/**
 * Disconnect Google Calendar from the store.
 */
export async function disableCalendar(storeId: string): Promise<void> {
  const res = await fetch(`/api/stores/${storeId}/calendar`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw { error: body.error ?? `Request failed with status ${res.status}` } as ApiError
  }
}
