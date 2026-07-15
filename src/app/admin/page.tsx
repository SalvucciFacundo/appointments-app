"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/Toast"
import Card from "@/components/ui/Card"
import Pagination from "@/components/ui/Pagination"

interface AdminStats {
  totalStores: number
  totalAppointments: number
  totalUsers: number
  totalReviews: number
}

interface AdminStore {
  id: string
  name: string
  slug: string
  specialty: string
  suspended: boolean
  owner: { id: string; name: string | null; email: string | null }
}

interface IntegrationStatus {
  email: { provider: string; configured: boolean; note: string }
  whatsapp: { provider: string; configured: boolean; note: string }
  cron: { configured: boolean; note: string }
  googleCalendar: { configured: boolean; storesConnected: number; totalStores: number; note: string }
}

interface AdminReview {
  id: string
  storeId: string
  storeName: string
  userId: string
  userName: string
  rating: number
  comment: string | null
  createdAt: string
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-center dark:border-gray-600 dark:bg-gray-800">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-yellow-500">
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  )
}

interface PaginatedData<T> {
  data: T[]
  page: number
  totalPages: number
  total: number
}

export default function AdminPage() {
  const { addToast } = useToast()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [stores, setStores] = useState<AdminStore[]>([])
  const [storesPage, setStoresPage] = useState(1)
  const [storesTotalPages, setStoresTotalPages] = useState(1)
  const [reviews, setReviews] = useState<AdminReview[]>([])
  const [reviewsPage, setReviewsPage] = useState(1)
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1)
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function loadData() {
    setLoading(true)
    setError(null)

    try {
      const [statsData, storesData, reviewsData, integrationsData] = await Promise.all([
        fetch("/api/admin/stats").then((r) => r.json()),
        fetch(`/api/admin/stores?page=${storesPage}&limit=10`).then((r) => r.json()),
        fetch(`/api/admin/reviews?page=${reviewsPage}&limit=10`).then((r) => r.json()),
        fetch("/api/admin/integrations").then((r) => r.json()),
      ])

      setStats(statsData)
      setStores(storesData.data ?? storesData)
      setStoresTotalPages(storesData.totalPages ?? 1)
      setReviews(reviewsData.data ?? reviewsData)
      setReviewsTotalPages(reviewsData.totalPages ?? 1)
      setIntegrations(integrationsData)
    } catch {
      setError("Failed to load admin data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleToggleSuspend(storeId: string) {
    setActionLoading(storeId)
    try {
      const res = await fetch(`/api/admin/stores/${storeId}`, { method: "PUT" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        addToast(body.error ?? "Failed to toggle store status", "error")
        return
      }
      const updated = await res.json()
      setStores((prev) =>
        prev.map((s) => (s.id === storeId ? { ...s, suspended: updated.suspended } : s)),
      )
      addToast(
        updated.suspended ? "Store suspended" : "Store activated",
        "success",
      )
    } catch {
      addToast("Network error. Please try again.", "error")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleDeleteReview(reviewId: string) {
    setActionLoading(reviewId)
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, { method: "DELETE" })
      if (!res.ok) {
        addToast("Failed to delete review", "error")
        return
      }
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
      setStats((prev) => (prev ? { ...prev, totalReviews: prev.totalReviews - 1 } : prev))
      addToast("Review deleted", "success")
    } catch {
      addToast("Network error. Please try again.", "error")
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-48 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Card>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Panel</h1>

      {/* Global Metrics */}
      {stats && (
        <Card title="Global Metrics">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard label="Stores" value={stats.totalStores} />
            <MetricCard label="Appointments" value={stats.totalAppointments} />
            <MetricCard label="Users" value={stats.totalUsers} />
            <MetricCard label="Reviews" value={stats.totalReviews} />
          </div>
        </Card>
      )}

      {/* Integrations */}
      {integrations && (
        <Card title="Integrations">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Email</p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    integrations.email.configured
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}
                >
                  {integrations.email.configured ? "Active" : "Not configured"}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {integrations.email.provider} — {integrations.email.note}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">WhatsApp</p>
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Stub
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {integrations.whatsapp.provider} — {integrations.whatsapp.note}
              </p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Cron Reminders</p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    integrations.cron.configured
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}
                >
                  {integrations.cron.configured ? "Configured" : "Not configured"}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{integrations.cron.note}</p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Google Calendar
                </p>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    integrations.googleCalendar.configured
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}
                >
                  {integrations.googleCalendar.configured ? "Ready" : "Not configured"}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {integrations.googleCalendar.note}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Stores Table */}
      <Card title="Stores">
        {stores.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No stores found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Name</th>
                  <th className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Owner</th>
                  <th className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Specialty</th>
                  <th className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Status</th>
                  <th className="py-2 font-medium text-gray-600 dark:text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{s.name}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                      {s.owner.name ?? s.owner.email ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{s.specialty}</td>
                    <td className="py-2 pr-4">
                      {s.suspended ? (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleToggleSuspend(s.id)}
                        disabled={actionLoading === s.id}
                        className={`rounded px-3 py-1 text-xs font-medium transition ${
                          s.suspended
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-red-600 text-white hover:bg-red-700"
                        } disabled:opacity-50`}
                      >
                        {actionLoading === s.id
                          ? "..."
                          : s.suspended
                            ? "Activate"
                            : "Suspend"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {storesTotalPages > 1 && (
          <Pagination
            page={storesPage}
            totalPages={storesTotalPages}
            onPageChange={(p) => { setStoresPage(p); loadData() }}
          />
        )}
      </Card>

      {/* Reviews Table */}
      <Card title="Reviews">
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No reviews found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Store</th>
                  <th className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">User</th>
                  <th className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Rating</th>
                  <th className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-400">Comment</th>
                  <th className="py-2 font-medium text-gray-600 dark:text-gray-400">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2 pr-4 text-gray-900 dark:text-gray-100">{r.storeName}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{r.userName}</td>
                    <td className="py-2 pr-4">
                      <StarRating rating={r.rating} />
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {r.comment ?? "—"}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleDeleteReview(r.id)}
                        disabled={actionLoading === r.id}
                        className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition"
                      >
                        {actionLoading === r.id ? "..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reviewsTotalPages > 1 && (
          <Pagination
            page={reviewsPage}
            totalPages={reviewsTotalPages}
            onPageChange={(p) => { setReviewsPage(p); loadData() }}
          />
        )}
      </Card>
    </div>
  )
}
