import { defineConfig } from "prisma/config";
import process from "process";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    path: "./prisma/migrations",
    seed: "npx tsx ./prisma/seed.ts",
  },
  datasource: {
    url: "postgresql://appointments_user@localhost:5432/appointments_db",
  },
});
