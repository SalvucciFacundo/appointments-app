"use client"

import { useEffect, useState } from "react"
import { useToast } from "@/components/ui/Toast"
import Card from "@/components/ui/Card"
import Button from "@/components/ui/Button"
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
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-center shadow-[var(--shadow-sm)]">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-[var(--warning)]">
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
      addToast(updated.suspended ? "Store suspended" : "Store activated", "success")
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
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="space-y-4 animate-pulse">
          <div className="h-6 w-48 skeleton" />
          <div className="h-4 w-full skeleton" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Card>
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 animate-fadeIn">
      <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
        Admin Panel
      </h1>

      {/* Global Metrics */}
      {stats && (
        <Card title="📊 Global Metrics">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Stores" value={stats.totalStores} />
            <MetricCard label="Appointments" value={stats.totalAppointments} />
            <MetricCard label="Users" value={stats.totalUsers} />
            <MetricCard label="Reviews" value={stats.totalReviews} />
          </div>
        </Card>
      )}

      {/* Integrations */}
      {integrations && (
        <Card title="🔌 Integrations">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: "Email", data: integrations.email },
              { label: "WhatsApp", data: integrations.whatsapp },
              { label: "Cron Reminders", data: integrations.cron },
              { label: "Google Calendar", data: integrations.googleCalendar },
            ].map(({ label, data }) => {
              const isConfigured = typeof data.configured === "boolean" ? data.configured : false
              return (
                <div key={label}
                  className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      isConfigured
                        ? "bg-[var(--success-light)] text-[var(--success)]"
                        : "bg-[var(--warning-light)] text-[var(--warning)]"
                    }`}>
                      {isConfigured ? "Active" : "Not configured"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                    {"provider" in data ? (data as { provider: string }).provider : ""}
                    {" — "}
                    {data.note}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Stores Table */}
      <Card title="🏪 Stores">
        {stores.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">No stores found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="py-2 pr-4 font-medium text-[var(--text-tertiary)] text-xs uppercase tracking-wide">Name</th>
                  <th className="py-2 pr-4 font-medium text-[var(--text-tertiary)] text-xs uppercase tracking-wide">Owner</th>
                  <th className="py-2 pr-4 font-medium text-[var(--text-tertiary)] text-xs uppercase tracking-wide">Specialty</th>
                  <th className="py-2 pr-4 font-medium text-[var(--text-tertiary)] text-xs uppercase tracking-wide">Status</th>
                  <th className="py-2 font-medium text-[var(--text-tertiary)] text-xs uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--border-subtle)]/50">
                    <td className="py-2 pr-4 text-sm text-[var(--text-primary)]">{s.name}</td>
                    <td className="py-2 pr-4 text-xs text-[var(--text-tertiary)]">
                      {s.owner.name ?? s.owner.email ?? "—"}
                    </td>
                    <td className="py-2 pr-4 text-xs text-[var(--text-tertiary)]">{s.specialty}</td>
                    <td className="py-2 pr-4">
                      {s.suspended ? (
                        <span className="inline-flex items-center rounded-full bg-[var(--danger-light)] px-2 py-0.5 text-xs font-medium text-[var(--danger)]">
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[var(--success-light)] px-2 py-0.5 text-xs font-medium text-[var(--success)]">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <Button
                        variant={s.suspended ? "primary" : "danger"}
                        size="sm"
                        onClick={() => handleToggleSuspend(s.id)}
                        loading={actionLoading === s.id}
                      >
                        {s.suspended ? "Activate" : "Suspend"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {storesTotalPages > 1 && (
          <Pagination page={storesPage} totalPages={storesTotalPages}
            onPageChange={(p) => { setStoresPage(p); loadData() }} />
        )}
      </Card>

      {/* Reviews Table */}
      <Card title="⭐ Reviews">
        {reviews.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">No reviews found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="py-2 pr-4 font-medium text-[var(--text-tertiary)] text-xs uppercase tracking-wide">Store</th>
                  <th className="py-2 pr-4 font-medium text-[var(--text-tertiary)] text-xs uppercase tracking-wide">User</th>
                  <th className="py-2 pr-4 font-medium text-[var(--text-tertiary)] text-xs uppercase tracking-wide">Rating</th>
                  <th className="py-2 pr-4 font-medium text-[var(--text-tertiary)] text-xs uppercase tracking-wide">Comment</th>
                  <th className="py-2 font-medium text-[var(--text-tertiary)] text-xs uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border-subtle)]/50">
                    <td className="py-2 pr-4 text-sm text-[var(--text-primary)]">{r.storeName}</td>
                    <td className="py-2 pr-4 text-xs text-[var(--text-tertiary)]">{r.userName}</td>
                    <td className="py-2 pr-4">
                      <StarRating rating={r.rating} />
                    </td>
                    <td className="py-2 pr-4 text-xs text-[var(--text-tertiary)] max-w-xs truncate">
                      {r.comment ?? "—"}
                    </td>
                    <td className="py-2">
                      <Button variant="danger" size="sm" onClick={() => handleDeleteReview(r.id)}
                        loading={actionLoading === r.id}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {reviewsTotalPages > 1 && (
          <Pagination page={reviewsPage} totalPages={reviewsTotalPages}
            onPageChange={(p) => { setReviewsPage(p); loadData() }} />
        )}
      </Card>
    </div>
  )
}
