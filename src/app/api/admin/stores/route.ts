import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { parsePagination, paginatedResponse } from "@/lib/pagination"

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const { skip, take, page } = parsePagination(url)

    const [stores, total] = await Promise.all([
      prisma.store.findMany({
        skip,
        take,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.store.count(),
    ])

    const data = stores.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      specialty: s.specialty,
      suspended: s.suspended,
      owner: s.owner,
    }))

    return Response.json(paginatedResponse(data, total, page, take))
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
