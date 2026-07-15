import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const stores = await prisma.store.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { name: "asc" },
    })

    const result = stores.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      specialty: s.specialty,
      suspended: s.suspended,
      owner: s.owner,
    }))

    return Response.json(result)
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
