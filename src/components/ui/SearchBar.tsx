"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"

interface SearchBarProps {
  specialties: string[]
  selectedSpecialty: string
}

export default function SearchBar({ specialties, selectedSpecialty }: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get("q") ?? "")
  const [showFilters, setShowFilters] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceTimer = useRef<number>(0)

  // Live search with debounce
  const triggerSearch = useCallback((value: string) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value.trim()) {
        params.set("q", value.trim())
      } else {
        params.delete("q")
      }
      params.delete("page") // reset page on new search
      router.push(`/?${params.toString()}`)
    }, 250) as unknown as number
  }, [router, searchParams])

  const handleSpecialtyChange = (specialty: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (specialty) {
      params.set("specialty", specialty)
    } else {
      params.delete("specialty")
    }
    params.delete("page")
    router.push(`/?${params.toString()}`)
  }

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && document.activeElement !== inputRef.current) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-tertiary)] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            triggerSearch(e.target.value)
          }}
          placeholder='Buscar comercios... (presioná "/" para buscar)'
          className="w-full rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] py-2.5 pl-10 pr-4 text-sm
            placeholder:text-[var(--text-quaternary)]
            hover:border-[var(--border-strong)]
            focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent
            text-[var(--text-primary)]
            transition-all duration-150"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("")
              if (debounceTimer.current) clearTimeout(debounceTimer.current)
              const params = new URLSearchParams(searchParams.toString())
              params.delete("q")
              router.push(`/?${params.toString()}`)
              inputRef.current?.focus()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            ✕
          </button>
        )}
      </div>

      {/* Specialty filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => { setShowFilters(!showFilters); handleSpecialtyChange("") }}
          className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium transition-all duration-150
            ${!selectedSpecialty
              ? "bg-gradient-to-r from-[var(--accent)] to-emerald-600 text-white shadow-sm"
              : "bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
        >
          <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M7 12h10" /><path d="M10 18h4" />
          </svg>
          Todas
        </button>
        {specialties.slice(0, showFilters ? specialties.length : 6).map((s) => (
          <button
            key={s}
            onClick={() => handleSpecialtyChange(selectedSpecialty === s ? "" : s)}
            className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium transition-all duration-150
              ${selectedSpecialty === s
                ? "bg-gradient-to-r from-[var(--accent)] to-emerald-600 text-white shadow-sm"
                : "bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              }`}
          >
            {s}
          </button>
        ))}
        {specialties.length > 6 && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="text-xs font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
          >
            {showFilters ? "Mostrar menos ↑" : `+${specialties.length - 6} más`}
          </button>
        )}
      </div>
    </div>
  )
}
