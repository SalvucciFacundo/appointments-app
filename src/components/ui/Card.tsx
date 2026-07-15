import type { ReactNode } from "react"

interface CardProps {
  title?: string
  children: ReactNode
  className?: string
}

export default function Card({ title, children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm
        dark:border-gray-700 dark:bg-gray-900
        ${className}`}
    >
      {title && (
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
      )}
      {children}
    </div>
  )
}
