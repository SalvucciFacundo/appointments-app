"use client"

import { forwardRef, type InputHTMLAttributes } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-")

    return (
      <div className={className}>
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-[var(--radius-md)] border px-3 py-2 text-sm
            transition-all duration-150
            placeholder:text-[var(--text-quaternary)]
            focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1 focus:ring-offset-[var(--bg-page)]
            disabled:cursor-not-allowed disabled:opacity-50
            ${error
              ? "border-[var(--danger)] focus:ring-[var(--danger)]"
              : "border-[var(--border-default)] hover:border-[var(--border-strong)]"
            }
            bg-[var(--bg-surface)] text-[var(--text-primary)]
          `}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-[var(--danger)]">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">{hint}</p>
        )}
      </div>
    )
  },
)

Input.displayName = "Input"

export default Input
