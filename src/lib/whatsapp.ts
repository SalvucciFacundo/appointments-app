export interface WhatsAppReminderParams {
  phone: string
  clientName: string
  storeName: string
  dateTime: Date
  service?: string | null
}

export async function sendWhatsAppReminder(
  params: WhatsAppReminderParams,
): Promise<{ success: boolean; channel: string }> {
  console.log("[WhatsApp] stub — would send reminder to", params.phone, {
    clientName: params.clientName,
    storeName: params.storeName,
    dateTime: params.dateTime.toISOString(),
    service: params.service,
  })
  return { success: true, channel: "whatsapp-stub" }
}
