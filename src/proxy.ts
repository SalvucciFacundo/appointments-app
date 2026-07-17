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

  // /dashboard/* → redirect ADMIN to /admin, USER to /perfil, OWNER passes
  if (pathname.startsWith("/dashboard")) {
    if (!role) {
      const signInUrl = new URL("/login", req.url)
      signInUrl.searchParams.set("callbackUrl", pathname)
      return Response.redirect(signInUrl)
    }
    if (role === "ADMIN") {
      return Response.redirect(new URL("/admin", req.url))
    }
    if (role === "USER") {
      return Response.redirect(new URL("/perfil", req.url))
    }
    // OWNER → continue to dashboard
  }

  // /perfil/* → any authenticated user
  if (pathname.startsWith("/perfil") && !role) {
    const signInUrl = new URL("/login", req.url)
    signInUrl.searchParams.set("callbackUrl", pathname)
    return Response.redirect(signInUrl)
  }

  // /onboarding → redirect if already OWNER
  if (pathname.startsWith("/onboarding") && role === "OWNER") {
    return Response.redirect(new URL("/dashboard", req.url))
  }
  if (pathname.startsWith("/onboarding") && role === "ADMIN") {
    return Response.redirect(new URL("/admin", req.url))
  }
})

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/perfil/:path*", "/onboarding"],
}
