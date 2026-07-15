import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ theme: "system" })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { themePreference: true },
  })

  return Response.json({ theme: user?.themePreference ?? "system" })
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { theme } = body as { theme?: string }

  if (!theme || !["light", "dark", "system"].includes(theme)) {
    return Response.json({ error: "Theme must be 'light', 'dark', or 'system'" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { themePreference: theme },
  })

  return Response.json({ theme })
}
