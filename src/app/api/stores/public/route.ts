import prisma from "@/lib/prisma"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const specialty = url.searchParams.get("specialty")

  const where: Record<string, unknown> = {}
  if (specialty) {
    where.specialty = { contains: specialty, mode: "insensitive" }
  }

  const stores = await prisma.store.findMany({
    where,
    include: { reviews: { select: { rating: true } } },
  })

  const result = stores.map((store) => {
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

  return Response.json(result)
}
