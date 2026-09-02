import { Link } from "react-router-dom"
import StarRating from "@/components/ui/StarRating"
import type { StoreCard as StoreCardData } from "@/api/types"

interface StoreCardProps {
  store: StoreCardData
}

export default function StoreCard({ store }: StoreCardProps) {
  return (
    <Link
      to={`/${store.slug}`}
      className="group relative flex flex-col justify-between rounded-[var(--radius-xl)] bg-[var(--bg-surface)] p-5
        border border-[var(--border-default)] shadow-[var(--shadow-sm)]
        transition-all duration-200 ease-out
        hover:border-[var(--accent-mid)]/40 hover:shadow-lg hover:shadow-cyan-500/5 hover:-translate-y-1"
    >
      <div>
        <div className="mb-4 flex items-center justify-between">
          {/* Icon container */}
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--accent-light)] border border-[var(--accent-border)] group-hover:scale-105 transition-transform">
            <span className="text-xl">
              {store.specialty === "Barbería" || store.specialty === "Peluquería" ? "💈" :
               store.specialty === "Masajes" ? "💆" :
               store.specialty === "Manicura" ? "💅" : "🏪"}
            </span>
          </div>

          <span className="inline-flex items-center rounded-full bg-[var(--bg-muted)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)] border border-[var(--border-subtle)] group-hover:border-[var(--accent-border)] group-hover:text-[var(--accent)] transition-colors">
            {store.specialty}
          </span>
        </div>

        <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors line-clamp-1">
          {store.name}
        </h3>

        <p className="mt-1 text-xs text-[var(--text-tertiary)] line-clamp-1 flex items-center gap-1">
          <svg className="h-3.5 w-3.5 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {store.address}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StarRating rating={store.averageRating} />
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {store.averageRating > 0
              ? `${store.averageRating}`
              : "Nuevo"}
          </span>
        </div>
        {store.reviewCount ? (
          <span className="text-xs text-[var(--text-quaternary)]">
            ({store.reviewCount} {store.reviewCount === 1 ? "opinión" : "opiniones"})
          </span>
        ) : null}
      </div>
    </Link>
  )
}
