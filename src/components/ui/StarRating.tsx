interface StarRatingProps {
  rating: number
  size?: "sm" | "md"
}

export default function StarRating({ rating, size = "sm" }: StarRatingProps) {
  const fullStars = Math.floor(rating)
  const hasHalf = rating % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0)
  const starSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"

  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <svg key={`full-${i}`} className={`${starSize} text-[var(--warning)]`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
      {hasHalf && (
        <svg className={`${starSize} text-[var(--warning)]`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <defs>
            <linearGradient id="halfStar">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="url(#halfStar)" stroke="currentColor" strokeWidth="1" />
        </svg>
      )}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <svg key={`empty-${i}`} className={`${starSize} text-[var(--border-default)]`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  )
}
