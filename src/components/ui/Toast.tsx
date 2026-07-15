"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

// ---- Types ----

type ToastVariant = "success" | "error" | "info" | "warning"

interface Toast {
  id: string
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, variant?: ToastVariant) => void
  removeToast: (id: string) => void
}

// ---- Context ----

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

// ---- Provider ----

const AUTO_DISMISS_MS = 4000

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const colors: Record<ToastVariant, string> = {
    success: "border-green-500 bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    error: "border-red-500 bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    info: "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    warning:
      "border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  }

  const icons: Record<ToastVariant, string> = {
    success: "✓",
    error: "✕",
    info: "ℹ",
    warning: "⚠",
  }

  return (
    <div
      role="alert"
      className={`flex items-center gap-2 rounded-lg border-l-4 px-4 py-3 shadow-lg transition-all ${colors[toast.variant]}`}
    >
      <span className="text-lg font-bold">{icons[toast.variant]}</span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-2 text-sm opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      setToasts((prev) => [...prev, { id, message, variant }])
      setTimeout(() => removeToast(id), AUTO_DISMISS_MS)
    },
    [removeToast],
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-80 max-w-full">
            <ToastItem toast={toast} onDismiss={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
