"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useCallback } from "react"

interface SearchBarProps {
  specialties: string[]
  selectedSpecialty: string
}

export default function SearchBar({
  specialties,
  selectedSpecialty,
}: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("q") ?? "")

  const updateFilter = useCallback(
    (specialty: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (specialty) {
        params.set("specialty", specialty)
      } else {
        params.delete("specialty")
      }
      if (search) {
        params.set("q", search)
      }
      router.push(`/?${params.toString()}`)
    },
    [router, search, searchParams],
  )

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const params = new URLSearchParams(searchParams.toString())
      if (search) {
        params.set("q", search)
      } else {
        params.delete("q")
      }
      if (selectedSpecialty) {
        params.set("specialty", selectedSpecialty)
      }
      router.push(`/?${params.toString()}`)
    },
    [router, search, searchParams, selectedSpecialty],
  )

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar comercios..."
          className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          Buscar
        </button>
      </form>
      {specialties.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !selectedSpecialty
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Todas
          </button>
          {specialties.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateFilter(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedSpecialty === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
