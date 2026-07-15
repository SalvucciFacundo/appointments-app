import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { parsePagination, paginatedResponse } from "@/lib/pagination"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const { skip, take, page } = parsePagination(url)

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        skip,
        take,
        include: {
          store: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.review.count(),
    ])

    const data = reviews.map((r) => ({
      id: r.id,
      storeId: r.storeId,
      storeName: r.store.name,
      userId: r.userId,
      userName: r.user.name ?? r.user.email,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    }))

    return Response.json(paginatedResponse(data, total, page, take))
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
