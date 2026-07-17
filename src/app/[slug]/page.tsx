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
    <div className="mx-auto max-w-3xl px-4 py-8 animate-fadeIn">
      {/* Store Header */}
      <section className="mb-8">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--accent-light)]">
            <span className="text-2xl">
              {store.specialty === "Barbería" || store.specialty === "Peluquería" ? "💈" :
               store.specialty === "Masajes" ? "💆" :
               store.specialty === "Manicura" ? "💅" : "🏪"}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {store.name}
            </h1>
            {store.description && (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {store.description}
              </p>
            )}
          </div>
        </div>

        {/* Info chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {store.address && (
            <a
              href={
                store.latitude && store.longitude
                  ? `https://www.google.com/maps?q=${store.latitude},${store.longitude}`
                  : `https://www.google.com/maps/search/${encodeURIComponent(store.address)}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {store.address}
            </a>
          )}
          {store.phone && (
            <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
              <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              {store.phone}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--accent-light)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]">
            {store.specialty}
          </span>
          {avgRating > 0 && (
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
              ⭐ {avgRating} ({ratings.length} reseña{ratings.length !== 1 ? "s" : ""})
            </span>
          )}
        </div>
      </section>

      {/* Business Hours */}
      {store.businessHours.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)] tracking-tight">
            Horarios
          </h2>
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
            {store.businessHours.map((h) => (
              <div
                key={h.id}
                className="flex justify-between border-b border-[var(--border-subtle)] px-4 py-2.5 text-sm last:border-b-0"
              >
                <span className="font-medium text-[var(--text-primary)]">
                  {DAY_NAMES[h.dayOfWeek]}
                </span>
                <span className="text-[var(--text-tertiary)]">
                  {h.openTime} – {h.closeTime}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Booking */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)] tracking-tight">
          Reservar un turno
        </h2>
        <BookingWidget slug={slug} />
      </section>
    </div>
  )
}
