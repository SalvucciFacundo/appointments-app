package service

import (
	"strconv"
	"strings"
)

// Pagination defaults, per the design contract (limit default 12, max 100).
const (
	DefaultLimit = 12
	MaxLimit     = 100
)

// Pagination is the normalized pagination from request query values.
type Pagination struct {
	Page  int
	Limit int
	Skip  int
}

// PaginatedResponse is the wire shape of a paginated list.
type PaginatedResponse[T any] struct {
	Data       []T `json:"data"`
	Page       int `json:"page"`
	Limit      int `json:"limit"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

// ParsePagination normalizes page/limit query strings. page defaults to 1
// (min 1); limit defaults to DefaultLimit (min 1, max MaxLimit).
func ParsePagination(pageStr, limitStr string) Pagination {
	page := parseIntOr(pageStr, 1)
	if page < 1 {
		page = 1
	}

	limit := parseIntOr(limitStr, DefaultLimit)
	if limit < 1 {
		limit = 1
	}
	if limit > MaxLimit {
		limit = MaxLimit
	}

	return Pagination{Page: page, Limit: limit, Skip: (page - 1) * limit}
}

// NewPaginatedResponse builds the wire response for a page of data.
func NewPaginatedResponse[T any](data []T, total, page, limit int) PaginatedResponse[T] {
	if limit <= 0 {
		limit = DefaultLimit
	}
	return PaginatedResponse[T]{
		Data:       data,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: (total + limit - 1) / limit,
	}
}

// parseIntOr parses s as an int, returning def when s is empty, non-numeric,
// or zero — mirroring JS `parseInt(x) || def`.
func parseIntOr(s string, def int) int {
	n, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil || n == 0 {
		return def
	}
	return n
}
