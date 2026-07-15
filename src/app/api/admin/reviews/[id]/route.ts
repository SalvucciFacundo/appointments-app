import { auth } from "@/auth"
import prisma from "@/lib/prisma"

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const review = await prisma.review.findUnique({ where: { id } })
    if (!review) {
      return Response.json({ error: "Review not found" }, { status: 404 })
    }

    await prisma.review.delete({ where: { id } })

    return Response.json({ deleted: true })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
