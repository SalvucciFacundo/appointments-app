import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [totalStores, totalAppointments, totalUsers, totalReviews] =
      await Promise.all([
        prisma.store.count(),
        prisma.appointment.count(),
        prisma.user.count(),
        prisma.review.count(),
      ])

    return Response.json({
      totalStores,
      totalAppointments,
      totalUsers,
      totalReviews,
    })
  } catch {
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
