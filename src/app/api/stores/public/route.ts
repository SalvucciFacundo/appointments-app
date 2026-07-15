import prisma from "@/lib/prisma"
import { parsePagination, paginatedResponse } from "@/lib/pagination"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const { skip, take, page } = parsePagination(url)
  const specialty = url.searchParams.get("specialty")

  const where: Record<string, unknown> = {}
  if (specialty) {
    where.specialty = { contains: specialty, mode: "insensitive" }
  }

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where,
      skip,
      take,
      include: { reviews: { select: { rating: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.store.count({ where }),
  ])

  const data = stores.map((store) => {
    const ratings = store.reviews.map((r) => r.rating)
    const averageRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0

    return {
      id: store.id,
      name: store.name,
      slug: store.slug,
      specialty: store.specialty,
      address: store.address,
      averageRating,
      reviewCount: ratings.length,
    }
  })

  return Response.json(paginatedResponse(data, total, page, take))
}
