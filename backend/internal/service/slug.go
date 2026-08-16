package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
)

// Slug regexes mirror the TypeScript slug.ts pipeline exactly:
// remove chars outside [\w\s-], then fold [\s_]+ into "-", then collapse runs
// of hyphens. Go's \w and \s are ASCII, matching JS here.
var (
	slugRemoveRe = regexp.MustCompile(`[^\w\s-]`)
	slugSepRe    = regexp.MustCompile(`[\s_]+`)
	slugDashRe   = regexp.MustCompile(`-{2,}`)
)

// GenerateSlug sanitizes a name into a URL-safe slug. It does not check for
// collisions — use GenerateUniqueSlug for that.
func GenerateSlug(name string) string {
	s := strings.ToLower(name)
	s = slugRemoveRe.ReplaceAllString(s, "")
	s = slugSepRe.ReplaceAllString(s, "-")
	s = slugDashRe.ReplaceAllString(s, "-")
	s = strings.TrimSpace(s)
	return strings.Trim(s, "-")
}

// SlugStore is the store capability required to make a slug unique.
type SlugStore interface {
	SlugExists(ctx context.Context, slug string) (bool, error)
}

// GenerateUniqueSlug produces a slug from name, appending -1, -2, ... until
// no existing store uses it.
func GenerateUniqueSlug(ctx context.Context, s SlugStore, name string) (string, error) {
	base := GenerateSlug(name)
	slug := base
	for counter := 1; ; counter++ {
		exists, err := s.SlugExists(ctx, slug)
		if err != nil {
			return "", err
		}
		if !exists {
			return slug, nil
		}
		slug = fmt.Sprintf("%s-%d", base, counter)
	}
}
