import "dotenv/config";
import { PrismaClient, Role, AppointmentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...");

  // === 1. Users (upsert) ===

  const admin = await prisma.user.upsert({
    where: { email: "admin@appointments.app" },
    update: { name: "Admin", role: Role.ADMIN },
    create: {
      email: "admin@appointments.app",
      name: "Admin",
      role: Role.ADMIN,
      emailVerified: new Date(),
    },
  });
  console.log(`  Admin: ${admin.email}`);

  const owner1 = await prisma.user.upsert({
    where: { email: "owner1@test.com" },
    update: { name: "Carlos Peluquero", role: Role.OWNER },
    create: {
      email: "owner1@test.com",
      name: "Carlos Peluquero",
      role: Role.OWNER,
      emailVerified: new Date(),
    },
  });
  console.log(`  Owner 1: ${owner1.email}`);

  const owner2 = await prisma.user.upsert({
    where: { email: "owner2@test.com" },
    update: { name: "María Veterinaria", role: Role.OWNER },
    create: {
      email: "owner2@test.com",
      name: "María Veterinaria",
      role: Role.OWNER,
      emailVerified: new Date(),
    },
  });
  console.log(`  Owner 2: ${owner2.email}`);

  // === 2. Stores (upsert) ===

  const store1 = await prisma.store.upsert({
    where: { slug: "peluqueria-central" },
    update: {
      name: "Peluquería Central",
      description: "Peluquería y barbería tradicional en el centro de la ciudad.",
      address: "Av. Corrientes 1234, CABA",
      phone: "+541112345678",
      specialty: "Peluquería",
      ownerId: owner1.id,
      timezone: "America/Argentina/Buenos_Aires",
    },
    create: {
      name: "Peluquería Central",
      slug: "peluqueria-central",
      description: "Peluquería y barbería tradicional en el centro de la ciudad.",
      address: "Av. Corrientes 1234, CABA",
      phone: "+541112345678",
      specialty: "Peluquería",
      ownerId: owner1.id,
      timezone: "America/Argentina/Buenos_Aires",
    },
  });
  console.log(`  Store 1: ${store1.name} (slug: ${store1.slug})`);

  const store2 = await prisma.store.upsert({
    where: { slug: "veterinaria-norte" },
    update: {
      name: "Veterinaria Norte",
      description: "Clínica veterinaria con atención las 24 horas.",
      address: "Av. Cabildo 4321, CABA",
      phone: "+541187654321",
      specialty: "Veterinaria",
      ownerId: owner2.id,
      timezone: "America/Argentina/Buenos_Aires",
    },
    create: {
      name: "Veterinaria Norte",
      slug: "veterinaria-norte",
      description: "Clínica veterinaria con atención las 24 horas.",
      address: "Av. Cabildo 4321, CABA",
      phone: "+541187654321",
      specialty: "Veterinaria",
      ownerId: owner2.id,
      timezone: "America/Argentina/Buenos_Aires",
    },
  });
  console.log(`  Store 2: ${store2.name} (slug: ${store2.slug})`);

  // === 3. Business Hours (Mon-Sat 09:00-18:00, idempotent via findFirst) ===

  const daysOfWeek = [1, 2, 3, 4, 5, 6]; // Mon (1) through Sat (6)
  let businessHourCount = 0;

  for (const store of [store1, store2]) {
    for (const dayOfWeek of daysOfWeek) {
      const existing = await prisma.businessHour.findFirst({
        where: { storeId: store.id, dayOfWeek },
      });

      if (existing) {
        await prisma.businessHour.update({
          where: { id: existing.id },
          data: { openTime: "09:00", closeTime: "18:00" },
        });
      } else {
        await prisma.businessHour.create({
          data: {
            storeId: store.id,
            dayOfWeek,
            openTime: "09:00",
            closeTime: "18:00",
          },
        });
      }
      businessHourCount++;
    }
  }
  console.log(`  Business hours: ${businessHourCount}`);

  // === 4. Sample Appointments (3 per store, next 7 days, idempotent) ===

  const now = new Date();

  const appointmentDefs = [
    // Store 1 — Peluquería Central
    {
      storeId: store1.id,
      clientName: "Juan Pérez",
      clientPhone: "+5491112345678",
      clientEmail: "juan@example.com",
      service: "Corte de pelo",
      dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0),
      status: AppointmentStatus.CONFIRMED,
    },
    {
      storeId: store1.id,
      clientName: "Ana García",
      clientPhone: "+5491123456789",
      clientEmail: "ana@example.com",
      service: "Tintura",
      dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 14, 0),
      status: AppointmentStatus.CONFIRMED,
    },
    {
      storeId: store1.id,
      clientName: "Pedro Martínez",
      clientPhone: "+5491134567890",
      clientEmail: "pedro@example.com",
      service: "Barba",
      dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4, 11, 30),
      status: AppointmentStatus.PENDING,
    },
    // Store 2 — Veterinaria Norte
    {
      storeId: store2.id,
      clientName: "Laura Fernández",
      clientPhone: "+5491145678901",
      clientEmail: "laura@example.com",
      service: "Consulta general",
      dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0),
      status: AppointmentStatus.CONFIRMED,
    },
    {
      storeId: store2.id,
      clientName: "Roberto Díaz",
      clientPhone: "+5491156789012",
      clientEmail: "roberto@example.com",
      service: "Vacunación",
      dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 15, 0),
      status: AppointmentStatus.CONFIRMED,
    },
    {
      storeId: store2.id,
      clientName: "Sofía López",
      clientPhone: "+5491167890123",
      clientEmail: "sofia@example.com",
      service: "Peluquería canina",
      dateTime: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 10, 0),
      status: AppointmentStatus.PENDING,
    },
  ];

  let appointmentCount = 0;
  for (const def of appointmentDefs) {
    const existing = await prisma.appointment.findFirst({
      where: {
        storeId: def.storeId,
        dateTime: def.dateTime,
        clientEmail: def.clientEmail,
      },
    });

    if (existing) {
      await prisma.appointment.update({
        where: { id: existing.id },
        data: {
          clientName: def.clientName,
          clientPhone: def.clientPhone,
          service: def.service,
          status: def.status,
        },
      });
    } else {
      await prisma.appointment.create({ data: def });
    }
    appointmentCount++;
  }
  console.log(`  Appointments: ${appointmentCount}`);

  // === 5. Regular Customer User ===

  const customer = await prisma.user.upsert({
    where: { email: "customer@test.com" },
    update: { name: "Cliente Demo", role: Role.USER },
    create: {
      email: "customer@test.com",
      name: "Cliente Demo",
      role: Role.USER,
      emailVerified: new Date(),
    },
  });
  console.log(`  Customer: ${customer.email}`);

  // === 6. Reviews (upsert by compound unique [storeId, userId]) ===

  await prisma.review.upsert({
    where: { storeId_userId: { storeId: store1.id, userId: admin.id } },
    update: { rating: 5, comment: "Excelente servicio, muy profesionales." },
    create: {
      storeId: store1.id,
      userId: admin.id,
      rating: 5,
      comment: "Excelente servicio, muy profesionales.",
    },
  });
  console.log("  Review: admin → Peluquería Central (5★)");

  await prisma.review.upsert({
    where: { storeId_userId: { storeId: store2.id, userId: admin.id } },
    update: { rating: 4, comment: "Muy buena atención, un poco caro." },
    create: {
      storeId: store2.id,
      userId: admin.id,
      rating: 4,
      comment: "Muy buena atención, un poco caro.",
    },
  });
  console.log("  Review: admin → Veterinaria Norte (4★)");

  await prisma.review.upsert({
    where: { storeId_userId: { storeId: store1.id, userId: owner2.id } },
    update: { rating: 4, comment: "Buen corte, espera razonable." },
    create: {
      storeId: store1.id,
      userId: owner2.id,
      rating: 4,
      comment: "Buen corte, espera razonable.",
    },
  });
  console.log("  Review: owner2 → Peluquería Central (4★)");

  // === 7. Favorites (customer favorites both stores) ===

  const existingFavorites = await prisma.user.findUnique({
    where: { id: customer.id },
    select: { favoriteStores: { select: { id: true } } },
  });

  const favoritedIds = new Set(existingFavorites?.favoriteStores?.map((s) => s.id) ?? []);

  if (!favoritedIds.has(store1.id) || !favoritedIds.has(store2.id)) {
    const connectIds: string[] = [];
    if (!favoritedIds.has(store1.id)) connectIds.push(store1.id);
    if (!favoritedIds.has(store2.id)) connectIds.push(store2.id);

    await prisma.user.update({
      where: { id: customer.id },
      data: {
        favoriteStores: { connect: connectIds.map((id) => ({ id })) },
      },
    });
    console.log(`  Favorites: customer → ${connectIds.length} stores`);
  } else {
    console.log("  Favorites: already set (skipped)");
  }

  console.log("✅ Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
