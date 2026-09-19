import { z } from "zod";

/**
 * Validační schéma proměnných prostředí aplikace Nástěnka.
 * Definuje povinné server-side proměnné a výchozí hodnoty.
 *
 * Bezpečnostní pravidlo: Žádný tajný klíč (DATABASE_URL, BETTER_AUTH_SECRET)
 * nesmí začínat prefixem NEXT_PUBLIC_!
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().positive().default(3000),

  // Databázové připojení (PostgreSQL)
  DATABASE_URL: z
    .string({
      required_error: "DATABASE_URL je povinná proměnná prostředí",
    })
    .url("DATABASE_URL musí mít platný formát URL")
    .refine(
      (val) => val.startsWith("postgresql://") || val.startsWith("postgres://"),
      {
        message:
          "DATABASE_URL musí být PostgreSQL connection string (začínat postgresql:// nebo postgres://)",
      },
    ),

  // Better Auth autentizace
  BETTER_AUTH_SECRET: z
    .string({
      required_error: "BETTER_AUTH_SECRET je povinná proměnná prostředí",
    })
    .min(
      32,
      "BETTER_AUTH_SECRET musí mít minimálně 32 znaků pro bezpečnou podepisovací sílu",
    ),

  BETTER_AUTH_URL: z
    .string()
    .url("BETTER_AUTH_URL musí mít platný formát URL")
    .default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;
