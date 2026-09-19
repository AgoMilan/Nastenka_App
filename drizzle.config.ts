import { defineConfig } from "drizzle-kit";
import { getEnv } from "./infrastructure/configuration/index.ts";

function getDatabaseUrl(): string {
  try {
    return getEnv().DATABASE_URL;
  } catch {
    // Pokud prostředí není plně nakonfigurováno (např. při generování migrací offline),
    // použijeme hodnotu přímo z process.env nebo prázdný řetězec.
    return process.env.DATABASE_URL ?? "";
  }
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./database/schema/*",
  out: "./database/migrations",
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  strict: true,
  verbose: true,
});
