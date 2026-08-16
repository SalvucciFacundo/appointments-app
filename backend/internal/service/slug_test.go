package service

import (
	"context"
	"testing"
)

func TestGenerateSlug(t *testing.T) {
	cases := []struct{ name, want string }{
		{"Mi Clínica", "mi-clnica"},
		{"Café del Centro!", "caf-del-centro"},
		{"Don't Stop", "dont-stop"},
		{"  Foo   Bar  ", "foo-bar"},
		{"Foo_Bar", "foo-bar"},
		{"Foo--Bar", "foo-bar"},
		{"---Foo---", "foo"},
		{"Hello World 2026", "hello-world-2026"},
		{"", ""},
	}
	for _, tc := range cases {
		if got := GenerateSlug(tc.name); got != tc.want {
			t.Errorf("GenerateSlug(%q) = %q, want %q", tc.name, got, tc.want)
		}
	}
}

type fakeSlugStore struct{ existing map[string]bool }

func (f fakeSlugStore) SlugExists(_ context.Context, slug string) (bool, error) {
	return f.existing[slug], nil
}

func TestGenerateUniqueSlug(t *testing.T) {
	s := fakeSlugStore{existing: map[string]bool{"foo": true, "foo-1": true}}
	got, err := GenerateUniqueSlug(context.Background(), s, "Foo")
	if err != nil {
		t.Fatalf("GenerateUniqueSlug error: %v", err)
	}
	if got != "foo-2" {
		t.Errorf("GenerateUniqueSlug = %q, want %q", got, "foo-2")
	}
}

func TestGenerateUniqueSlugNoCollision(t *testing.T) {
	s := fakeSlugStore{existing: map[string]bool{}}
	got, err := GenerateUniqueSlug(context.Background(), s, "Hello World")
	if err != nil {
		t.Fatalf("GenerateUniqueSlug error: %v", err)
	}
	if got != "hello-world" {
		t.Errorf("GenerateUniqueSlug = %q, want %q", got, "hello-world")
	}
}
