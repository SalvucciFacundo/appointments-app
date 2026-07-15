import prisma from "@/lib/prisma"
import { sendReminderEmail } from "@/lib/email"
import { sendWhatsAppReminder } from "@/lib/whatsapp"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return Response.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    )
  }

  const expected = `Bearer ${cronSecret}`
  if (authHeader !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000)

  const appointments = await prisma.appointment.findMany({
    where: {
      status: "CONFIRMED",
      dateTime: {
        gte: now,
        lte: oneHourFromNow,
      },
    },
    include: {
      store: { select: { name: true } },
    },
  })

  let sent = 0
  let failed = 0

  for (const appt of appointments) {
    try {
      await sendReminderEmail({
        to: appt.clientEmail,
        clientName: appt.clientName,
        storeName: appt.store.name,
        dateTime: appt.dateTime,
        service: appt.service,
      })
      sent++
    } catch {
      failed++
    }
  }

  // WhatsApp stub: log, never count as failure
  for (const appt of appointments) {
    await sendWhatsAppReminder({
      phone: appt.clientPhone,
      clientName: appt.clientName,
      storeName: appt.store.name,
      dateTime: appt.dateTime,
      service: appt.service,
    }).catch(() => {
      // stub never actually fails, but guard anyway
    })
  }

  return Response.json({ sent, failed })
}
