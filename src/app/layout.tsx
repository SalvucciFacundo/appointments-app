import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import SessionProvider from "@/components/SessionProvider"
import { ToastProvider } from "@/components/ui/Toast"
import { ThemeProvider } from "@/components/ThemeProvider"
import NavHeader from "@/components/NavHeader"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Appointments — Sistema de Turnos",
  description: "Sistema de gestión de turnos para tiendas de servicios",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[var(--bg-page)] text-[var(--text-primary)]">
        <SessionProvider>
          <ThemeProvider>
            <ToastProvider>
              <NavHeader />
              <main className="flex-1">
                {children}
              </main>

              {/* Footer */}
              <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <div className="mx-auto max-w-5xl px-4 py-8">
                  <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md accent-gradient">
                        <svg className="h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                          <line x1="16" x2="16" y1="2" y2="6" />
                          <line x1="8" x2="8" y1="2" y2="6" />
                          <line x1="3" x2="21" y1="10" y2="10" />
                        </svg>
                      </div>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">Appointments</span>
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      © {new Date().getFullYear()} Appointments. Sistema de gestión de turnos.
                    </p>
                  </div>
                </div>
              </footer>
            </ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
