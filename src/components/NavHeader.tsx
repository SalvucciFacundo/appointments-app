"use client"

import Link from "next/link"
import { useSession, signIn, signOut } from "next-auth/react"
import { useState } from "react"
import { useTheme } from "./ThemeProvider"

export default function NavHeader() {
  const { data: session } = useSession()
  const { theme, setTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light")
  }

  const themeIcon = theme === "light" ? "☀️" : theme === "dark" ? "🌙" : "🖥"

  const user = session?.user
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?"

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border-subtle)] glass">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] accent-gradient shadow-sm">
            <svg className="h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">Appointments</span>
        </Link>

        {/* Desktop */}
        <nav className="hidden items-center gap-0.5 sm:flex">
          <Link href="/"
            className="rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150">
            Inicio
          </Link>

          {/* User area */}
          {user ? (
            <div className="relative flex items-center gap-2 ml-2">
              {/* Theme toggle */}
              <button onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-sm text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150"
                title={`Tema: ${theme}`}>
                {themeIcon}
              </button>

              {/* User button */}
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1 hover:bg-[var(--bg-hover)] transition-all duration-150"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-emerald-600 text-[10px] font-bold text-white shadow-sm">
                  {initials}
                </div>
                <span className="text-sm font-medium text-[var(--text-primary)] max-w-[120px] truncate">
                  {user.name ?? user.email}
                </span>
                <svg className={`h-3.5 w-3.5 text-[var(--text-tertiary)] transition-transform duration-150 ${userMenuOpen ? "rotate-180" : ""}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-[var(--radius-lg)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-[var(--shadow-lg)] py-1.5 animate-scaleIn origin-top-right">
                    <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{user.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">{user.email}</p>
                      <span className="mt-1 inline-flex items-center rounded-full bg-[var(--accent-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)] uppercase">
                        {user.role ?? "USER"}
                      </span>
                    </div>
                    {user.role === "ADMIN" && (
                      <Link href="/admin" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors">
                        Panel Admin
                      </Link>
                    )}
                    {user.role === "OWNER" && (
                      <Link href="/dashboard" onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors">
                        Dashboard
                      </Link>
                    )}
                    <Link href="/perfil" onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors">
                      Mis Turnos
                    </Link>
                    <div className="border-t border-[var(--border-subtle)] mt-1 pt-1">
                      <button onClick={() => { signOut(); setUserMenuOpen(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-light)] transition-colors">
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 ml-2">
              <button onClick={toggleTheme}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-sm text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-all duration-150">
                {themeIcon}
              </button>
              <Link href="/login"
                className="rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent)] to-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-500/20 hover:shadow-md hover:shadow-emerald-500/30 transition-all duration-150">
                Iniciar sesión
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile */}
        <div className="flex items-center gap-1 sm:hidden">
          {user && (
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-emerald-600 text-[10px] font-bold text-white">
              {initials}
            </button>
          )}
          <button onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-sm text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]">
            {themeIcon}
          </button>
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {menuOpen ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>
                : <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 sm:hidden animate-slideDown">
          <nav className="flex flex-col gap-1">
            <Link href="/" onClick={() => setMenuOpen(false)}
              className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">Inicio</Link>
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-subtle)] mb-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-emerald-600 text-[10px] font-bold text-white">{initials}</div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{user.name}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">{user.email}</p>
                  </div>
                </div>
                {user.role === "ADMIN" && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)}
                    className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">Panel Admin</Link>
                )}
                {user.role === "OWNER" && (
                  <Link href="/dashboard" onClick={() => setMenuOpen(false)}
                    className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">Dashboard</Link>
                )}
                <Link href="/perfil" onClick={() => setMenuOpen(false)}
                  className="rounded-[var(--radius-md)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">Mis Turnos</Link>
                <button onClick={() => { signOut(); setMenuOpen(false) }}
                  className="mt-2 rounded-[var(--radius-md)] bg-[var(--bg-muted)] px-3 py-2 text-sm text-[var(--text-secondary)] text-left">Cerrar sesión</button>
              </>
            ) : (
              <Link href="/login" onClick={() => setMenuOpen(false)}
                className="mt-2 rounded-[var(--radius-md)] bg-gradient-to-r from-[var(--accent)] to-emerald-600 px-3 py-2 text-sm text-white">Iniciar sesión</Link>
            )}
          </nav>
        </div>
      )}

      {/* User dropdown for mobile */}
      {userMenuOpen && !menuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
      )}
    </header>
  )
}
