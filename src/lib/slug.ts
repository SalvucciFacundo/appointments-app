import prisma from "@/lib/prisma"

/**
 * Generates a URL-safe slug from a store name.
 * Handles collisions by appending -1, -2, etc. until unique.
 */
export async function generateUniqueSlug(name: string): Promise<string> {
  const base = generateSlug(name)

  let slug = base
  let counter = 1

  while (await prisma.store.findFirst({ where: { slug } })) {
    slug = `${base}-${counter}`
    counter++
  }

  return slug
}

/**
 * Sanitizes a name into a URL-safe slug.
 * Does NOT check for collisions — use generateUniqueSlug for that.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/--+/g, "-")
    .trim()
    .replace(/^-+|-+$/g, "")
}
