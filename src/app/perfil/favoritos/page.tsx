"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import StarRating from "@/components/ui/StarRating"

interface FavoriteStore {
  id: string
  name: string
  slug: string
  specialty: string
  address: string
  averageRating: number
  reviewCount: number
}

export default function FavoritosPage() {
  const { data: session, status } = useSession()
  const [favorites, setFavorites] = useState<FavoriteStore[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFavorites = useCallback(() => {
    fetch("/api/user/favorites")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load favorites")
        return res.json()
      })
      .then((data) => setFavorites(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (status === "loading") return
    if (status === "unauthenticated") return
    fetchFavorites()
  }, [status, fetchFavorites])

  const toggleFavorite = async (storeId: string) => {
    try {
      const res = await fetch("/api/user/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      })

      if (!res.ok) throw new Error("Failed to toggle favorite")

      const updated = await res.json()
      setFavorites(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar favoritos")
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-gray-500 dark:text-gray-400">Cargando...</p>
      </div>
    )
  }

  if (!session) {
    return null // proxy.ts redirects
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Favoritos
      </h1>

      {error && (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {favorites.length === 0 && !error && (
        <p className="mt-8 text-center text-gray-500 dark:text-gray-400">
          No tenés comercios favoritos todavía.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {favorites.map((store) => (
          <div
            key={store.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="min-w-0 flex-1">
              <Link
                href={`/${store.slug}`}
                className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                {store.name}
              </Link>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {store.specialty} · {store.address}
              </p>
              {store.averageRating > 0 && (
                <div className="mt-1 flex items-center gap-1">
                  <StarRating rating={store.averageRating} />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {store.averageRating}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggleFavorite(store.id)}
              className="ml-4 shrink-0 rounded-md px-3 py-1 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
