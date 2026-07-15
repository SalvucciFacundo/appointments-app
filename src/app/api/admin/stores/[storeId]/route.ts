import { auth } from "@/auth"
import prisma from "@/lib/prisma"

interface RouteParams {
  params: Promise<{ storeId: string }>
}

export async function PUT(_request: Request, { params }: RouteParams) {
  const { storeId } = await params

  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const store = await prisma.store.findUnique({ where: { id: storeId } })
    if (!store) {
      return Response.json({ error: "Store not found" }, { status: 404 })
    }

    const updated = await prisma.store.update({
      where: { id: storeId },
      data: { suspended: !store.suspended },
    })

    return Response.json({
      id: updated.id,
      name: updated.name,
      suspended: updated.suspended,
    })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
