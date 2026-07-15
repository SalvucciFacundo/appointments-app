import prisma from "@/lib/prisma"
import { getTokens } from "@/lib/calendar/oauth"

/**
 * GET /api/calendar/oauth/callback?code=...&state=storeId
 *
 * Google redirects here after the user authorizes calendar access.
 * The `state` parameter contains the storeId we embedded in getAuthUrl().
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const storeId = searchParams.get("state")

  if (!code) {
    return new Response("Missing authorization code.", { status: 400 })
  }

  if (!storeId) {
    return new Response("Missing state parameter (storeId).", { status: 400 })
  }

  try {
    const tokens = await getTokens(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return new Response("Failed to obtain tokens from Google.", { status: 500 })
    }

    const expiryDate = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000)

    // Upsert CalendarSync for this store
    await prisma.calendarSync.upsert({
      where: { storeId },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate,
      },
      create: {
        storeId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate,
      },
    })

    // Redirect to dashboard with success indicator
    return Response.redirect(
      new URL("/dashboard?calendar=connected", request.url).toString(),
    )
  } catch (err) {
    console.error("[calendar/oauth] Callback error:", err)
    return new Response("Authentication failed. Please try again.", {
      status: 500,
    })
  }
}
