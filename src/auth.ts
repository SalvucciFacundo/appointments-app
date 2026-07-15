import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import prisma from "@/lib/prisma"
import { type DefaultSession } from "next-auth"

declare module "next-auth" {
  interface User {
    role?: "USER" | "OWNER" | "ADMIN"
  }

  interface Session {
    user: {
      role: "USER" | "OWNER" | "ADMIN"
    } & DefaultSession["user"]
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role: "USER" | "OWNER" | "ADMIN"
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role?: "USER" | "OWNER" | "ADMIN"
  }
}

// Demo credentials for testing — same password for all seeded users
const DEMO_PASSWORD = "demo123"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: "Demo",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined
        const password = credentials?.password as string | undefined

        if (!email || !password) return null

        // Demo: any seeded user with password "demo123" can log in
        if (password !== DEMO_PASSWORD) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        }
      },
    }),
    Google,
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = user.role ?? "USER"
      return token
    },
    session({ session, token }) {
      if (session.user && token.role) {
        session.user.role = token.role as "USER" | "OWNER" | "ADMIN"
      }
      return session
    },
  },

})
