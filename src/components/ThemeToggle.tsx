"use client"

import { useTheme } from "./ThemeProvider"

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light"
  const icons: Record<string, string> = {
    light: "☀️",
    dark: "🌙",
    system: "🖥",
  }
  const labels: Record<string, string> = { light: "Light", dark: "Dark", system: "System" }

  return (
    <button
      onClick={() => setTheme(next)}
      title={`Theme: ${theme}. Click for ${next}.`}
      className="fixed bottom-6 left-6 z-50 flex h-11 w-11 items-center justify-center
        rounded-[var(--radius-lg)] bg-[var(--bg-surface)] text-sm
        shadow-[var(--shadow-lg)]
        transition-all duration-200 hover:scale-110 hover:shadow-[var(--shadow-xl)]
        border border-[var(--border-subtle)]
        text-[var(--text-secondary)] hover:text-[var(--text-primary)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <span className="sr-only">Current theme: {labels[theme]}. Switch to {labels[next]}.</span>
      {icons[theme]}
    </button>
  )
}
