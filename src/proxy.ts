import { auth } from "@/auth"

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl
  const role = req.auth?.user?.role as string | undefined

  // /admin/* → ADMIN only
  if (pathname.startsWith("/admin")) {
    if (!role) {
      const signInUrl = new URL("/api/auth/signin", req.url)
      signInUrl.searchParams.set("callbackUrl", pathname)
      return Response.redirect(signInUrl)
    }
    if (role !== "ADMIN") {
      return Response.redirect(new URL("/", req.url))
    }
  }

  // /dashboard/* → OWNER only
  if (pathname.startsWith("/dashboard")) {
    if (!role) {
      const signInUrl = new URL("/api/auth/signin", req.url)
      signInUrl.searchParams.set("callbackUrl", pathname)
      return Response.redirect(signInUrl)
    }
    if (role !== "OWNER") {
      return Response.redirect(new URL("/onboarding", req.url))
    }
  }

  // /perfil/* → any authenticated user
  if (pathname.startsWith("/perfil") && !role) {
    const signInUrl = new URL("/api/auth/signin", req.url)
    signInUrl.searchParams.set("callbackUrl", pathname)
    return Response.redirect(signInUrl)
  }
})

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/perfil/:path*"],
}
