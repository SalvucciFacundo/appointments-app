import { get, post, put, del } from "./client"
import type {
  Appointment,
  BlockedDate,
  BlockedDateInput,
  BookInput,
  BusinessHour,
  BusinessHourInput,
  CreateStoreInput,
  PaginatedResponse,
  PublicStore,
  Store,
  StoreCard,
  StoreDetail,
  TimeSlot,
  UpdateStoreInput,
} from "./types"

const PUBLIC = "/api/stores/public"
const STORES = "/api/stores"

// ---- Public API ----

export interface ListStoresParams {
  q?: string
  specialty?: string
  page?: number
  limit?: number
}

export function listPublicStores(params: ListStoresParams = {}): Promise<PaginatedResponse<StoreCard>> {
  const search = new URLSearchParams()
  if (params.q) search.set("q", params.q)
  if (params.specialty) search.set("specialty", params.specialty)
  if (params.page) search.set("page", String(params.page))
  if (params.limit) search.set("limit", String(params.limit))
  const qs = search.toString()
  return get<PaginatedResponse<StoreCard>>(`${PUBLIC}${qs ? `?${qs}` : ""}`)
}

export function getStoreBySlug(slug: string): Promise<PublicStore> {
  return get<PublicStore>(`${PUBLIC}/${encodeURIComponent(slug)}`)
}

export function getSlots(slug: string, date: string): Promise<TimeSlot[]> {
  return get<TimeSlot[]>(`/api/stores/${encodeURIComponent(slug)}/slots?date=${encodeURIComponent(date)}`)
}

export function book(slug: string, payload: BookInput): Promise<Appointment> {
  return post<Appointment>(`/api/stores/${encodeURIComponent(slug)}/book`, payload)
}

// ---- Owner API (X-API-Key) ----

export function listOwnerStores(apiKey: string): Promise<Store[]> {
  return get<Store[]>(STORES, apiKey)
}

export function createStore(payload: CreateStoreInput, apiKey: string): Promise<Store> {
  return post<Store>(STORES, payload, apiKey)
}

export function getStore(id: string, apiKey: string): Promise<StoreDetail> {
  return get<StoreDetail>(`${STORES}/${encodeURIComponent(id)}`, apiKey)
}

export function updateStore(id: string, payload: UpdateStoreInput, apiKey: string): Promise<Store> {
  return put<Store>(`${STORES}/${encodeURIComponent(id)}`, payload, apiKey)
}

export function replaceHours(id: string, hours: BusinessHourInput[], apiKey: string): Promise<BusinessHour[]> {
  return put<BusinessHour[]>(`${STORES}/${encodeURIComponent(id)}/hours`, hours, apiKey)
}

export function addBlockedDate(id: string, payload: BlockedDateInput, apiKey: string): Promise<BlockedDate> {
  return post<BlockedDate>(`${STORES}/${encodeURIComponent(id)}/blocked-dates`, payload, apiKey)
}

export function deleteBlockedDate(storeId: string, blockedDateId: string, apiKey: string): Promise<void> {
  return del(`${STORES}/${encodeURIComponent(storeId)}/blocked-dates/${encodeURIComponent(blockedDateId)}`, apiKey)
}
