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

// Re-export pure validators from separate file (testable without server imports)
export { validateTimeFormat, validateDayOfWeek, validateFutureDate } from "./validators"
