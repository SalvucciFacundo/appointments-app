import { get, post } from "./client"
import type { LoginInput, RegisterInput, User } from "./types"

const AUTH = "/api/auth"

export function register(input: RegisterInput): Promise<User> {
  return post<User>(`${AUTH}/register`, input)
}

export function login(input: LoginInput): Promise<User> {
  return post<User>(`${AUTH}/login`, input)
}

export function logout(): Promise<void> {
  return post<void>(`${AUTH}/logout`)
}

export function me(): Promise<User> {
  return get<User>(`${AUTH}/me`)
}