"use client"

import { useSession } from "next-auth/react"
import { useState } from "react"
import { useToast } from "@/components/ui/Toast"

interface SelectedSlot {
  date: string
  time: string
  endTime: string
}

interface BookingFormProps {
  slug: string
  selectedSlot: SelectedSlot | null
}

export default function BookingForm({ slug, selectedSlot }: BookingFormProps) {
  const { data: session } = useSession()
  const { addToast } = useToast()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!selectedSlot) return null

  if (success) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--success-light)] bg-[var(--success-light)] p-6 text-center animate-scaleIn">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white">
          <svg className="h-6 w-6 text-[var(--success)]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-[var(--success)]">
          ¡Turno reservado con éxito!
        </p>
        <p className="mt-1 text-xs text-[var(--success)] opacity-80">
          {selectedSlot.date} a las {selectedSlot.time}
        </p>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const dateTime = `${selectedSlot.date}T${selectedSlot.time}:00`

    try {
      const res = await fetch(`/api/stores/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: session?.user?.name ?? name,
          clientPhone: phone,
          clientEmail: session?.user?.email ?? email,
          dateTime,
        }),
      })

      const body = await res.json()

      if (!res.ok) {
        const msg = body.error ?? "Error al reservar el turno"
        setError(msg)
        addToast(msg, "error")
        return
      }

      setSuccess(true)
      addToast(
        session?.user
          ? "Turno confirmado. Te enviamos los detalles por email."
          : "Turno solicitado. Te llegará un email con los detalles para confirmar.",
        "success",
      )
    } catch {
      const msg = "Error de conexión. Intentá de nuevo."
      setError(msg)
      addToast(msg, "error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-[var(--radius-md)] bg-[var(--danger-light)] px-4 py-3">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      )}

      {!session && (
        <>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Nombre
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2.5 text-sm
                bg-[var(--bg-surface)] text-[var(--text-primary)]
                placeholder:text-[var(--text-quaternary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-all duration-150"
              placeholder="Tu nombre"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Teléfono
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2.5 text-sm
                bg-[var(--bg-surface)] text-[var(--text-primary)]
                placeholder:text-[var(--text-quaternary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-all duration-150"
              placeholder="+54 11 5555-1234"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2.5 text-sm
                bg-[var(--bg-surface)] text-[var(--text-primary)]
                placeholder:text-[var(--text-quaternary)]
                hover:border-[var(--border-strong)]
                focus:outline-none focus:ring-2 focus:ring-[var(--accent)]
                transition-all duration-150"
              placeholder="tu@email.com"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2.5 text-sm font-medium
          text-white transition-all duration-150
          hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)]
          disabled:cursor-not-allowed disabled:opacity-50
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-page)]"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Reservando...
          </span>
        ) : session ? (
          "Confirmar turno"
        ) : (
          "Reservar"
        )}
      </button>
    </form>
  )
}
