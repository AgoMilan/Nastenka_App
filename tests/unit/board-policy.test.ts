import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkBoardPermission } from "../../modules/boards/application/policies/board-policy.ts";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type {
  ActorMembership,
  BoardAuthorizationTarget,
} from "../../modules/boards/application/policies/board-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────

const activeBoard: BoardAuthorizationTarget = {
  boardId: "board-uuid-1",
  isDeleted: false,
};

const deletedBoard: BoardAuthorizationTarget = {
  boardId: "board-uuid-deleted",
  isDeleted: true,
};

const adminActor: ActorContext = {
  actor_user_id: "admin-uuid",
  global_role: "ADMIN",
  session_id: "session-admin",
  is_active: true,
};

const userActor: ActorContext = {
  actor_user_id: "user-uuid",
  global_role: "USER",
  session_id: "session-user",
  is_active: true,
};

const ownerMembership: ActorMembership = { role: "OWNER" };
const managerMembership: ActorMembership = { role: "MANAGER" };
const memberMembership: ActorMembership = { role: "MEMBER" };

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("BoardPolicy – checkBoardPermission", () => {
  // ── 1. Unauthenticated guard ────────────────────────────────
  describe("1. Unauthenticated (null ActorContext)", () => {
    test("vrací DENY(UNAUTHENTICATED) pro null actor na aktivní Nástěnce", () => {
      const result = checkBoardPermission(
        null,
        activeBoard,
        null,
        "BOARD_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "UNAUTHENTICATED");
    });

    test("vrací DENY(UNAUTHENTICATED) pro null actor na smazané Nástěnce", () => {
      const result = checkBoardPermission(
        null,
        deletedBoard,
        null,
        "BOARD_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "UNAUTHENTICATED");
    });
  });

  // ── 2. Soft-delete guard ────────────────────────────────────
  describe("2. Soft-deleted Nástěnka", () => {
    test("blokuje ADMIN – vrací DENY(BOARD_DELETED)", () => {
      const result = checkBoardPermission(
        adminActor,
        deletedBoard,
        null,
        "BOARD_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("blokuje OWNER – vrací DENY(BOARD_DELETED)", () => {
      const result = checkBoardPermission(
        userActor,
        deletedBoard,
        ownerMembership,
        "BOARD_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("blokuje MANAGER – vrací DENY(BOARD_DELETED)", () => {
      const result = checkBoardPermission(
        userActor,
        deletedBoard,
        managerMembership,
        "BOARD_EDIT",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("blokuje MEMBER – vrací DENY(BOARD_DELETED)", () => {
      const result = checkBoardPermission(
        userActor,
        deletedBoard,
        memberMembership,
        "BOARD_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });
  });

  // ── 3. ADMIN bypass ─────────────────────────────────────────
  describe("3. Global ADMIN – bypass bez členství", () => {
    const actions = [
      "BOARD_VIEW",
      "BOARD_EDIT",
      "BOARD_MANAGE_MEMBERS",
      "BOARD_MANAGE_SETTINGS",
      "BOARD_TRANSFER_OWNERSHIP",
      "BOARD_DELETE",
    ] as const;

    for (const action of actions) {
      test(`ADMIN bez členství → ALLOW pro ${action}`, () => {
        const result = checkBoardPermission(
          adminActor,
          activeBoard,
          null,
          action,
        );
        assert.equal(
          result.allowed,
          true,
          `Očekáváno ALLOW pro ADMIN → ${action}`,
        );
      });
    }

    test("ADMIN s přímým členstvím MEMBER → stále ALLOW pro BOARD_DELETE", () => {
      // ADMIN bypass nezáleží na membership roli
      const result = checkBoardPermission(
        adminActor,
        activeBoard,
        memberMembership,
        "BOARD_DELETE",
      );
      assert.equal(result.allowed, true);
    });
  });

  // ── 4. Non-member USER ──────────────────────────────────────
  describe("4. USER bez členství", () => {
    const actions = [
      "BOARD_VIEW",
      "BOARD_EDIT",
      "BOARD_MANAGE_MEMBERS",
      "BOARD_MANAGE_SETTINGS",
      "BOARD_TRANSFER_OWNERSHIP",
      "BOARD_DELETE",
    ] as const;

    for (const action of actions) {
      test(`USER bez členství → DENY(NOT_A_MEMBER) pro ${action}`, () => {
        const result = checkBoardPermission(
          userActor,
          activeBoard,
          null,
          action,
        );
        assert.equal(result.allowed, false);
        assert.ok(!result.allowed && result.reason === "NOT_A_MEMBER");
      });
    }
  });

  // ── 5. OWNER ────────────────────────────────────────────────
  describe("5. OWNER – plná oprávnění na aktivní Nástěnce", () => {
    const actions = [
      "BOARD_VIEW",
      "BOARD_EDIT",
      "BOARD_MANAGE_MEMBERS",
      "BOARD_MANAGE_SETTINGS",
      "BOARD_TRANSFER_OWNERSHIP",
      "BOARD_DELETE",
    ] as const;

    for (const action of actions) {
      test(`OWNER → ALLOW pro ${action}`, () => {
        const result = checkBoardPermission(
          userActor,
          activeBoard,
          ownerMembership,
          action,
        );
        assert.equal(
          result.allowed,
          true,
          `Očekáváno ALLOW pro OWNER → ${action}`,
        );
      });
    }
  });

  // ── 6. MANAGER ──────────────────────────────────────────────
  describe("6. MANAGER – částečná oprávnění", () => {
    test("MANAGER → ALLOW pro BOARD_VIEW", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        managerMembership,
        "BOARD_VIEW",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER → ALLOW pro BOARD_EDIT", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        managerMembership,
        "BOARD_EDIT",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER → ALLOW pro BOARD_MANAGE_MEMBERS", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        managerMembership,
        "BOARD_MANAGE_MEMBERS",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER → ALLOW pro BOARD_MANAGE_SETTINGS", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        managerMembership,
        "BOARD_MANAGE_SETTINGS",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER → DENY(INSUFFICIENT_ROLE) pro BOARD_TRANSFER_OWNERSHIP", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        managerMembership,
        "BOARD_TRANSFER_OWNERSHIP",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MANAGER → DENY(INSUFFICIENT_ROLE) pro BOARD_DELETE", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        managerMembership,
        "BOARD_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });
  });

  // ── 7. MEMBER ───────────────────────────────────────────────
  describe("7. MEMBER – pouze čtení", () => {
    test("MEMBER → ALLOW pro BOARD_VIEW", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        memberMembership,
        "BOARD_VIEW",
      );
      assert.equal(result.allowed, true);
    });

    test("MEMBER → DENY(INSUFFICIENT_ROLE) pro BOARD_EDIT", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        memberMembership,
        "BOARD_EDIT",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MEMBER → DENY(INSUFFICIENT_ROLE) pro BOARD_MANAGE_MEMBERS", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        memberMembership,
        "BOARD_MANAGE_MEMBERS",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MEMBER → DENY(INSUFFICIENT_ROLE) pro BOARD_MANAGE_SETTINGS", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        memberMembership,
        "BOARD_MANAGE_SETTINGS",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MEMBER → DENY(INSUFFICIENT_ROLE) pro BOARD_TRANSFER_OWNERSHIP", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        memberMembership,
        "BOARD_TRANSFER_OWNERSHIP",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MEMBER → DENY(INSUFFICIENT_ROLE) pro BOARD_DELETE", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        memberMembership,
        "BOARD_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });
  });

  // ── 8. AuthorizationResult tvar ─────────────────────────────
  describe("8. Tvar AuthorizationResult", () => {
    test("ALLOW výsledek má allowed: true a žádné pole reason", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        ownerMembership,
        "BOARD_VIEW",
      );
      assert.equal(result.allowed, true);
      assert.ok(!("reason" in result), "ALLOW nesmí mít pole reason");
    });

    test("DENY výsledek má allowed: false a pole reason", () => {
      const result = checkBoardPermission(
        userActor,
        activeBoard,
        memberMembership,
        "BOARD_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok("reason" in result && result.reason === "INSUFFICIENT_ROLE");
    });
  });
});
