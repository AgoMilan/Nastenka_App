import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  resolveActorContext,
  enforceAuthorization,
  serverOwnedUserFields,
  type ActorContext,
  type BoardEnforcementTarget,
} from "../../infrastructure/auth/index.ts";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../shared/errors/index.ts";

describe("STEP 18 – Auth Flow, Session, ActorContext & Server Guard", () => {
  // ── 1. Bezpečnost registrace a ochrana rolí ──────────────────
  describe("1. Bezpečnost registrace a server-owned pole", () => {
    test("server-owned pole (globalRole, isActive, deletedAt) mají input: false a returned: false", () => {
      assert.equal(serverOwnedUserFields.globalRole.input, false);
      assert.equal(serverOwnedUserFields.globalRole.returned, false);

      assert.equal(serverOwnedUserFields.isActive.input, false);
      assert.equal(serverOwnedUserFields.isActive.returned, false);

      assert.equal(serverOwnedUserFields.deletedAt.input, false);
      assert.equal(serverOwnedUserFields.deletedAt.returned, false);
    });

    test("uživatel nemůže při registraci ovlivnit roli na ADMIN (serverová autorita)", () => {
      // Simulace pokusu o payload s rolí ADMIN
      const untrustedPayload = {
        name: "Útočník",
        email: "hacker@priklad.cz",
        password: "securePassword123",
        globalRole: "ADMIN",
        isActive: false,
      };

      // Better Auth konfigurace ignoruje vstupní pole s input: false
      const filteredKeys = Object.keys(untrustedPayload).filter(
        (key) =>
          key in serverOwnedUserFields &&
          (serverOwnedUserFields as Record<string, { input: boolean }>)[key]
            .input === false,
      );

      assert.deepEqual(filteredKeys, ["globalRole", "isActive"]);
    });
  });

  // ── 2. Login & Session → ActorContext ────────────────────────
  describe("2. Login, Session a převod na ActorContext", () => {
    test("úspěšný login a platná session vytvoří validní ActorContext s rolí USER", async () => {
      const mockAuth = {
        api: {
          getSession: async () => ({
            user: { id: "user-uuid-registered" },
            session: { id: "session-uuid-fresh" },
          }),
        },
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "user-uuid-registered",
                  globalRole: "USER" as const,
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

      assert.ok(actor);
      assert.equal(actor.actor_user_id, "user-uuid-registered");
      assert.equal(actor.global_role, "USER");
      assert.equal(actor.session_id, "session-uuid-fresh");
      assert.equal(actor.is_active, true);
    });

    test("neplatné přihlašovací údaje (chybějící session) vrací null ActorContext (401 ekvivalent)", async () => {
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

    test("přihlášený uživatel s neaktivním účtem (isActive = false) je odmítnut", async () => {
      const mockAuth = {
        api: {
          getSession: async () => ({
            user: { id: "user-inactive" },
            session: { id: "session-inactive" },
          }),
        },
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "user-inactive",
                  globalRole: "USER" as const,
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

      assert.equal(actor, null, "Neaktivní uživatel nesmí získat ActorContext");
    });

    test("přihlášený uživatel se soft-deleted účtem (deletedAt !== null) je odmítnut", async () => {
      const mockAuth = {
        api: {
          getSession: async () => ({
            user: { id: "user-deleted" },
            session: { id: "session-deleted" },
          }),
        },
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "user-deleted",
                  globalRole: "USER" as const,
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

      assert.equal(
        actor,
        null,
        "Soft-deleted uživatel nesmí získat ActorContext",
      );
    });
  });

  // ── 3. Logout & revokace session ─────────────────────────────
  describe("3. Logout a neplatnost session po odhlášení", () => {
    test("po odhlášení je session neplatná a ActorContext je null", async () => {
      let isSessionActive = true;

      const mockAuth = {
        api: {
          getSession: async () => {
            if (!isSessionActive) return null;
            return {
              user: { id: "user-123" },
              session: { id: "sess-123" },
            };
          },
          signOut: async () => {
            isSessionActive = false;
          },
        },
      };

      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => [
                {
                  id: "user-123",
                  globalRole: "USER" as const,
                  isActive: true,
                  deletedAt: null,
                },
              ],
            }),
          }),
        }),
      };

      // Před logoutem – session je platná
      const actorBefore = await resolveActorContext(new Headers(), {
        auth: mockAuth as any,
        db: mockDb as any,
      });
      assert.ok(actorBefore);
      assert.equal(actorBefore.actor_user_id, "user-123");

      // Spuštění logoutu (simulace auth.api.signOut)
      await mockAuth.api.signOut();

      // Po logoutu – ActorContext je null
      const actorAfter = await resolveActorContext(new Headers(), {
        auth: mockAuth as any,
        db: mockDb as any,
      });
      assert.equal(actorAfter, null, "Po odhlášení musí být ActorContext null");
    });
  });

  // ── 4. Server Route Guards & Autoritativní ochrana ────────────
  describe("4. Autoritativní serverová ochrana a API enforcement", () => {
    test("neautentizovaný požadavek (actor = null) je v enforceAuthorization odmítnut jako 401", () => {
      const target: BoardEnforcementTarget = {
        type: "board",
        board: { boardId: "board-1", isDeleted: false },
        membership: null,
        action: "BOARD_VIEW",
      };

      const result = enforceAuthorization(null, target);

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthenticationError);
        assert.equal(result.error.statusCode, 401);
      }
    });

    test("autentizovaný uživatel bez oprávnění k Nástěnce je odmítnut jako 403 Forbidden", () => {
      const actor: ActorContext = {
        actor_user_id: "user-regular",
        global_role: "USER",
        session_id: "session-1",
        is_active: true,
      };

      const target: BoardEnforcementTarget = {
        type: "board",
        board: { boardId: "board-1", isDeleted: false },
        membership: null, // Uživatel není členem Nástěnky
        action: "BOARD_VIEW",
      };

      const result = enforceAuthorization(actor, target);

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthorizationError);
        assert.equal(result.error.statusCode, 403);
      }
    });

    test("autentizovaný uživatel s platným členstvím je úspěšně autorizován", () => {
      const actor: ActorContext = {
        actor_user_id: "user-owner",
        global_role: "USER",
        session_id: "session-1",
        is_active: true,
      };

      const target: BoardEnforcementTarget = {
        type: "board",
        board: { boardId: "board-1", isDeleted: false },
        membership: { role: "OWNER" },
        action: "BOARD_VIEW",
      };

      const result = enforceAuthorization(actor, target);

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.actor_user_id, "user-owner");
      }
    });
  });
});
