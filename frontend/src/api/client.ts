import { getCookie } from "@/lib/cookies"
import type { ApiErrorBody } from "./types"

const BASE_URL = import.meta.env.VITE_API_URL ?? ""

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly field?: string

  constructor(status: number, code: string, message: string, field?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.field = field
  }
}

interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
  body?: unknown
  method?: string
}

type UnauthorizedHandler = () => void

let onUnauthorized: UnauthorizedHandler | null = null

/** Registers a handler invoked when any request answers 401. */
export function setOnUnauthorized(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

/** Redirects to the login page unless the user is already on an auth page. */
export function redirectToLogin() {
  if (typeof window === "undefined") return
  const { pathname } = window.location
  if (pathname !== "/login" && pathname !== "/register") {
    window.location.assign("/login")
  }
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET"
  const headers = new Headers(options.headers)
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
  }
  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = getCookie("csrf_token")
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken)
  }

  const init: RequestInit = {
    ...options,
    method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  }

  const res = await fetch(`${BASE_URL}${path}`, init)

  if (res.status === 204) return undefined as T

  const body = (await res.json().catch(() => null)) as ApiErrorBody | T | null

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.()
    const detail = (body as ApiErrorBody | null)?.error
    throw new ApiError(
      res.status,
      detail?.code ?? "error",
      detail?.message ?? `Request failed with status ${res.status}`,
      detail?.field,
    )
  }

  return body as T
}

export const get = <T>(path: string) => request<T>(path, { method: "GET" })

export const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body })

export const put = <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body })

export const del = (path: string) => request<void>(path, { method: "DELETE" })