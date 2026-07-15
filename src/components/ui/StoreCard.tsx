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
      className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
    >
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {store.name}
      </h3>
      <p className="mt-1 text-sm font-medium text-blue-600 dark:text-blue-400">
        {store.specialty}
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {store.address}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <StarRating rating={store.averageRating} />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {store.averageRating > 0
            ? `${store.averageRating} (${store.reviewCount ?? 0})`
            : "Sin reseñas"}
        </span>
      </div>
    </Link>
  )
}
