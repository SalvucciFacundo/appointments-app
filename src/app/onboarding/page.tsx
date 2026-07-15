"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Input from "@/components/ui/Input"
import Button from "@/components/ui/Button"
import Card from "@/components/ui/Card"
import { useToast } from "@/components/ui/Toast"

type FormData = {
  name: string
  address: string
  phone: string
  specialty: string
}

type FieldErrors = Record<string, string>

const STEPS = [
  { key: "name", label: "Store Name", placeholder: "e.g. Mi Peluquería" },
  { key: "address", label: "Address", placeholder: "e.g. Av. Corrientes 1234, CABA" },
  { key: "phone", label: "Phone (optional)", placeholder: "e.g. +54 11 5555-1234" },
  { key: "specialty", label: "Specialty", placeholder: "e.g. Barbería, Manicura, Masajes" },
]

const INITIAL_FORM: FormData = { name: "", address: "", phone: "", specialty: "" }

function loadDraft(): FormData {
  if (typeof window === "undefined") return INITIAL_FORM
  try {
    const saved = localStorage.getItem("onboarding-draft")
    if (saved) return { ...INITIAL_FORM, ...JSON.parse(saved) }
  } catch {
    // ignore corrupt draft
  }
  return INITIAL_FORM
}

function saveDraft(data: FormData) {
  try {
    localStorage.setItem("onboarding-draft", JSON.stringify(data))
  } catch {
    // ignore quota errors
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(loadDraft)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState("")
  const [loading, setLoading] = useState(false)

  const updateField = (key: keyof FormData, value: string) => {
    const next = { ...form, [key]: value }
    setForm(next)
    saveDraft(next)
    // Clear field error on input
    if (errors[key]) {
      const nextErrors = { ...errors }
      delete nextErrors[key]
      setErrors(nextErrors)
    }
  }

  const validateStep = (): boolean => {
    const fieldKey = STEPS[step].key as keyof FormData
    // phone is optional
    if (fieldKey === "phone") return true

    const value = form[fieldKey].trim()
    if (!value) {
      setErrors({ [fieldKey]: `${STEPS[step].label} is required` })
      return false
    }
    return true
  }

  const handleNext = () => {
    if (validateStep()) {
      if (step < STEPS.length - 1) {
        setStep((s) => s + 1)
        setErrors({})
      }
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep((s) => s - 1)
      setErrors({})
    }
  }

  const handleSubmit = async () => {
    if (!validateStep()) return

    setLoading(true)
    setServerError("")

    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
          phone: form.phone.trim() || undefined,
          specialty: form.specialty.trim(),
        }),
      })

      if (!res.ok) {
        const body = await res.json()
        if (body.errors && Array.isArray(body.errors)) {
          const fieldErrors: FieldErrors = {}
          for (const err of body.errors) {
            if (err.field) fieldErrors[err.field] = err.message
          }
          setErrors(fieldErrors)
        } else {
          setServerError(body.error ?? "Failed to create store")
        }
        return
      }

      // Clear draft and redirect
      localStorage.removeItem("onboarding-draft")
      addToast("Store created successfully! Welcome to your dashboard.", "success")
      router.push("/dashboard")
    } catch {
      setServerError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          Create Your Store
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Step {step + 1} of {STEPS.length}: {currentStep.label}
        </p>

        {/* Progress bar */}
        <div className="mb-6 flex gap-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${
                i <= step ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        <Input
          label={currentStep.label}
          placeholder={currentStep.placeholder}
          value={form[currentStep.key as keyof FormData]}
          onChange={(e: FormEvent<HTMLInputElement>) =>
            updateField(currentStep.key as keyof FormData, e.currentTarget.value)
          }
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
              e.preventDefault()
              isLast ? handleSubmit() : handleNext()
            }
          }}
          error={errors[currentStep.key]}
          className="mb-6"
        />

        {serverError && (
          <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {serverError}
          </p>
        )}

        <div className="flex gap-3">
          {step > 0 && (
            <Button variant="secondary" onClick={handleBack} className="flex-1">
              Back
            </Button>
          )}
          {isLast ? (
            <Button onClick={handleSubmit} loading={loading} className="flex-1">
              Create Store
            </Button>
          ) : (
            <Button onClick={handleNext} className="flex-1">
              Next
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
