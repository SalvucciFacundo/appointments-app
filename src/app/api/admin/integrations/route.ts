import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.role || session.user.role !== "ADMIN") {
    return Response.json({ error: "Unauthorized" }, { status: 403 })
  }

  const resendConfigured = !!process.env.RESEND_API_KEY
  const cronSecretConfigured = !!process.env.CRON_SECRET
  const googleCalendarConfigured =
    !!process.env.GOOGLE_CALENDAR_CLIENT_ID && !!process.env.GOOGLE_CALENDAR_CLIENT_SECRET

  const storesWithCalendarSync = await prisma.calendarSync.count()
  const totalStores = await prisma.store.count()

  return Response.json({
    email: {
      provider: "Resend",
      configured: resendConfigured,
      note: resendConfigured ? "API key configured" : "Missing RESEND_API_KEY",
    },
    whatsapp: {
      provider: "Meta Cloud API",
      configured: false,
      note: "WABA setup required — currently using stub mode",
    },
    cron: {
      configured: cronSecretConfigured,
      note: cronSecretConfigured ? "CRON_SECRET configured" : "Missing CRON_SECRET",
    },
    googleCalendar: {
      configured: googleCalendarConfigured,
      storesConnected: storesWithCalendarSync,
      totalStores,
      note: googleCalendarConfigured
        ? `${storesWithCalendarSync}/${totalStores} stores connected`
        : "Missing Google Calendar OAuth credentials",
    },
  })
}
