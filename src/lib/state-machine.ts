/**
 * Pure functions for the appointment status state machine.
 * Testable without any server dependencies.
 */

import type { AppointmentStatus } from "@prisma/client"

/**
 * Maps action strings to target statuses.
 */
export const ACTION_TO_STATUS: Record<string, AppointmentStatus> = {
  CONFIRM: "CONFIRMED",
  REJECT: "CANCELLED",
  COMPLETE: "COMPLETED",
}

/**
 * Valid transitions: [current status] → [allowed target statuses].
 * Terminal states (CANCELLED, COMPLETED) have no valid transitions.
 */
const VALID_TRANSITIONS: Record<string, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
}

export function isValidAction(action: string): action is keyof typeof ACTION_TO_STATUS {
  return action in ACTION_TO_STATUS
}

export function getTargetStatus(action: string): AppointmentStatus | null {
  const a = action.toUpperCase()
  return ACTION_TO_STATUS[a] ?? null
}

export function isValidTransition(
  currentStatus: AppointmentStatus,
  targetStatus: AppointmentStatus,
): boolean {
  const allowed = VALID_TRANSITIONS[currentStatus]
  if (!allowed) return false
  return allowed.includes(targetStatus)
}

export type StatusTransitionResult =
  | { valid: true; targetStatus: AppointmentStatus }
  | { valid: false; error: string }

export function validateTransition(
  currentStatus: AppointmentStatus,
  action: string,
): StatusTransitionResult {
  if (!action || typeof action !== "string") {
    return { valid: false, error: "action is required (CONFIRM, REJECT, or COMPLETE)" }
  }

  const targetStatus = getTargetStatus(action)
  if (!targetStatus) {
    return { valid: false, error: "action must be CONFIRM, REJECT, or COMPLETE" }
  }

  if (!isValidTransition(currentStatus, targetStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${targetStatus}`,
    }
  }

  return { valid: true, targetStatus }
}
