package service

import "testing"

func TestParsePagination(t *testing.T) {
	cases := []struct {
		page, limit string
		want        Pagination
	}{
		{"", "", Pagination{Page: 1, Limit: 12, Skip: 0}},
		{"2", "10", Pagination{Page: 2, Limit: 10, Skip: 10}},
		{"0", "0", Pagination{Page: 1, Limit: 12, Skip: 0}},
		{"-1", "999", Pagination{Page: 1, Limit: 100, Skip: 0}},
		{"abc", "xyz", Pagination{Page: 1, Limit: 12, Skip: 0}},
		{"3", "50", Pagination{Page: 3, Limit: 50, Skip: 100}},
	}
	for _, tc := range cases {
		got := ParsePagination(tc.page, tc.limit)
		if got != tc.want {
			t.Errorf("ParsePagination(%q, %q) = %+v, want %+v", tc.page, tc.limit, got, tc.want)
		}
	}
}

func TestNewPaginatedResponse(t *testing.T) {
	if resp := NewPaginatedResponse([]int{1, 2, 3}, 25, 1, 12); resp.TotalPages != 3 {
		t.Errorf("TotalPages = %d, want 3", resp.TotalPages)
	}
	if resp := NewPaginatedResponse([]int{}, 0, 1, 12); resp.TotalPages != 0 {
		t.Errorf("TotalPages = %d, want 0", resp.TotalPages)
	}
	if resp := NewPaginatedResponse([]int{1}, 24, 2, 12); resp.TotalPages != 2 {
		t.Errorf("TotalPages = %d, want 2", resp.TotalPages)
	}
}
