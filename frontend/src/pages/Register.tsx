import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/auth/AuthContext"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import Input from "@/components/ui/Input"
import { useToast } from "@/components/ui/Toast"

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register({ name, email, password })
      addToast("Cuenta creada. Bienvenido — configurá tu primer comercio.", "success")
      navigate("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card title="Crear cuenta">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
          />
          <Input
            label="Contraseña"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            hint="Mínimo 8 caracteres."
          />
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button type="submit" loading={submitting} disabled={!name || !email || password.length < 8} className="w-full">
            Crear cuenta
          </Button>
        </form>
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="font-medium text-[var(--accent)] hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </Card>
    </div>
  )
}