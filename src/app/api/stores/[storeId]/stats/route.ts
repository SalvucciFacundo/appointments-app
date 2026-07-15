import prisma from "@/lib/prisma"
import { assertOwnerAccess } from "@/lib/api-helpers"

interface RouteParams {
  params: Promise<{ storeId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { storeId } = await params

  try {
    await assertOwnerAccess(storeId)

    // ---- 1. Total by status ----
    const statusGroups = await prisma.appointment.groupBy({
      by: ["status"],
      where: { storeId },
      _count: { status: true },
    })

    const total: Record<string, number> = {}
    for (const g of statusGroups) {
      total[g.status] = g._count.status
    }

    // ---- 2. Attendance rate ----
    const completed = total["COMPLETED"] ?? 0
    const cancelled = total["CANCELLED"] ?? 0
    const denominator = completed + cancelled
    const attendanceRate = denominator > 0 ? Math.round((completed / denominator) * 100) : 0

    // ---- 3. Peak hour (EXTRACT HOUR via raw SQL) ----
    interface PeakRow {
      hour: number
      count: bigint
    }

    const peakRows = await prisma.$queryRaw<PeakRow[]>`
      SELECT EXTRACT(HOUR FROM "dateTime")::int AS hour, COUNT(*)::bigint AS count
      FROM "Appointment"
      WHERE "storeId" = ${storeId}
      GROUP BY EXTRACT(HOUR FROM "dateTime")
      ORDER BY count DESC
      LIMIT 1
    `

    const peakHour = peakRows.length > 0 ? Number(peakRows[0].hour) : null
    const peakHourCount = peakRows.length > 0 ? Number(peakRows[0].count) : 0

    // ---- 4. Repeat customers ----
    const repeatResult = await prisma.appointment.groupBy({
      by: ["clientEmail"],
      where: { storeId },
      _count: { clientEmail: true },
      having: { clientEmail: { _count: { gt: 1 } } },
    })

    // ---- 5. Today count ----
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

    const todayCount = await prisma.appointment.count({
      where: {
        storeId,
        dateTime: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
    })

    return Response.json({
      total,
      attendanceRate,
      peakHour,
      peakHourCount,
      repeatCustomers: repeatResult.length,
      todayCount,
    })
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
