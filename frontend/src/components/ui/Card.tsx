import type { ReactNode } from "react"

interface CardProps {
  title?: string
  children: ReactNode
  className?: string
  padding?: "sm" | "md" | "lg"
}

const paddingClasses: Record<string, string> = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
}

export default function Card({ title, children, className = "", padding = "md" }: CardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]
        ${paddingClasses[padding]}
        ${className}`}
    >
      {title && (
        <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)] tracking-tight">
          {title}
        </h2>
      )}
      {children}
    </div>
  )
}
