import { requireAuth } from "@/lib/api-helpers"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const session = await requireAuth()
    const userId = session.user.id!

    const appointments = await prisma.appointment.findMany({
      where: { userId },
      include: {
        store: { select: { name: true, slug: true } },
      },
      orderBy: { dateTime: "desc" },
    })

    const result = appointments.map((apt) => ({
      id: apt.id,
      storeName: apt.store.name,
      storeSlug: apt.store.slug,
      clientName: apt.clientName,
      clientPhone: apt.clientPhone,
      clientEmail: apt.clientEmail,
      dateTime: apt.dateTime.toISOString(),
      service: apt.service,
      status: apt.status,
      notes: apt.notes,
      createdAt: apt.createdAt.toISOString(),
    }))

    return Response.json(result)
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
