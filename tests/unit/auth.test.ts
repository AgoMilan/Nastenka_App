import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Env } from "../../infrastructure/configuration/index.ts";
import type { Database } from "../../infrastructure/database/index.ts";

const mockEnv: Env = {
  NODE_ENV: "test",
  PORT: 3000,
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nastenka_test",
  BETTER_AUTH_SECRET: "this_is_a_very_secure_mock_secret_longer_than_32_chars",
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("Better Auth server foundation", () => {
  test("auth modul lze importovat bez čtení env a bez live PostgreSQL", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;

    const authModule = await import("../../infrastructure/auth/index.ts");

    assert.equal(typeof authModule.getAuth, "function");
    assert.equal(typeof authModule.auth, "object");
  });

  test("konfigurace používá Drizzle adapter pro PostgreSQL s usePlural true", async () => {
    const { betterAuthDrizzleAdapterConfig, createBetterAuthOptions } =
      await import("../../infrastructure/auth/index.ts");

    const options = createBetterAuthOptions({} as unknown as Database, mockEnv);

    assert.equal(typeof options.database, "function");
    assert.equal(betterAuthDrizzleAdapterConfig.provider, "pg");
    assert.equal(betterAuthDrizzleAdapterConfig.usePlural, true);
  });

  test("server-owned user fields nejsou zapisovatelná ani vracená klientovi", async () => {
    const { serverOwnedUserFields } =
      await import("../../infrastructure/auth/index.ts");

    for (const fieldName of ["globalRole", "deletedAt", "isActive"] as const) {
      assert.equal(serverOwnedUserFields[fieldName].input, false);
      assert.equal(serverOwnedUserFields[fieldName].returned, false);
    }
  });

  test("emailAndPassword není ve STEP 17.7A aktivováno", async () => {
    const { createBetterAuthOptions } =
      await import("../../infrastructure/auth/index.ts");

    const options = createBetterAuthOptions({} as unknown as Database, mockEnv);

    assert.equal(options.emailAndPassword, undefined);
  });
});
