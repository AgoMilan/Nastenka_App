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

describe("Better Auth server foundation & ActorContext", () => {
  test("auth modul lze importovat bez čtení env a bez live PostgreSQL", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;

    const authModule = await import("../../infrastructure/auth/index.ts");

    assert.equal(typeof authModule.getAuth, "function");
    assert.equal(typeof authModule.auth, "object");
    assert.equal(typeof authModule.resolveActorContext, "function");
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

  test("emailAndPassword je ve STEP 17.7B aktivováno", async () => {
    const { createBetterAuthOptions } =
      await import("../../infrastructure/auth/index.ts");

    const options = createBetterAuthOptions({} as unknown as Database, mockEnv);

    assert.deepEqual(options.emailAndPassword, { enabled: true });
  });

  test("Next.js Catch-All Auth Route Handler exportuje GET a POST", async () => {
    const routeHandler = await import("../../app/api/auth/[...all]/route.ts");

    assert.equal(typeof routeHandler.GET, "function");
    assert.equal(typeof routeHandler.POST, "function");
  });

  test("resolveActorContext vrací null pro neověřenou session (unauthenticated)", async () => {
    const { resolveActorContext } =
      await import("../../infrastructure/auth/index.ts");

    const mockAuth = {
      api: {
        getSession: async () => null,
      },
    };

    const actor = await resolveActorContext(new Headers(), {
      auth: mockAuth as any,
    });
    assert.equal(actor, null);
  });

  test("resolveActorContext sestaví platný ActorContext pro aktivního uživatele", async () => {
    const { resolveActorContext } =
      await import("../../infrastructure/auth/index.ts");

    const mockAuth = {
      api: {
        getSession: async () => ({
          user: { id: "user-uuid-1" },
          session: { id: "session-uuid-1" },
        }),
      },
    };

    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "user-uuid-1",
                globalRole: "ADMIN",
                isActive: true,
                deletedAt: null,
              },
            ],
          }),
        }),
      }),
    };

    const actor = await resolveActorContext(new Headers(), {
      auth: mockAuth as any,
      db: mockDb as any,
    });

    assert.deepEqual(actor, {
      actor_user_id: "user-uuid-1",
      global_role: "ADMIN",
      session_id: "session-uuid-1",
      is_active: true,
    });
  });

  test("resolveActorContext vrací null pro neaktivního uživatele (isActive = false)", async () => {
    const { resolveActorContext } =
      await import("../../infrastructure/auth/index.ts");

    const mockAuth = {
      api: {
        getSession: async () => ({
          user: { id: "user-uuid-inactive" },
          session: { id: "session-uuid-2" },
        }),
      },
    };

    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "user-uuid-inactive",
                globalRole: "USER",
                isActive: false,
                deletedAt: null,
              },
            ],
          }),
        }),
      }),
    };

    const actor = await resolveActorContext(new Headers(), {
      auth: mockAuth as any,
      db: mockDb as any,
    });

    assert.equal(actor, null);
  });

  test("resolveActorContext vrací null pro soft-deleted uživatele (deletedAt !== null)", async () => {
    const { resolveActorContext } =
      await import("../../infrastructure/auth/index.ts");

    const mockAuth = {
      api: {
        getSession: async () => ({
          user: { id: "user-uuid-deleted" },
          session: { id: "session-uuid-3" },
        }),
      },
    };

    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [
              {
                id: "user-uuid-deleted",
                globalRole: "USER",
                isActive: true,
                deletedAt: new Date(),
              },
            ],
          }),
        }),
      }),
    };

    const actor = await resolveActorContext(new Headers(), {
      auth: mockAuth as any,
      db: mockDb as any,
    });

    assert.equal(actor, null);
  });
});
