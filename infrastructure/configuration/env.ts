import { envSchema, type Env } from "./env.schema.ts";

let cachedEnv: Env | null = null;

export class ConfigurationError extends Error {
  readonly issues?: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ConfigurationError";
    this.issues = issues;
  }
}

/**
 * Validuje proměnné prostředí podle schváleného Zod schématu (Fail-Fast princip).
 * V případě neplatné konfigurace vyhodí ConfigurationError s detailním popisem
 * chybějících/neplatných položek, aniž by prozradila jakékoliv tajné hodnoty.
 *
 * @param source Objekt proměnných (výchozí: process.env)
 * @returns Typově validovaný objekt Env
 */
export function validateEnv(
  source: Record<string, unknown> = process.env,
): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));

    const details = issues
      .map((issue) => `  - [${issue.path}]: ${issue.message}`)
      .join("\n");

    const errorMessage =
      `[FAIL-FAST] Neplatná konfigurace prostředí:\n${details}\n` +
      "Zkontrolujte soubor .env / .env.local podle .env.example.";

    throw new ConfigurationError(errorMessage, issues);
  }

  return result.data;
}

/**
 * Poskytuje načtenou a validovanou konfiguraci prostředí.
 * Výsledek se po první validaci cachuje v paměti.
 *
 * @returns Platný objekt Env
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = validateEnv();
  }
  return cachedEnv;
}

/**
 * Vymaže cache konfigurace (určeno pro izolované testování).
 */
export function resetEnvCache(): void {
  cachedEnv = null;
}
