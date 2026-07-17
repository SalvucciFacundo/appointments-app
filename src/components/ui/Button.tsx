"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<string, string> = {
  primary:
    "bg-gradient-to-r from-[var(--accent)] to-emerald-600 text-white shadow-sm shadow-emerald-500/10 hover:shadow-md hover:shadow-emerald-500/20 active:opacity-90 disabled:opacity-50",
  secondary:
    "bg-[var(--bg-muted)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] active:bg-[var(--bg-active)] disabled:opacity-50",
  danger:
    "bg-[var(--danger)] text-white hover:opacity-90 active:opacity-80 disabled:opacity-50",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] active:bg-[var(--bg-active)] disabled:opacity-50",
  outline:
    "bg-transparent text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)] active:bg-[var(--bg-active)] disabled:opacity-50",
}

const sizeClasses: Record<string, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2 text-sm gap-2",
  lg: "px-6 py-2.5 text-base gap-2",
}

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium
        transition-all duration-150 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]
        disabled:cursor-not-allowed
        ${variantClasses[variant] ?? variantClasses.primary}
        ${sizeClasses[size] ?? sizeClasses.md}
        ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
