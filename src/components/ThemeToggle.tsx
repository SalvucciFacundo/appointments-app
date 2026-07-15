"use client"

import { useTheme } from "./ThemeProvider"

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light"
  const icons: Record<string, string> = { light: "☀️", dark: "🌙", system: "🖥" }

  return (
    <button
      onClick={() => setTheme(next)}
      title={`Theme: ${theme}. Click for ${next}.`}
      className="fixed bottom-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white text-sm shadow-lg transition hover:scale-110 dark:border-gray-600 dark:bg-gray-800"
    >
      {icons[theme]}
    </button>
  )
}
