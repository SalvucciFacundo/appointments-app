// Pure validation functions — no server-side imports
// Importable from both client and test environments

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/

export function validateTimeFormat(value: string, field: string): string | null {
  if (!TIME_REGEX.test(value)) {
    return `${field} must be in HH:MM format`
  }
  return null
}

export function validateDayOfWeek(value: number): string | null {
  if (!Number.isInteger(value) || value < 0 || value > 6) {
    return "dayOfWeek must be an integer between 0 and 6"
  }
  return null
}

export function validateFutureDate(dateStr: string): string | null {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) {
    return "Invalid date format. Use YYYY-MM-DD"
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (date < today) {
    return "Date must be in the future"
  }
  return null
}
