import { auth } from "@/auth"
import prisma from "@/lib/prisma"

// ---- Session Helpers ----

export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.id) {
    throw Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  return session
}

/**
 * Verifies that the authenticated user owns the given store.
 * Throws a 403 Response if the store doesn't exist or belongs to another user.
 */
export async function assertOwnerAccess(storeId: string) {
  const session = await requireAuth()
  const store = await prisma.store.findUnique({ where: { id: storeId } })

  if (!store) {
    throw Response.json({ error: "Store not found" }, { status: 404 })
  }

  if (store.ownerId !== session.user.id) {
    throw Response.json({ error: "Forbidden" }, { status: 403 })
  }

  return { session, store }
}

// ---- Validation Helpers ----

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export function validateTimeFormat(value: string, field: string): string | null {
  if (!TIME_REGEX.test(value)) {
    return `${field} must be in HH:MM format`
  }
  return null
}

export function validateDayOfWeek(value: number): string | null {
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    return "dayOfWeek must be an integer between 0 and 6"
  }
  return null
}

export function validateFutureDate(dateStr: string): string | null {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return "Invalid date format. Use YYYY-MM-DD"
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date < today) {
    return "Date must be in the future"
  }
  return null
}
