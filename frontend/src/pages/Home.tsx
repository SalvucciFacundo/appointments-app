import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { listPublicStores } from "@/api/stores"
import type { StoreCard as StoreCardData } from "@/api/types"
import StoreCard from "@/components/ui/StoreCard"
import SearchBar from "@/components/ui/SearchBar"
import Pagination from "@/components/ui/Pagination"

const PAGE_SIZE = 12

function StoreGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-lg)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)]">
          <div className="mb-3 h-10 w-10 skeleton" />
          <div className="h-5 w-3/4 skeleton mb-2" />
          <div className="h-4 w-1/2 skeleton mb-2" />
          <div className="h-4 w-full skeleton mb-3" />
          <div className="h-4 w-1/3 skeleton" />
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const specialty = searchParams.get("specialty") ?? ""
  const query = searchParams.get("q") ?? ""
  const page = parseInt(searchParams.get("page") ?? "1", 10) || 1

  const [stores, setStores] = useState<StoreCardData[]>([])
  const [specialties, setSpecialties] = useState<string[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    listPublicStores({
      q: query || undefined,
      specialty: specialty || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((res) => {
        if (!active) return
        setStores(res.data)
        setTotal(res.total)
        setTotalPages(res.totalPages)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Error al cargar los comercios")
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [query, specialty, page])

  // Collect the distinct specialties available on the platform so the filter
  // chips always show the full catalog, not just the current page.
  useEffect(() => {
    let active = true
    listPublicStores({ limit: 100 })
      .then((res) => {
        if (!active) return
        const unique = [...new Set(res.data.map((s) => s.specialty))].sort()
        setSpecialties(unique)
      })
      .catch(() => {
        if (active) setSpecialties([])
      })
    return () => {
      active = false
    }
  }, [])

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(p))
    setSearchParams(params)
  }

  const isFirstVisit = !specialty && !query

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fadeIn">
      {/* Landing Hero Section */}
      {isFirstVisit && (
        <div className="relative mb-10 overflow-hidden rounded-[var(--radius-2xl)] bg-gradient-to-br from-[var(--bg-surface)] via-[var(--bg-surface)] to-[var(--accent-light)] border border-[var(--border-subtle)] p-8 sm:p-10">
          {/* Decorative gradient blob */}
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-gradient-to-br from-[var(--accent)]/10 to-emerald-500/5 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-gradient-to-tr from-cyan-500/5 to-[var(--accent)]/10 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[var(--accent)] to-emerald-600 px-3 py-1 text-xs font-medium text-white shadow-sm">
                <svg className="h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                </svg>
                Gestión de Turnos
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
              Reservá tu turno en segundos
            </h1>
            <p className="mt-3 max-w-lg text-[var(--text-secondary)] leading-relaxed">
              Encontrá el comercio que necesitás y reservá al instante. Sin llamadas, sin esperas.
            </p>

            {/* Stats */}
            <div className="mt-6 flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-light)]">
                  <svg className="h-4 w-4 text-[var(--accent)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">+1,000</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Usuarios activos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-emerald-500/10">
                  <svg className="h-4 w-4 text-emerald-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                    <line x1="16" x2="16" y1="2" y2="6" />
                    <line x1="8" x2="8" y1="2" y2="6" />
                    <line x1="3" x2="21" y1="10" y2="10" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">+500</p>
                  <p className="text-xs text-[var(--text-tertiary)]">Turnos por día</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple header when searching */}
      {!isFirstVisit && (
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {query ? `Resultados para "${query}"` : specialty ? specialty : "Comercios"}
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {specialty && !query ? `Mostrando comercios de ${specialty}` : ""}
          </p>
        </header>
      )}

      <div className="mb-8">
        <SearchBar specialties={specialties} selectedSpecialty={specialty} />
      </div>

      {error ? (
        <div className="rounded-[var(--radius-md)] bg-[var(--danger-light)] px-4 py-3">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      ) : loading ? (
        <StoreGridSkeleton />
      ) : stores.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-2xl)] bg-[var(--bg-muted)]">
            <svg className="h-8 w-8 text-[var(--text-tertiary)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">No se encontraron comercios</p>
          {specialty && <p className="mt-1 text-xs text-[var(--text-tertiary)]">para &quot;{specialty}&quot;</p>}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <StoreCard key={store.slug} store={store} />
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={goToPage} />
          {totalPages > 1 && (
            <p className="mt-2 text-center text-xs text-[var(--text-tertiary)]">
              {total} comercios — Página {page} de {totalPages}
            </p>
          )}
        </>
      )}
    </div>
  )
}
