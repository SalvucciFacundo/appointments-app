import prisma from "@/lib/prisma"
import { getAvailableSlots } from "@/lib/slots"
import type { AppointmentStatus } from "@prisma/client"

export interface PublicStore {
  id: string
  name: string
  slug: string
  specialty: string
  address: string
  averageRating: number
  reviewCount: number
}

export interface PublicStoreDetail extends PublicStore {
  description: string | null
  phone: string | null
  timezone: string
  businessHours: {
    id: string
    dayOfWeek: number
    openTime: string
    closeTime: string
  }[]
}

function computeAvgRating(reviews: { rating: number }[]): number {
  if (reviews.length === 0) return 0
  const sum = reviews.reduce((a, b) => a + b.rating, 0)
  return Math.round((sum / reviews.length) * 10) / 10
}

export async function getPublicStores(params?: {
  specialty?: string
}): Promise<PublicStore[]> {
  const where: Record<string, unknown> = {}
  if (params?.specialty) {
    where.specialty = { contains: params.specialty, mode: "insensitive" }
  }

  const stores = await prisma.store.findMany({
    where,
    include: { reviews: { select: { rating: true } } },
  })

  return stores.map((store) => ({
    id: store.id,
    name: store.name,
    slug: store.slug,
    specialty: store.specialty,
    address: store.address,
    averageRating: computeAvgRating(store.reviews),
    reviewCount: store.reviews.length,
  }))
}

export async function getStoreBySlugPublic(
  slug: string,
): Promise<PublicStoreDetail | null> {
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      businessHours: true,
      reviews: { select: { rating: true } },
    },
  })

  if (!store) return null

  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    description: store.description,
    address: store.address,
    phone: store.phone,
    specialty: store.specialty,
    timezone: store.timezone,
    businessHours: store.businessHours,
    averageRating: computeAvgRating(store.reviews),
    reviewCount: store.reviews.length,
  }
}

export async function getStoreAvailableSlots(slug: string, date: string) {
  const store = await prisma.store.findUnique({
    where: { slug },
    include: {
      businessHours: true,
      blockedDates: true,
    },
  })

  if (!store) return null

  const appointments = await prisma.appointment.findMany({
    where: { storeId: store.id },
    select: { dateTime: true },
  })

  return getAvailableSlots(
    {
      businessHours: store.businessHours,
      blockedDates: store.blockedDates.map((bd) => ({
        date: bd.date.toISOString().slice(0, 10),
      })),
      slotDuration: store.slotDuration,
      maxParallelBookings: store.maxParallelBookings,
      maxSlotsPerDay: store.maxSlotsPerDay,
      timezone: store.timezone,
    },
    date,
    appointments,
  )
}

export async function createBooking(
  storeId: string,
  data: {
    clientName: string
    clientPhone: string
    clientEmail: string
    dateTime: string
    service?: string
    notes?: string
    userId?: string
  },
) {
  return prisma.appointment.create({
    data: {
      storeId,
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      clientEmail: data.clientEmail,
      dateTime: new Date(data.dateTime),
      service: data.service ?? null,
      notes: data.notes ?? null,
      userId: data.userId ?? null,
      status: (data.userId ? "CONFIRMED" : "PENDING") as AppointmentStatus,
    },
  })
}

export async function getUserAppointments(userId: string) {
  return prisma.appointment.findMany({
    where: { userId },
    include: {
      store: { select: { name: true, slug: true } },
    },
    orderBy: { dateTime: "desc" },
  })
}

export async function getFavorites(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      favoriteStores: {
        include: { reviews: { select: { rating: true } } },
      },
    },
  })

  if (!user) return []

  return user.favoriteStores.map((store) => ({
    id: store.id,
    name: store.name,
    slug: store.slug,
    specialty: store.specialty,
    address: store.address,
    averageRating: computeAvgRating(store.reviews),
    reviewCount: store.reviews.length,
  }))
}

export async function toggleFavorite(
  userId: string,
  storeId: string,
): Promise<boolean> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      favoriteStores: { where: { id: storeId }, select: { id: true } },
    },
  })

  const isFavorite = (existing?.favoriteStores?.length ?? 0) > 0

  if (isFavorite) {
    await prisma.user.update({
      where: { id: userId },
      data: { favoriteStores: { disconnect: { id: storeId } } },
    })
    return false
  }

  await prisma.user.update({
    where: { id: userId },
    data: { favoriteStores: { connect: { id: storeId } } },
  })
  return true
}

export async function createReview(
  storeId: string,
  userId: string,
  rating: number,
  comment?: string,
) {
  return prisma.review.create({
    data: {
      storeId,
      userId,
      rating,
      comment: comment ?? null,
    },
  })
}
