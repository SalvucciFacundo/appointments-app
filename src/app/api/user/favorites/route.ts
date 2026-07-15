import { requireAuth } from "@/lib/api-helpers"
import prisma from "@/lib/prisma"

function computeAvgRating(reviews: { rating: number }[]): number {
  if (reviews.length === 0) return 0
  const sum = reviews.reduce((a, b) => a + b.rating, 0)
  return Math.round((sum / reviews.length) * 10) / 10
}

export async function GET() {
  try {
    const session = await requireAuth()
    const userId = session.user.id!

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        favoriteStores: {
          include: { reviews: { select: { rating: true } } },
        },
      },
    })

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 })
    }

    const favorites = user.favoriteStores.map((store) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      specialty: store.specialty,
      address: store.address,
      averageRating: computeAvgRating(store.reviews),
      reviewCount: store.reviews.length,
    }))

    return Response.json(favorites)
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth()
    const userId = session.user.id!

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { storeId } = body

    if (!storeId || typeof storeId !== "string") {
      return Response.json(
        { error: "storeId is required" },
        { status: 400 },
      )
    }

    // Check store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId as string },
    })

    if (!store) {
      return Response.json({ error: "Store not found" }, { status: 404 })
    }

    // Check current favorite state
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        favoriteStores: {
          where: { id: storeId as string },
          select: { id: true },
        },
      },
    })

    const isFavorite = (current?.favoriteStores?.length ?? 0) > 0

    if (isFavorite) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          favoriteStores: { disconnect: { id: storeId as string } },
        },
      })
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: {
          favoriteStores: { connect: { id: storeId as string } },
        },
      })
    }

    // Return updated list
    const updated = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        favoriteStores: {
          include: { reviews: { select: { rating: true } } },
        },
      },
    })

    const favorites = (updated?.favoriteStores ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      specialty: s.specialty,
      address: s.address,
      averageRating: computeAvgRating(s.reviews),
      reviewCount: s.reviews.length,
    }))

    return Response.json(favorites)
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
