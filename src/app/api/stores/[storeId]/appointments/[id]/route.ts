import prisma from "@/lib/prisma"
import { assertOwnerAccess } from "@/lib/api-helpers"
import { sendCancellationEmail } from "@/lib/email"
import { buildManagementUrl } from "@/lib/management-link"
import { deleteEvent } from "@/lib/calendar/events"
import { validateTransition } from "@/lib/state-machine"

interface RouteParams {
  params: Promise<{ storeId: string; id: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { storeId, id } = await params

  try {
    await assertOwnerAccess(storeId)

    const body = await request.json().catch(() => ({}))
    const { action } = body as { action?: string }

    if (!action || typeof action !== "string") {
      return Response.json(
        {
          error: "Validation failed",
          errors: [{ field: "action", message: "action is required (CONFIRM, REJECT, or COMPLETE)" }],
        },
        { status: 400 },
      )
    }

    // Fetch the appointment
    const appointment = await prisma.appointment.findUnique({
      where: { id },
    })

    if (!appointment || appointment.storeId !== storeId) {
      return Response.json({ error: "Appointment not found" }, { status: 404 })
    }

    // Validate transition using pure function (testable)
    const transition = validateTransition(appointment.status, action)
    if (!transition.valid) {
      return Response.json(
        {
          error: "Invalid status transition",
          errors: [{ field: "action", message: transition.error }],
        },
        { status: 400 },
      )
    }

    const targetStatus = transition.targetStatus

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: targetStatus },
      include: { store: { select: { name: true } } },
    })

    // Fire-and-forget cancellation email
    if (targetStatus === "CANCELLED") {
      const cancelUrl = updated.managementToken
        ? buildManagementUrl(updated.managementToken)
        : undefined

      sendCancellationEmail({
        to: updated.clientEmail,
        clientName: updated.clientName,
        storeName: updated.store.name,
        dateTime: updated.dateTime,
        service: updated.service,
        managementUrl: cancelUrl,
      }).catch((err) => {
        console.error("[appointments] Failed to send cancellation email:", err)
      })

      // Fire-and-forget Google Calendar event deletion
      const googleEventId = appointment.googleEventId
      if (googleEventId) {
        prisma.calendarSync
          .findUnique({ where: { storeId: storeId } })
          .then((sync) => {
            if (sync) {
              return deleteEvent(sync, googleEventId)
            }
          })
          .catch((err) => {
            console.error(
              "[appointments] Failed to delete calendar event:",
              err,
            )
          })
      }
    }

    return Response.json({
      id: updated.id,
      storeId: updated.storeId,
      clientName: updated.clientName,
      clientPhone: updated.clientPhone,
      clientEmail: updated.clientEmail,
      dateTime: updated.dateTime.toISOString(),
      service: updated.service,
      status: updated.status,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (e) {
    if (e instanceof Response) return e
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
