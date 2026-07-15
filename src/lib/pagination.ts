/**
 * Parse pagination params from a URL.
 * Returns page=1 if not specified, max limit of 100.
 */
export function parsePagination(url: URL): { skip: number; take: number; page: number } {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20))
  return { skip: (page - 1) * limit, take: limit, page }
}

export interface PaginatedResponse<T> {
  data: T[]
  page: number
  limit: number
  total: number
  totalPages: number
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}
