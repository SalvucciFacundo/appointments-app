"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { useSession } from "next-auth/react"

type Theme = "light" | "dark" | "system"
type AppliedTheme = "light" | "dark"

interface ThemeContextValue {
  theme: Theme
  appliedTheme: AppliedTheme
  setTheme: (theme: Theme) => Promise<void>
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider")
  return ctx
}

function getSystemTheme(): AppliedTheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function apply(applied: AppliedTheme) {
  document.documentElement.classList.toggle("dark", applied === "dark")
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [theme, setThemeState] = useState<Theme>("system")
  const [appliedTheme, setAppliedTheme] = useState<AppliedTheme>("light")

  // Load preference: localStorage first, then backend if available
  useEffect(() => {
    async function load() {
      const local = localStorage.getItem("theme") as Theme | null
      if (local && ["light", "dark", "system"].includes(local)) {
        setThemeState(local)
        return
      }
      // Try backend
      if (session?.user?.id) {
        try {
          const res = await fetch("/api/user/theme")
          const data = await res.json()
          if (data.theme) setThemeState(data.theme)
        } catch { /* ignore */ }
      }
    }
    load()
  }, [session])

  // Listen for system theme changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      if (theme === "system") {
        const a = getSystemTheme()
        setAppliedTheme(a)
        apply(a)
      }
    }
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [theme])

  // Apply theme whenever it changes
  useEffect(() => {
    const a = theme === "system" ? getSystemTheme() : theme
    setAppliedTheme(a)
    apply(a)
  }, [theme])

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem("theme", newTheme)
    if (session?.user?.id) {
      try {
        await fetch("/api/user/theme", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: newTheme }),
        })
      } catch { /* ignore */ }
    }
  }, [session])

  return (
    <ThemeContext.Provider value={{ theme, appliedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
