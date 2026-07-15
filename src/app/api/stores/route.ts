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

  // Create store and update user role in a transaction
  const [store] = await prisma.$transaction([
    prisma.store.create({
      data: {
        name: (name as string).trim(),
        slug,
        description: typeof description === "string" ? description.trim() : null,
        address: (address as string).trim(),
        phone: typeof phone === "string" ? phone.trim() : null,
        specialty: (specialty as string).trim(),
        ownerId: session.user.id,
      },
    }),
    prisma.user.update({
      where: { id: session.user.id },
      data: { role: "OWNER" },
    }),
  ])

  return Response.json(store, { status: 201 })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const store = await prisma.store.findFirst({
    where: { ownerId: session.user.id },
    include: {
      businessHours: true,
      blockedDates: true,
    },
  })

  if (!store) {
    return Response.json({ error: "No store found" }, { status: 404 })
  }

  return Response.json(store)
}
