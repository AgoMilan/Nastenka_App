import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkAreaPermission } from "../../modules/areas/application/policies/area-policy.ts";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type { ActorMembership } from "../../modules/boards/application/policies/board-authorization.ts";
import type { AreaAuthorizationTarget } from "../../modules/areas/application/policies/area-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────

const boardId = "board-uuid-1";
const otherBoardId = "board-uuid-2";

const activeArea: AreaAuthorizationTarget = {
  boardId,
  areaId: "area-uuid-1",
  isBoardDeleted: false,
};

const deletedBoardArea: AreaAuthorizationTarget = {
  boardId,
  areaId: "area-uuid-deleted",
  isBoardDeleted: true,
};

const otherBoardArea: AreaAuthorizationTarget = {
  boardId: otherBoardId,
  areaId: "area-uuid-other",
  isBoardDeleted: false,
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

const inactiveActor: ActorContext = {
  actor_user_id: "inactive-uuid",
  global_role: "USER",
  session_id: "session-inactive",
  is_active: false,
};

const ownerMembership: ActorMembership = { role: "OWNER" };
const managerMembership: ActorMembership = { role: "MANAGER" };
const memberMembership: ActorMembership = { role: "MEMBER" };

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("AreaPolicy – checkAreaPermission", () => {
  // ── 1. Unauthenticated / Inactive guards ─────────────────────
  describe("1. Unauthenticated & Inactive guards", () => {
    test("null ActorContext vrací DENY(UNAUTHENTICATED)", () => {
      const result = checkAreaPermission(
        null,
        boardId,
        null,
        activeArea,
        "AREA_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "UNAUTHENTICATED");
    });

    test("neaktivní uživatel (is_active: false) vrací DENY(UNAUTHENTICATED)", () => {
      const result = checkAreaPermission(
        inactiveActor,
        boardId,
        memberMembership,
        activeArea,
        "AREA_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "UNAUTHENTICATED");
    });

    test("smazaný uživatel (simulovaný null aktorem) vrací DENY(UNAUTHENTICATED)", () => {
      const result = checkAreaPermission(
        null,
        boardId,
        null,
        activeArea,
        "AREA_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "UNAUTHENTICATED");
    });
  });

  // ── 2. Soft-delete guard ────────────────────────────────────
  describe("2. Soft-deleted Nástěnka (isBoardDeleted: true)", () => {
    test("blokuje ADMIN – vrací DENY(BOARD_DELETED)", () => {
      const result = checkAreaPermission(
        adminActor,
        boardId,
        null,
        deletedBoardArea,
        "AREA_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("blokuje OWNER – vrací DENY(BOARD_DELETED)", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        ownerMembership,
        deletedBoardArea,
        "AREA_EDIT",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("blokuje MANAGER – vrací DENY(BOARD_DELETED)", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        managerMembership,
        deletedBoardArea,
        "AREA_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("blokuje MEMBER – vrací DENY(BOARD_DELETED)", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        memberMembership,
        deletedBoardArea,
        "AREA_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });
  });

  // ── 3. Cross-board security ─────────────────────────────────
  describe("3. Cross-board security (oblast z jiné Nástěnky)", () => {
    test("odmítne přístup pro MEMBER k oblasti z jiného boardu → DENY(CROSS_BOARD_ACCESS)", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        memberMembership,
        otherBoardArea,
        "AREA_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });

    test("odmítne přístup pro OWNER k oblasti z jiného boardu → DENY(CROSS_BOARD_ACCESS)", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        ownerMembership,
        otherBoardArea,
        "AREA_EDIT",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });

    test("odmítne přístup pro MANAGER k oblasti z jiného boardu → DENY(CROSS_BOARD_ACCESS)", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        managerMembership,
        otherBoardArea,
        "AREA_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });

    test("odmítne přístup i pro ADMIN při neshodě boardu → DENY(CROSS_BOARD_ACCESS)", () => {
      const result = checkAreaPermission(
        adminActor,
        boardId,
        null,
        otherBoardArea,
        "AREA_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });
  });

  // ── 4. Non-member USER ──────────────────────────────────────
  describe("4. USER bez členství", () => {
    const actions = [
      "AREA_VIEW",
      "AREA_CREATE",
      "AREA_EDIT",
      "AREA_DELETE",
    ] as const;

    for (const action of actions) {
      test(`USER bez členství → DENY(NOT_A_MEMBER) pro ${action}`, () => {
        const result = checkAreaPermission(
          userActor,
          boardId,
          null,
          activeArea,
          action,
        );
        assert.equal(result.allowed, false);
        assert.ok(!result.allowed && result.reason === "NOT_A_MEMBER");
      });
    }
  });

  // ── 5. Global ADMIN ─────────────────────────────────────────
  describe("5. Global ADMIN – bypass bez členství", () => {
    const actions = [
      "AREA_VIEW",
      "AREA_CREATE",
      "AREA_EDIT",
      "AREA_DELETE",
    ] as const;

    for (const action of actions) {
      test(`ADMIN bez členství → ALLOW pro ${action}`, () => {
        const result = checkAreaPermission(
          adminActor,
          boardId,
          null,
          activeArea,
          action,
        );
        assert.equal(
          result.allowed,
          true,
          `Očekáváno ALLOW pro ADMIN → ${action}`,
        );
      });
    }
  });

  // ── 6. OWNER ────────────────────────────────────────────────
  describe("6. OWNER – plná správa oblastí", () => {
    const actions = [
      "AREA_VIEW",
      "AREA_CREATE",
      "AREA_EDIT",
      "AREA_DELETE",
    ] as const;

    for (const action of actions) {
      test(`OWNER → ALLOW pro ${action}`, () => {
        const result = checkAreaPermission(
          userActor,
          boardId,
          ownerMembership,
          activeArea,
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

  // ── 7. MANAGER ──────────────────────────────────────────────
  describe("7. MANAGER – provozní správa oblastí (včetně smazání)", () => {
    const actions = [
      "AREA_VIEW",
      "AREA_CREATE",
      "AREA_EDIT",
      "AREA_DELETE",
    ] as const;

    for (const action of actions) {
      test(`MANAGER → ALLOW pro ${action}`, () => {
        const result = checkAreaPermission(
          userActor,
          boardId,
          managerMembership,
          activeArea,
          action,
        );
        assert.equal(
          result.allowed,
          true,
          `Očekáváno ALLOW pro MANAGER → ${action}`,
        );
      });
    }
  });

  // ── 8. MEMBER ───────────────────────────────────────────────
  describe("8. MEMBER – pouze zobrazení", () => {
    test("MEMBER → ALLOW pro AREA_VIEW", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        memberMembership,
        activeArea,
        "AREA_VIEW",
      );
      assert.equal(result.allowed, true);
    });

    test("MEMBER → DENY(INSUFFICIENT_ROLE) pro AREA_CREATE", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        memberMembership,
        activeArea,
        "AREA_CREATE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MEMBER → DENY(INSUFFICIENT_ROLE) pro AREA_EDIT", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        memberMembership,
        activeArea,
        "AREA_EDIT",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MEMBER → DENY(INSUFFICIENT_ROLE) pro AREA_DELETE", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        memberMembership,
        activeArea,
        "AREA_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });
  });

  // ── 9. Tvar AuthorizationResult ─────────────────────────────
  describe("9. Tvar AuthorizationResult", () => {
    test("ALLOW výsledek má allowed: true a žádné pole reason", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        ownerMembership,
        activeArea,
        "AREA_VIEW",
      );
      assert.equal(result.allowed, true);
      assert.ok(!("reason" in result));
    });

    test("DENY výsledek má allowed: false a pole reason", () => {
      const result = checkAreaPermission(
        userActor,
        boardId,
        memberMembership,
        activeArea,
        "AREA_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok("reason" in result && result.reason === "INSUFFICIENT_ROLE");
    });
  });
});
