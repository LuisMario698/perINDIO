import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Carga .env igual que Next.js, para que drizzle-kit use la misma conexión que la app.
loadEnvConfig(process.cwd());

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL. Copia .env.example como .env.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
