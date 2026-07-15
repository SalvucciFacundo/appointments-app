import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
    seed: "npx tsx ./prisma/seed.ts",
  },
  datasource: {
    url: "postgresql://postgres:facundo1288@localhost:5432/appointments_db",
  },
});
