import crypto from "node:crypto"

export function generateManagementToken(): string {
  return crypto.randomUUID()
}

export function buildManagementUrl(token: string): string {
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000"
  return `${baseUrl}/manage/${token}`
}
