import { Suspense } from "react"
import prisma from "@/lib/prisma"
import StoreCard from "@/components/ui/StoreCard"
import SearchBar from "@/components/ui/SearchBar"

interface HomePageProps {
  searchParams: Promise<{ specialty?: string; q?: string }>
}

async function StoreList({
  specialty,
  query,
}: {
  specialty?: string
  query?: string
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

  const stores = await prisma.store.findMany({
    where,
    include: { reviews: { select: { rating: true } } },
  })

  const allStores = await prisma.store.findMany({
    select: { specialty: true },
    distinct: ["specialty"],
  })
  const specialties = allStores.map((s) => s.specialty).sort()

  const storeList = stores.map((store) => {
    const ratings = store.reviews.map((r) => r.rating)
    const averageRating =
      ratings.length > 0
        ? Math.round(
            (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10,
          ) / 10
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
        <Suspense
          fallback={
            <div className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          }
        >
          <SearchBar
            specialties={specialties}
            selectedSpecialty={specialty ?? ""}
          />
        </Suspense>
      </div>

      {storeList.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400">
          No se encontraron comercios{specialty ? ` para "${specialty}"` : ""}.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {storeList.map((store) => (
            <StoreCard key={store.slug} store={store} />
          ))}
        </div>
      )}
    </>
  )
}

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams
  const specialty = params.specialty
  const query = params.q

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Reservá tu turno
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Encontrá el comercio que necesitás y reservá en segundos.
        </p>
      </header>

      <StoreList specialty={specialty} query={query} />
    </div>
  )
}
