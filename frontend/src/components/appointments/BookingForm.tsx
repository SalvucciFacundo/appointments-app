import { useState, type FormEvent } from "react"
import { book } from "@/api/stores"
import { ApiError } from "@/api/client"
import { useToast } from "@/components/ui/Toast"
import Input from "@/components/ui/Input"
import Button from "@/components/ui/Button"

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
  const { addToast } = useToast()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [service, setService] = useState("")
  const [notes, setNotes] = useState("")
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
          ¡Turno solicitado con éxito!
        </p>
        <p className="mt-1 text-xs text-[var(--success)] opacity-80">
          {selectedSlot.date} a las {selectedSlot.time}
        </p>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await book(slug, {
        date: selectedSlot.date,
        time: selectedSlot.time,
        clientName: name.trim(),
        clientPhone: phone.trim(),
        clientEmail: email.trim(),
        service: service.trim() || undefined,
        notes: notes.trim() || undefined,
      })

      setSuccess(true)
      addToast("Turno solicitado. Te llegará un email con los detalles para confirmar.", "success")
    } catch (err) {
      if (err instanceof ApiError) {
        const msg =
          err.code === "slot_unavailable"
            ? "El horario ya no está disponible. Elegí otro."
            : err.message
        setError(msg)
        addToast(msg, "error")
      } else {
        const msg = "Error de conexión. Intentá de nuevo."
        setError(msg)
        addToast(msg, "error")
      }
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

      <Input
        label="Nombre"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tu nombre"
      />
      <Input
        label="Teléfono"
        type="tel"
        required
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+54 11 5555-1234"
      />
      <Input
        label="Email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
      />
      <Input
        label="Servicio (opcional)"
        value={service}
        onChange={(e) => setService(e.target.value)}
        placeholder="Ej.: corte, manicura, masaje..."
      />
      <Input
        label="Notas (opcional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Algún detalle que quieras comentar"
      />

      <Button type="submit" loading={submitting} className="w-full" size="lg">
        Reservar
      </Button>
    </form>
  )
}
