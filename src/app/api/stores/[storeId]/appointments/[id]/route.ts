import prisma from "@/lib/prisma"
import { assertOwnerAccess } from "@/lib/api-helpers"
import type { AppointmentStatus } from "@prisma/client"
import { sendCancellationEmail } from "@/lib/email"
import { buildManagementUrl } from "@/lib/management-link"

interface RouteParams {
  params: Promise<{ storeId: string; id: string }>
}

// State machine: "current status" → set of allowed target statuses
const VALID_TRANSITIONS: Record<string, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  // CANCELLED and COMPLETED are terminal — no transitions
}

// Maps action strings to target statuses
const ACTION_TO_STATUS: Record<string, AppointmentStatus> = {
  CONFIRM: "CONFIRMED",
  REJECT: "CANCELLED",
  COMPLETE: "COMPLETED",
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { storeId, id } = await params

  try {
    await assertOwnerAccess(storeId)

    const body = await request.json().catch(() => ({}))
    const { action } = body as { action?: string }

    // Validate action
    if (!action || typeof action !== "string") {
      return Response.json(
        {
          error: "Validation failed",
          errors: [{ field: "action", message: "action is required (CONFIRM, REJECT, or COMPLETE)" }],
        },
        { status: 400 },
      )
    }

    const targetStatus = ACTION_TO_STATUS[action.toUpperCase()]
    if (!targetStatus) {
      return Response.json(
        {
          error: "Validation failed",
          errors: [{ field: "action", message: "action must be CONFIRM, REJECT, or COMPLETE" }],
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

    // Enforce state machine
    const allowed = VALID_TRANSITIONS[appointment.status]
    if (!allowed || !allowed.includes(targetStatus)) {
      return Response.json(
        {
          error: "Invalid status transition",
          errors: [
            {
              field: "action",
              message: `Cannot transition from ${appointment.status} to ${targetStatus}`,
            },
          ],
        },
        { status: 400 },
      )
    }

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
