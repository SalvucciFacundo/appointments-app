"use client"

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="mt-6 flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-3 py-1.5 text-sm
          text-[var(--text-secondary)] transition-all duration-150
          hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
          disabled:cursor-not-allowed disabled:opacity-40"
      >
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
        Anterior
      </button>

      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => {
            if (totalPages <= 7) return true
            if (p === 1 || p === totalPages) return true
            if (Math.abs(p - page) <= 1) return true
            return false
          })
          .map((p, idx, arr) => {
            const needGap = idx > 0 && p - arr[idx - 1] > 1
            return (
              <span key={p} className="inline-flex items-center">
                {needGap && (
                  <span className="px-1 text-xs text-[var(--text-tertiary)]">···</span>
                )}
                <button
                  onClick={() => onPageChange(p)}
                  className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-sm font-medium transition-all duration-150
                    ${p === page
                      ? "bg-[var(--accent)] text-white shadow-sm"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                    }`}
                >
                  {p}
                </button>
              </span>
            )
          })}
      </div>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 rounded-[var(--radius-md)] px-3 py-1.5 text-sm
          text-[var(--text-secondary)] transition-all duration-150
          hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
          disabled:cursor-not-allowed disabled:opacity-40"
      >
        Siguiente
        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  )
}
