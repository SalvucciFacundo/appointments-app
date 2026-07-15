import prisma from "@/lib/prisma"
import { getAvailableSlots } from "@/lib/slots"

interface RouteParams {
  params: Promise<{ storeId: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { storeId: slug } = await params
  const url = new URL(request.url)
  const date = url.searchParams.get("date")

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json(
      { error: "Query parameter 'date' is required (YYYY-MM-DD)" },
      { status: 400 },
    )
  }

  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      businessHours: true,
      blockedDates: true,
    },
  })

  if (!store) {
    return Response.json({ error: "Store not found" }, { status: 404 })
  }

  const appointments = await prisma.appointment.findMany({
    where: { storeId: store.id },
    select: { dateTime: true },
  })

  const slots = getAvailableSlots(
    {
      businessHours: store.businessHours,
      blockedDates: store.blockedDates.map((bd) => ({
        date: bd.date.toISOString().slice(0, 10),
      })),
      slotDuration: store.slotDuration,
      maxParallelBookings: store.maxParallelBookings,
      maxSlotsPerDay: store.maxSlotsPerDay,
      timezone: store.timezone,
    },
    date,
    appointments,
  )

  return Response.json(slots)
}
