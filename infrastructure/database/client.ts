import "server-only";
import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getEnv } from "../configuration/index.ts";
import * as schema from "../../database/schema/index.ts";

/**
 * Typ reprezentující Drizzle instanci napojenou na PostgreSQL se schématem.
 */
export type Database = PostgresJsDatabase<typeof schema>;

declare global {
  // Globální reference pro znovupoužití spojení během Next.js development hot-reloadingu
  var __nastenka_pg_client: postgres.Sql | undefined;
  var __nastenka_drizzle_db: Database | undefined;
}

/**
 * Vrací singleton instanci Drizzle ORM klienta napojeného na PostgreSQL se schématem.
 * Inicializace je striktně líná (lazy) – k připojení dochází až při prvním volání,
 * čímž je chráněn Next.js statický build před selháním bez živé databáze.
 *
 * @returns {Database} Drizzle databázový klient
 */
export function getDb(): Database {
  if (globalThis.__nastenka_drizzle_db) {
    return globalThis.__nastenka_drizzle_db;
  }

  const env = getEnv();

  // Konfigurace connection poolu podle běhového prostředí
  const client =
    globalThis.__nastenka_pg_client ??
    postgres(env.DATABASE_URL, {
      max: env.NODE_ENV === "production" ? 20 : 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // Prevence konfliktů v pooling/serverless prostředí
    });

  // V developmentu cachujeme klient v globalThis pro prevenci vyčerpání poolu při HMR
  if (env.NODE_ENV !== "production") {
    globalThis.__nastenka_pg_client = client;
  }

  const db = drizzle(client, { schema });

  if (env.NODE_ENV !== "production") {
    globalThis.__nastenka_drizzle_db = db;
  }

  return db;
}

/**
 * Bezpečně uzavře databázový connection pool (určeno pro testy nebo graceful shutdown).
 */
export async function closeDb(): Promise<void> {
  if (globalThis.__nastenka_pg_client) {
    await globalThis.__nastenka_pg_client.end({ timeout: 5 });
    globalThis.__nastenka_pg_client = undefined;
    globalThis.__nastenka_drizzle_db = undefined;
  }
}
