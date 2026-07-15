import prisma from "@/lib/prisma"
import { assertOwnerAccess } from "@/lib/api-helpers"

interface RouteParams {
  params: Promise<{ storeId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { storeId } = await params

  try {
    const { store } = await assertOwnerAccess(storeId)

    const fullStore = await prisma.store.findUnique({
      where: { id: store.id },
      include: {
        businessHours: true,
        blockedDates: true,
      },
    })

    return Response.json(fullStore)
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { storeId } = await params

  try {
    await assertOwnerAccess(storeId)

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}

    const allowedFields = [
      "name",
      "description",
      "address",
      "phone",
      "specialty",
      "slotDuration",
      "maxParallelBookings",
      "maxSlotsPerDay",
      "cancelationLimit",
    ]

    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    const store = await prisma.store.update({
      where: { id: storeId },
      data: updates,
    })

    return Response.json(store)
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
