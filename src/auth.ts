import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
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
