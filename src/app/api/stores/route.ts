import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { generateUniqueSlug } from "@/lib/slug"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { name, description, address, phone, specialty } = body

  // Validate required fields
  const errors: { field: string; message: string }[] = []
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    errors.push({ field: "name", message: "Name is required" })
  }
  if (!address || typeof address !== "string" || address.trim().length === 0) {
    errors.push({ field: "address", message: "Address is required" })
  }
  if (!specialty || typeof specialty !== "string" || specialty.trim().length === 0) {
    errors.push({ field: "specialty", message: "Specialty is required" })
  }

  if (errors.length > 0) {
    return Response.json({ error: "Validation failed", errors }, { status: 400 })
  }

  const slug = await generateUniqueSlug(name as string)

  // Create store
  const store = await prisma.store.create({
    data: {
      name: (name as string).trim(),
      slug,
      description: typeof description === "string" ? description.trim() : null,
      address: (address as string).trim(),
      phone: typeof phone === "string" ? phone.trim() : null,
      specialty: (specialty as string).trim(),
      ownerId: session.user.id,
    },
  })

  // Ensure user is OWNER (idempotent — safe to call multiple times)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { role: "OWNER" },
  })

  return Response.json(store, { status: 201 })
}

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const storeId = searchParams.get("storeId")

  // If a specific storeId is requested, return just that one
  if (storeId) {
    const store = await prisma.store.findFirst({
      where: { id: storeId, ownerId: session.user.id },
      include: { businessHours: true, blockedDates: true },
    })
    if (!store) {
      return Response.json({ error: "Store not found" }, { status: 404 })
    }
    return Response.json(store)
  }

  // Otherwise return all stores for the user
  const stores = await prisma.store.findMany({
    where: { ownerId: session.user.id },
    include: { businessHours: true, blockedDates: true },
  })

  return Response.json(stores)
}
