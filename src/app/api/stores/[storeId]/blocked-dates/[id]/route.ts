import prisma from "@/lib/prisma"
import { assertOwnerAccess } from "@/lib/api-helpers"

interface RouteParams {
  params: Promise<{ storeId: string; id: string }>
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { storeId, id } = await params

  try {
    await assertOwnerAccess(storeId)

    // Verify the blocked date exists and belongs to this store
    const blockedDate = await prisma.blockedDate.findUnique({
      where: { id },
    })

    if (!blockedDate || blockedDate.storeId !== storeId) {
      return Response.json({ error: "Blocked date not found" }, { status: 404 })
    }

    await prisma.blockedDate.delete({ where: { id } })

    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
