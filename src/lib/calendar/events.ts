import { google } from "googleapis"
import { refreshAccessToken } from "./oauth"
import type { CalendarSync, Store } from "@prisma/client"

interface CalendarEventInput {
  id: string
  clientName: string
  clientEmail: string
  dateTime: Date
  service: string | null
  notes: string | null
}

/**
 * Creates a Google Calendar event for the given appointment.
 * Returns the Google event ID on success, or null on failure.
 */
export async function createEvent(
  sync: Pick<CalendarSync, "id" | "accessToken" | "refreshToken" | "expiryDate">,
  appointment: CalendarEventInput,
  store: Pick<Store, "name" | "timezone">,
): Promise<string | null> {
  try {
    const auth = await refreshAccessToken(sync)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calendar = google.calendar({ version: "v3", auth: auth as any })

    const startDateTime = appointment.dateTime
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000)

    const summary = appointment.service
      ? `${appointment.service} — ${appointment.clientName}`
      : `Appointment — ${appointment.clientName}`

    let description = `Client: ${appointment.clientName}\n`
    description += `Email: ${appointment.clientEmail}\n`
    if (appointment.notes) description += `Notes: ${appointment.notes}\n`

    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary,
        description,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: store.timezone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: store.timezone,
        },
        attendees: [{ email: appointment.clientEmail }],
      },
    })

    return response.data.id ?? null
  } catch (err) {
    console.error("[calendar] Failed to create event:", err)
    return null
  }
}

/**
 * Updates an existing Google Calendar event (reschedule or status change).
 * Returns true on success, false on failure.
 */
export async function updateEvent(
  sync: Pick<CalendarSync, "id" | "accessToken" | "refreshToken" | "expiryDate">,
  eventId: string,
  appointment: CalendarEventInput,
  store: Pick<Store, "name" | "timezone">,
): Promise<boolean> {
  try {
    const auth = await refreshAccessToken(sync)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calendar = google.calendar({ version: "v3", auth: auth as any })

    const startDateTime = appointment.dateTime
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000)

    const summary = appointment.service
      ? `${appointment.service} — ${appointment.clientName}`
      : `Appointment — ${appointment.clientName}`

    await calendar.events.update({
      calendarId: "primary",
      eventId,
      requestBody: {
        summary,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: store.timezone,
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: store.timezone,
        },
      },
    })

    return true
  } catch (err) {
    console.error("[calendar] Failed to update event:", err)
    return false
  }
}

/**
 * Deletes a Google Calendar event by ID.
 * Returns true on success or if the event was already deleted, false on other failures.
 */
export async function deleteEvent(
  sync: Pick<CalendarSync, "id" | "accessToken" | "refreshToken" | "expiryDate">,
  eventId: string,
): Promise<boolean> {
  try {
    const auth = await refreshAccessToken(sync)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calendar = google.calendar({ version: "v3", auth: auth as any })

    await calendar.events.delete({
      calendarId: "primary",
      eventId,
    })

    return true
  } catch (err: unknown) {
    // 410 Gone means the event was already deleted — treat as success
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: number }).code === 410
    ) {
      return true
    }
    console.error("[calendar] Failed to delete event:", err)
    return false
  }
}
