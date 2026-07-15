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

  if (!selectedSlot) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Seleccioná un horario disponible para reservar.
      </p>
    )
  }

  if (success) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
        <p className="text-sm font-medium text-green-700 dark:text-green-400">
          ¡Turno reservado con éxito!
        </p>
        <p className="mt-1 text-sm text-green-600 dark:text-green-500">
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
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
          Turno seleccionado: {selectedSlot.date} de {selectedSlot.time} a{" "}
          {selectedSlot.endTime}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {!session && (
          <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Nombre
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Teléfono
              </span>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
          </>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {submitting
            ? "Reservando..."
            : session
              ? "Confirmar turno"
              : "Reservar"}
        </button>
      </form>
    </div>
  )
}
