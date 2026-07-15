import { notFound } from "next/navigation"
import prisma from "@/lib/prisma"
import BookingWidget from "@/app/[slug]/BookingWidget"

interface PageParams {
  params: Promise<{ slug: string }>
}

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

export default async function StorePage({ params }: PageParams) {
  const { slug } = await params

  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      businessHours: { orderBy: { dayOfWeek: "asc" } },
      reviews: { select: { rating: true } },
    },
  })

  if (!store) {
    notFound()
  }

  const ratings = store.reviews.map((r) => r.rating)
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : 0

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Store Info */}
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {store.name}
        </h1>
        {store.description && (
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {store.description}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span>{store.address}</span>
          {store.phone && <span>{store.phone}</span>}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {store.specialty}
          </span>
        </div>
        {avgRating > 0 && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            ⭐ {avgRating} ({ratings.length} reseña{ratings.length !== 1 ? "s" : ""})
          </p>
        )}
      </section>

      {/* Business Hours */}
      {store.businessHours.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Horarios
          </h2>
          <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {store.businessHours.map((h) => (
              <div
                key={h.id}
                className="flex justify-between px-4 py-2 text-sm"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {DAY_NAMES[h.dayOfWeek]}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  {h.openTime} – {h.closeTime}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Booking */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Reservar un turno
        </h2>
        <BookingWidget slug={slug} />
      </section>
    </div>
  )
}
