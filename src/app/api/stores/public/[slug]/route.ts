import prisma from "@/lib/prisma"

interface RouteParams {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params

  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      businessHours: true,
      reviews: { select: { rating: true } },
    },
  })

  if (!store) {
    return Response.json({ error: "Store not found" }, { status: 404 })
  }

  const ratings = store.reviews.map((r) => r.rating)
  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0

  return Response.json({
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    address: store.address,
    phone: store.phone,
    specialty: store.specialty,
    timezone: store.timezone,
    businessHours: store.businessHours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime,
      closeTime: h.closeTime,
    })),
    averageRating,
    reviewCount: ratings.length,
  })
}
