import prisma from "@/lib/prisma"
import { assertOwnerAccess, validateTimeFormat, validateDayOfWeek } from "@/lib/api-helpers"

interface RouteParams {
  params: Promise<{ storeId: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { storeId } = await params

  try {
    await assertOwnerAccess(storeId)

    const body = await request.json().catch(() => null)
    if (!Array.isArray(body)) {
      return Response.json(
        { error: "Request body must be an array of business hours" },
        { status: 400 },
      )
    }

    // Validate all entries
    const errors: { field: string; message: string }[] = []
    for (let i = 0; i < body.length; i++) {
      const entry = body[i]
      const prefix = `[${i}]`

      const dayErr = validateDayOfWeek(entry.dayOfWeek)
      if (dayErr) errors.push({ field: `${prefix}.dayOfWeek`, message: dayErr })

      const openErr = validateTimeFormat(entry.openTime, "openTime")
      if (openErr) errors.push({ field: `${prefix}.openTime`, message: openErr })

      const closeErr = validateTimeFormat(entry.closeTime, "closeTime")
      if (closeErr) errors.push({ field: `${prefix}.closeTime`, message: closeErr })
    }

    if (errors.length > 0) {
      return Response.json({ error: "Validation failed", errors }, { status: 400 })
    }

    // Replace all hours in a transaction
    const hours = await prisma.$transaction(async (tx) => {
      await tx.businessHour.deleteMany({ where: { storeId } })
      await tx.businessHour.createMany({
        data: body.map((entry: { dayOfWeek: number; openTime: string; closeTime: string }) => ({
          storeId,
          dayOfWeek: entry.dayOfWeek,
          openTime: entry.openTime,
          closeTime: entry.closeTime,
        })),
      })
      return tx.businessHour.findMany({ where: { storeId } })
    })

    return Response.json(hours)
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
