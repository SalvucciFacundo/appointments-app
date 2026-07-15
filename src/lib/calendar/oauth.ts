import { google } from "googleapis"
import type { CalendarSync } from "@prisma/client"
import prisma from "@/lib/prisma"

const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI

function createOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID!, CLIENT_SECRET!, REDIRECT_URI!)
}

/**
 * Returns the Google OAuth URL to initiate the Calendar authorization flow.
 * The storeId is embedded in the `state` parameter and returned to the callback.
 */
export function getAuthUrl(storeId: string): string {
  const client = createOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state: storeId,
  })
}

/**
 * Exchanges an authorization code for access + refresh tokens.
 * Returns the raw token response from Google.
 */
export async function getTokens(code: string) {
  const client = createOAuthClient()
  const { tokens } = await client.getToken(code)
  return tokens
}

/**
 * Returns true when the token is already expired (or within 5 minutes of expiring).
 */
export function isTokenExpired(expiryDate: Date): boolean {
  const FIVE_MIN = 5 * 60 * 1000
  return Date.now() >= expiryDate.getTime() - FIVE_MIN
}

/**
 * Given a CalendarSync record, ensures the access token is fresh (refreshes if
 * needed and persists the new token to the database), then returns an
 * authenticated OAuth2Client ready for Calendar API calls.
 */
export async function refreshAccessToken(
  sync: Pick<CalendarSync, "id" | "accessToken" | "refreshToken" | "expiryDate">,
) {
  const client = createOAuthClient()
  client.setCredentials({
    access_token: sync.accessToken,
    refresh_token: sync.refreshToken,
  })

  if (isTokenExpired(sync.expiryDate)) {
    const { credentials } = await client.refreshAccessToken()
    const newExpiry = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000)

    await prisma.calendarSync.update({
      where: { id: sync.id },
      data: {
        accessToken: credentials.access_token ?? sync.accessToken,
        expiryDate: newExpiry,
      },
    })

    client.setCredentials({
      access_token: credentials.access_token ?? sync.accessToken,
      refresh_token: credentials.refresh_token ?? sync.refreshToken,
      expiry_date: newExpiry.getTime(),
    })
  }

  return client
}

/**
 * Records a sync error on the CalendarSync record so the dashboard
 * can display reconnection warnings to the owner.
 */
export async function recordSyncError(syncId: string, errorMessage: string): Promise<void> {
  try {
    await prisma.calendarSync.update({
      where: { id: syncId },
      data: { lastSyncError: errorMessage.slice(0, 500) },
    })
  } catch {
    // Silently fail — error recording is non-critical
  }
}

/**
 * Clears the sync error after a successful operation.
 */
export async function clearSyncError(syncId: string): Promise<void> {
  try {
    await prisma.calendarSync.update({
      where: { id: syncId },
      data: { lastSyncError: null, lastSyncAt: new Date() },
    })
  } catch {
    // Silently fail
  }
}
