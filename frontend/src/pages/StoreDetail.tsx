import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { getStoreBySlug } from "@/api/stores"
import type { PublicStore } from "@/api/types"
import BookingWidget from "@/components/appointments/BookingWidget"
import Button from "@/components/ui/Button"

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
]

export default function StoreDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [store, setStore] = useState<PublicStore | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let active = true
    setLoading(true)
    setError(null)

    getStoreBySlug(slug)
      .then((data) => {
        if (active) setStore(data)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Error al cargar el comercio")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [slug])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 skeleton rounded-[var(--radius-xl)]" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-1/2 skeleton" />
              <div className="h-4 w-3/4 skeleton" />
            </div>
          </div>
          <div className="h-32 skeleton rounded-[var(--radius-lg)]" />
          <div className="h-64 skeleton rounded-[var(--radius-lg)]" />
        </div>
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] bg-[var(--bg-muted)] mx-auto">
          <svg className="h-8 w-8 text-[var(--text-tertiary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
            <path d="M9 9h.01" /><path d="M15 9h.01" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          {error ?? "Comercio no encontrado"}
        </p>
        <Link to="/" className="mt-4 inline-block">
          <Button variant="secondary">Volver al inicio</Button>
        </Link>
      </div>
    )
  }

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
              href={`https://www.google.com/maps/search/${encodeURIComponent(store.address)}`}
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
          {store.averageRating > 0 && (
            <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">
              ⭐ {store.averageRating} ({store.reviewCount} reseña{store.reviewCount !== 1 ? "s" : ""})
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
        <BookingWidget slug={store.slug} />
      </section>
    </div>
  )
}
