import Link from "next/link"
import StarRating from "@/components/ui/StarRating"

interface StoreCardProps {
  store: {
    name: string
    slug: string
    specialty: string
    address: string
    averageRating: number
    reviewCount?: number
  }
}

export default function StoreCard({ store }: StoreCardProps) {
  return (
    <Link
      href={`/${store.slug}`}
      className="group block rounded-[var(--radius-lg)] bg-[var(--bg-surface)] p-5
        shadow-[var(--shadow-sm)]
        transition-all duration-200
        hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
    >
      {/* Icon placeholder */}
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-light)]">
        <span className="text-lg text-[var(--accent)]">
          {store.specialty === "Barbería" || store.specialty === "Peluquería" ? "💈" :
           store.specialty === "Masajes" ? "💆" :
           store.specialty === "Manicura" ? "💅" : "🏪"}
        </span>
      </div>

      <h3 className="text-base font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
        {store.name}
      </h3>

      <p className="mt-1 text-sm font-medium text-[var(--accent)]">
        {store.specialty}
      </p>

      <p className="mt-1 text-sm text-[var(--text-tertiary)] line-clamp-1">
        {store.address}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <StarRating rating={store.averageRating} />
        <span className="text-xs text-[var(--text-tertiary)]">
          {store.averageRating > 0
            ? `${store.averageRating} (${store.reviewCount ?? 0})`
            : "Sin reseñas"}
        </span>
      </div>
    </Link>
  )
}
