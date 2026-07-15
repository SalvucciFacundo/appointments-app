"use server"

import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.EMAIL_FROM ?? "onboarding@resend.dev"

export interface EmailParams {
  to: string
  clientName: string
  storeName: string
  dateTime: Date
  service?: string | null
  managementUrl?: string
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
  })
}

async function safeSend(params: {
  to: string
  subject: string
  text: string
}): Promise<void> {
  try {
    await resend.emails.send({
      from: FROM,
      to: params.to,
      subject: params.subject,
      text: params.text,
    })
  } catch (err) {
    console.error("[email] Failed to send email:", err)
  }
}

export async function sendConfirmationEmail(params: EmailParams): Promise<void> {
  const { to, clientName, storeName, dateTime, service, managementUrl } = params

  let text = `Hola ${clientName},\n\n`
  text += `Tu turno ha sido registrado:\n`
  text += `- Establecimiento: ${storeName}\n`
  if (service) text += `- Servicio: ${service}\n`
  text += `- Fecha y hora: ${formatDateTime(dateTime)}\n\n`
  if (managementUrl) {
    text += `Podés gestionar tu turno desde este enlace:\n${managementUrl}\n\n`
  }
  text += `Gracias por tu reserva.\n`

  await safeSend({ to, subject: `Turno confirmado — ${storeName}`, text })
}

export async function sendCancellationEmail(params: EmailParams): Promise<void> {
  const { to, clientName, storeName, dateTime, service, managementUrl } = params

  let text = `Hola ${clientName},\n\n`
  text += `Tu turno ha sido cancelado:\n`
  text += `- Establecimiento: ${storeName}\n`
  if (service) text += `- Servicio: ${service}\n`
  text += `- Fecha y hora: ${formatDateTime(dateTime)}\n\n`
  if (managementUrl) {
    text += `Si necesitás reagendar, podés hacerlo desde:\n${managementUrl}\n\n`
  }
  text += `Lamentamos las molestias.\n`

  await safeSend({ to, subject: `Turno cancelado — ${storeName}`, text })
}

export async function sendReminderEmail(params: Omit<EmailParams, "managementUrl">): Promise<void> {
  const { to, clientName, storeName, dateTime, service } = params

  let text = `Hola ${clientName},\n\n`
  text += `Este es un recordatorio de tu turno:\n`
  text += `- Establecimiento: ${storeName}\n`
  if (service) text += `- Servicio: ${service}\n`
  text += `- Fecha y hora: ${formatDateTime(dateTime)}\n\n`
  text += `Te esperamos.\n`

  await safeSend({ to, subject: `Recordatorio de turno — ${storeName}`, text })
}
