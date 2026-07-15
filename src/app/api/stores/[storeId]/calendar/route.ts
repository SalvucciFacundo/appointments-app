import { assertOwnerAccess } from "@/lib/api-helpers"
import prisma from "@/lib/prisma"
import { getAuthUrl } from "@/lib/calendar/oauth"

interface RouteParams {
  params: Promise<{ storeId: string }>
}

/**
 * GET /api/stores/[storeId]/calendar
 * Returns CalendarSync status for the store.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { storeId } = await params

  try {
    await assertOwnerAccess(storeId)

    const sync = await prisma.calendarSync.findUnique({
      where: { storeId },
    })

    return Response.json({
      enabled: sync !== null,
      calendarId: sync?.calendarId ?? null,
      lastSyncError: sync?.lastSyncError ?? null,
      lastSyncAt: sync?.lastSyncAt?.toISOString() ?? null,
    })
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/stores/[storeId]/calendar
 * Generates a Google OAuth URL and returns it so the frontend can redirect the user.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const { storeId } = await params

  try {
    await assertOwnerAccess(storeId)

    const url = getAuthUrl(storeId)

    return Response.json({ url })
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE /api/stores/[storeId]/calendar
 * Disconnects Google Calendar by removing the CalendarSync record.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { storeId } = await params

  try {
    await assertOwnerAccess(storeId)

    await prisma.calendarSync.deleteMany({
      where: { storeId },
    })

    return Response.json({ enabled: false })
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
