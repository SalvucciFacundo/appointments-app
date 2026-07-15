import { requireAuth } from "@/lib/api-helpers"
import prisma from "@/lib/prisma"
import { checkRateLimit, getClientId } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const session = await requireAuth()
    const userId = session.user.id
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting: 10 reviews per minute per user
    const rateLimit = checkRateLimit(getClientId(request, userId), 10, 60_000)
    if (!rateLimit.allowed) {
      return Response.json(
        { error: "Too many requests. Try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        },
      )
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { storeId, rating, comment } = body

    // Validation
    if (!storeId || typeof storeId !== "string") {
      return Response.json(
        { error: "storeId is required" },
        { status: 400 },
      )
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return Response.json(
        { error: "rating must be a number between 1 and 5" },
        { status: 400 },
      )
    }

    // Check user has at least one COMPLETED appointment with this store
    const completedAppointment = await prisma.appointment.findFirst({
      where: {
        userId,
        storeId: storeId as string,
        status: "COMPLETED",
      },
    })

    if (!completedAppointment) {
      return Response.json(
        {
          error:
            "You must have at least one completed appointment with this store to leave a review",
        },
        { status: 403 },
      )
    }

    // Create review (Prisma handles @@unique constraint)
    const review = await prisma.review.create({
      data: {
        storeId: storeId as string,
        userId,
        rating: rating as number,
        comment:
          typeof comment === "string" ? (comment as string).trim() || null : null,
      },
    })

    return Response.json(
      {
        id: review.id,
        storeId: review.storeId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      },
      { status: 201 },
    )
  } catch (e) {
    if (e instanceof Response) return e

    // Prisma unique constraint violation
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      return Response.json(
        { error: "You have already reviewed this store" },
        { status: 409 },
      )
    }

    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
