import prisma from "@/lib/prisma"
import { assertOwnerAccess, validateFutureDate } from "@/lib/api-helpers"

interface RouteParams {
  params: Promise<{ storeId: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const { storeId } = await params

  try {
    await assertOwnerAccess(storeId)

    const body = await request.json().catch(() => ({}))
    const { date, reason } = body as { date?: string; reason?: string }

    if (!date || typeof date !== "string") {
      return Response.json(
        { error: "Validation failed", errors: [{ field: "date", message: "Date is required" }] },
        { status: 400 },
      )
    }

    const dateErr = validateFutureDate(date)
    if (dateErr) {
      return Response.json(
        { error: "Validation failed", errors: [{ field: "date", message: dateErr }] },
        { status: 400 },
      )
    }

    const blockedDate = await prisma.blockedDate.create({
      data: {
        storeId,
        date: new Date(date),
        reason: typeof reason === "string" ? reason.trim() || null : null,
      },
    })

    return Response.json(blockedDate, { status: 201 })
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
