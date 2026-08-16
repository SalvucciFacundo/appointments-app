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

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  apiKey?: string
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json")
  }
  if (options.apiKey) {
    headers.set("X-API-Key", options.apiKey)
  }

  const init: RequestInit = {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  }

  const res = await fetch(`${BASE_URL}${path}`, init)

  if (res.status === 204) return undefined as T

  const body = (await res.json().catch(() => null)) as ApiErrorBody | T | null

  if (!res.ok) {
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

export const get = <T>(path: string, apiKey?: string) => request<T>(path, { method: "GET", apiKey })

export const post = <T>(path: string, body?: unknown, apiKey?: string) =>
  request<T>(path, { method: "POST", body, apiKey })

export const put = <T>(path: string, body?: unknown, apiKey?: string) =>
  request<T>(path, { method: "PUT", body, apiKey })

export const del = (path: string, apiKey?: string) =>
  request<void>(path, { method: "DELETE", apiKey })
