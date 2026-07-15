import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const reviews = await prisma.review.findMany({
      include: {
        store: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    const result = reviews.map((r) => ({
      id: r.id,
      storeId: r.storeId,
      storeName: r.store.name,
      userId: r.userId,
      userName: r.user.name ?? r.user.email,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    }))

    return Response.json(result)
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
