"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

interface Toast {
  id: string
  text: string
  type: "success" | "error" | "info"
}

interface ToastContextValue {
  addToast: (text: string, type?: "success" | "error" | "info") => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

const typeStyles: Record<string, string> = {
  success: "bg-[var(--success)] text-white",
  error: "bg-[var(--danger)] text-white",
  info: "bg-[var(--info)] text-white",
}

const typeIcons: Record<string, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((text: string, type: "success" | "error" | "info" = "info") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((prev) => [...prev, { id, text, type }])

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-[var(--radius-lg)] px-4 py-3 text-sm font-medium shadow-[var(--shadow-lg)] animate-slideUp ${typeStyles[toast.type]}`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold shrink-0">
              {typeIcons[toast.type]}
            </span>
            {toast.text}
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
