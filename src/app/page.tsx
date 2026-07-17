import { Suspense } from "react"
import prisma from "@/lib/prisma"
import StoreCard from "@/components/ui/StoreCard"
import SearchBar from "@/components/ui/SearchBar"

const PAGE_SIZE = 12

interface HomePageProps {
  searchParams: Promise<{ specialty?: string; q?: string; page?: string }>
}

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

async function StoreList({
  specialty,
  query,
  page = 1,
}: {
  specialty?: string
  query?: string
  page?: number
}) {
  const where: Record<string, unknown> = {}

  if (specialty) {
    where.specialty = { contains: specialty, mode: "insensitive" }
  }

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { specialty: { contains: query, mode: "insensitive" } },
      { address: { contains: query, mode: "insensitive" } },
    ]
  }

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { reviews: { select: { rating: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.store.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const allStores = await prisma.store.findMany({
    select: { specialty: true },
    distinct: ["specialty"],
  })
  const specialties = allStores.map((s) => s.specialty).sort()

  const storeList = stores.map((store) => {
    const ratings = store.reviews.map((r) => r.rating)
    const averageRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : 0

    return {
      name: store.name,
      slug: store.slug,
      specialty: store.specialty,
      address: store.address,
      averageRating,
      reviewCount: ratings.length,
    }
  })

  return (
    <>
      <div className="mb-8">
        <Suspense fallback={<div className="h-10 skeleton rounded-[var(--radius-lg)]" />}>
          <SearchBar specialties={specialties} selectedSpecialty={specialty ?? ""} />
        </Suspense>
      </div>

      {storeList.length === 0 ? (
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
            {storeList.map((store) => (
              <StoreCard key={store.slug} store={store} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              {page > 1 && (
                <a href={`/?specialty=${specialty ?? ""}&page=${page - 1}`}
                  className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                  Anterior
                </a>
              )}
              <span className="text-xs text-[var(--text-tertiary)]">Página {page} de {totalPages}</span>
              {page < totalPages && (
                <a href={`/?specialty=${specialty ?? ""}&page=${page + 1}`}
                  className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  Siguiente
                  <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams
  const specialty = params.specialty
  const query = params.q
  const page = parseInt(params.page ?? "1", 10) || 1

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

      {/* Store Listing */}
      <Suspense fallback={<StoreGridSkeleton />}>
        <StoreList specialty={specialty} query={query} page={page} />
      </Suspense>
    </div>
  )
}
