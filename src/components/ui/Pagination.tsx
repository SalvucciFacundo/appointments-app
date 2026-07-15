"use client"

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        ← Previous
      </button>

      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        // Show pages around current page
        let pageNum: number
        if (totalPages <= 7) {
          pageNum = i + 1
        } else if (page <= 4) {
          pageNum = i + 1
        } else if (page >= totalPages - 3) {
          pageNum = totalPages - 6 + i
        } else {
          pageNum = page - 3 + i
        }

        return (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              pageNum === page
                ? "bg-blue-600 text-white"
                : "border border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
            }`}
          >
            {pageNum}
          </button>
        )
      })}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        Next →
      </button>
    </div>
  )
}
