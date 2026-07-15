"use client"

interface StarRatingProps {
  rating: number
  interactive?: boolean
  onChange?: (rating: number) => void
}

export default function StarRating({
  rating,
  interactive = false,
  onChange,
}: StarRatingProps) {
  const rounded = Math.round(rating)
  const stars = [1, 2, 3, 4, 5]

  return (
    <div className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {stars.map((star) => {
        const filled = star <= rounded

        if (interactive && onChange) {
          return (
            <button
              key={star}
              type="button"
              className="text-lg leading-none transition-colors focus:outline-none"
              style={{ color: filled ? "#f59e0b" : "#d1d5db" }}
              onClick={() => onChange(star)}
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            >
              ★
            </button>
          )
        }

        return (
          <span
            key={star}
            className="text-lg leading-none"
            style={{ color: filled ? "#f59e0b" : "#d1d5db" }}
            aria-hidden="true"
          >
            ★
          </span>
        )
      })}
    </div>
  )
}
