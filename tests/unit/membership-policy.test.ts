import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type { ActorMembership } from "../../modules/boards/application/policies/board-authorization.ts";
import type { MembershipAuthorizationTarget } from "../../modules/membership/application/policies/membership-authorization.ts";
import { checkMembershipPermission } from "../../modules/membership/application/policies/membership-policy.ts";

// ─────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────

const boardId = "board-uuid-1";
const otherBoardId = "board-uuid-2";

const adminActor: ActorContext = {
  actor_user_id: "admin-uuid",
  global_role: "ADMIN",
  session_id: "session-admin",
  is_active: true,
};

const userActor: ActorContext = {
  actor_user_id: "user-uuid-1",
  global_role: "USER",
  session_id: "session-user-1",
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

// Běžné cílové objekty
const targetAddMember: MembershipAuthorizationTarget = {
  boardId,
  isBoardDeleted: false,
  newRole: "MEMBER",
};

const targetAddManager: MembershipAuthorizationTarget = {
  boardId,
  isBoardDeleted: false,
  newRole: "MANAGER",
  hasExistingManager: false,
};

const targetRemoveMember: MembershipAuthorizationTarget = {
  boardId,
  isBoardDeleted: false,
  targetUserId: "target-member-id",
  targetRole: "MEMBER",
};

const targetRemoveManager: MembershipAuthorizationTarget = {
  boardId,
  isBoardDeleted: false,
  targetUserId: "target-manager-id",
  targetRole: "MANAGER",
};

const targetSoleOwner: MembershipAuthorizationTarget = {
  boardId,
  isBoardDeleted: false,
  targetUserId: "target-owner-id",
  targetRole: "OWNER",
  isSoleOwner: true,
};

// ─────────────────────────────────────────────────────────────
// Test Suite: MembershipPolicy – checkMembershipPermission
// ─────────────────────────────────────────────────────────────

describe("MembershipPolicy – checkMembershipPermission", () => {
  // ── 1. Unauthenticated & Inactive Guards ────────────────────
  describe("1. Autentizace a aktivita Actora", () => {
    test("blokuje null actor → DENY(UNAUTHENTICATED)", () => {
      const result = checkMembershipPermission(
        null,
        boardId,
        ownerMembership,
        targetAddMember,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "UNAUTHENTICATED");
    });

    test("blokuje neaktivního uživatele (is_active === false) → DENY(UNAUTHENTICATED)", () => {
      const result = checkMembershipPermission(
        inactiveActor,
        boardId,
        ownerMembership,
        targetAddMember,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "UNAUTHENTICATED");
    });
  });

  // ── 2. Soft-delete Guard ────────────────────────────────────
  describe("2. Soft-deleted Nástěnka (isBoardDeleted === true)", () => {
    const deletedTarget: MembershipAuthorizationTarget = {
      boardId,
      isBoardDeleted: true,
      newRole: "MEMBER",
    };

    test("blokuje ADMIN na smazané Nástěnce → DENY(BOARD_DELETED)", () => {
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        deletedTarget,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("blokuje OWNER na smazané Nástěnce → DENY(BOARD_DELETED)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        deletedTarget,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("blokuje MANAGER na smazané Nástěnce → DENY(BOARD_DELETED)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        deletedTarget,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });
  });

  // ── 3. Cross-Board Security Guard ───────────────────────────
  describe("3. Cross-Board izolace (target.boardId !== actorBoardId)", () => {
    const crossBoardTarget: MembershipAuthorizationTarget = {
      boardId: otherBoardId,
      isBoardDeleted: false,
      newRole: "MEMBER",
    };

    test("blokuje ADMIN při nesouladu boardId → DENY(CROSS_BOARD_ACCESS)", () => {
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        crossBoardTarget,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });

    test("blokuje OWNER při nesouladu boardId → DENY(CROSS_BOARD_ACCESS)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        crossBoardTarget,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });

    test("blokuje MANAGER při nesouladu boardId → DENY(CROSS_BOARD_ACCESS)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        crossBoardTarget,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });
  });

  // ── 4. Non-member Guard ─────────────────────────────────────
  describe("4. Non-member přístup (actorMembership === null)", () => {
    test("blokuje běžného uživatele bez členství na Nástěnce → DENY(NOT_A_MEMBER)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        null,
        targetAddMember,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "NOT_A_MEMBER");
    });

    test("ADMIN bez členství smí provést validní operaci → ALLOW", () => {
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        targetAddMember,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, true);
    });
  });

  // ── 5. Strukturální invarianty vlastnictví (I1, I2, I3) ──────
  describe("5. Invarianty vlastnictví (I1, I2, I3)", () => {
    test("I1: Odstranění sole OWNER je zakázáno pro OWNER → DENY(CANNOT_REMOVE_SOLE_OWNER)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetSoleOwner,
        "MEMBER_REMOVE",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "CANNOT_REMOVE_SOLE_OWNER",
      );
    });

    test("I1: Odstranění sole OWNER je zakázáno pro ADMIN → DENY(CANNOT_REMOVE_SOLE_OWNER)", () => {
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        targetSoleOwner,
        "MEMBER_REMOVE",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "CANNOT_REMOVE_SOLE_OWNER",
      );
    });

    test("I1: Odstranění sole OWNER je zakázáno pro MANAGER → DENY(CANNOT_REMOVE_SOLE_OWNER)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        targetSoleOwner,
        "MEMBER_REMOVE",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "CANNOT_REMOVE_SOLE_OWNER",
      );
    });

    test("I2: ChangeRole na OWNER je zakázána pro OWNER → DENY(OWNERSHIP_TRANSFER_REQUIRED)", () => {
      const targetChangeToOwner: MembershipAuthorizationTarget = {
        boardId,
        targetUserId: "member-id",
        targetRole: "MEMBER",
        newRole: "OWNER",
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetChangeToOwner,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "OWNERSHIP_TRANSFER_REQUIRED",
      );
    });

    test("I2: ChangeRole na OWNER je zakázána pro ADMIN → DENY(OWNERSHIP_TRANSFER_REQUIRED)", () => {
      const targetChangeToOwner: MembershipAuthorizationTarget = {
        boardId,
        targetUserId: "member-id",
        targetRole: "MEMBER",
        newRole: "OWNER",
      };
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        targetChangeToOwner,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "OWNERSHIP_TRANSFER_REQUIRED",
      );
    });

    test("I2: MEMBER_ADD s rolí OWNER je zakázáno pro všechny → DENY(OWNERSHIP_TRANSFER_REQUIRED)", () => {
      const targetAddOwner: MembershipAuthorizationTarget = {
        boardId,
        newRole: "OWNER",
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetAddOwner,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "OWNERSHIP_TRANSFER_REQUIRED",
      );
    });

    test("I3: Sesazení sole OWNER (demotion na MEMBER) je zakázáno pro OWNER → DENY(CANNOT_DEMOTE_SOLE_OWNER)", () => {
      const targetDemoteOwner: MembershipAuthorizationTarget = {
        boardId,
        targetUserId: "owner-id",
        targetRole: "OWNER",
        isSoleOwner: true,
        newRole: "MEMBER",
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetDemoteOwner,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "CANNOT_DEMOTE_SOLE_OWNER",
      );
    });

    test("I3: Sesazení sole OWNER (demotion na MANAGER) je zakázáno pro ADMIN → DENY(CANNOT_DEMOTE_SOLE_OWNER)", () => {
      const targetDemoteOwner: MembershipAuthorizationTarget = {
        boardId,
        targetUserId: "owner-id",
        targetRole: "OWNER",
        isSoleOwner: true,
        newRole: "MANAGER",
      };
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        targetDemoteOwner,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "CANNOT_DEMOTE_SOLE_OWNER",
      );
    });
  });

  // ── 6. Invariant max. 1 Manager (I4) ─────────────────────────
  describe("6. Invariant max. 1 Manager (I4)", () => {
    const targetAddManagerConflict: MembershipAuthorizationTarget = {
      boardId,
      newRole: "MANAGER",
      hasExistingManager: true,
    };

    const targetPromoteManagerConflict: MembershipAuthorizationTarget = {
      boardId,
      targetUserId: "member-id",
      targetRole: "MEMBER",
      newRole: "MANAGER",
      hasExistingManager: true,
    };

    test("MEMBER_ADD s rolí MANAGER při existujícím Managerovi → DENY(MANAGER_LIMIT_EXCEEDED)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetAddManagerConflict,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "MANAGER_LIMIT_EXCEEDED");
    });

    test("MEMBER_ADD s rolí MANAGER při existujícím Managerovi pro ADMIN → DENY(MANAGER_LIMIT_EXCEEDED)", () => {
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        targetAddManagerConflict,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "MANAGER_LIMIT_EXCEEDED");
    });

    test("MEMBER_CHANGE_ROLE na MANAGER při existujícím Managerovi → DENY(MANAGER_LIMIT_EXCEEDED)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetPromoteManagerConflict,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "MANAGER_LIMIT_EXCEEDED");
    });

    test("MEMBER_CHANGE_ROLE existujícího Managera beze změny role na MANAGER nehlásí limit překročen", () => {
      const targetKeepManager: MembershipAuthorizationTarget = {
        boardId,
        targetUserId: "manager-id",
        targetRole: "MANAGER",
        newRole: "MANAGER",
        hasExistingManager: true,
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetKeepManager,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, true);
    });

    test("MEMBER_ADD s rolí MANAGER bez existujícího Managera pro OWNER → ALLOW", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetAddManager,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, true);
    });
  });

  // ── 7. Autorizační matice: MEMBER_ADD ────────────────────────
  describe("7. Autorizační matice – MEMBER_ADD", () => {
    test("ADMIN: smí přidat člena s rolí MEMBER → ALLOW", () => {
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        targetAddMember,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, true);
    });

    test("OWNER: smí přidat člena s rolí MEMBER → ALLOW", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetAddMember,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, true);
    });

    test("OWNER: smí přidat člena s rolí MANAGER (pokud žádný není) → ALLOW", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetAddManager,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER: smí přidat člena s výchozí rolí MEMBER → ALLOW", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        targetAddMember,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER: smí přidat člena bez explicitně specifikované role (výchozí MEMBER) → ALLOW", () => {
      const targetNoRole: MembershipAuthorizationTarget = {
        boardId,
        isBoardDeleted: false,
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        targetNoRole,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER: nesmí přidat člena s rolí MANAGER → DENY(INSUFFICIENT_ROLE)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        targetAddManager,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MEMBER: nesmí přidat člena → DENY(INSUFFICIENT_ROLE)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        memberMembership,
        targetAddMember,
        "MEMBER_ADD",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });
  });

  // ── 8. Autorizační matice: MEMBER_REMOVE ─────────────────────
  describe("8. Autorizační matice – MEMBER_REMOVE", () => {
    test("ADMIN: smí odebrat řadového člena (MEMBER) → ALLOW", () => {
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        targetRemoveMember,
        "MEMBER_REMOVE",
      );
      assert.equal(result.allowed, true);
    });

    test("ADMIN: smí odebrat manažera (MANAGER) → ALLOW", () => {
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        targetRemoveManager,
        "MEMBER_REMOVE",
      );
      assert.equal(result.allowed, true);
    });

    test("OWNER: smí odebrat řadového člena (MEMBER) → ALLOW", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetRemoveMember,
        "MEMBER_REMOVE",
      );
      assert.equal(result.allowed, true);
    });

    test("OWNER: smí odebrat manažera (MANAGER) → ALLOW", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetRemoveManager,
        "MEMBER_REMOVE",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER: smí odebrat řadového člena (MEMBER) → ALLOW", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        targetRemoveMember,
        "MEMBER_REMOVE",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER: nesmí odebrat jiného manažera (MANAGER) → DENY(INSUFFICIENT_ROLE)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        targetRemoveManager,
        "MEMBER_REMOVE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MEMBER: nesmí administrativně odebrat žádného člena → DENY(INSUFFICIENT_ROLE)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        memberMembership,
        targetRemoveMember,
        "MEMBER_REMOVE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });
  });

  // ── 9. Autorizační matice: MEMBER_CHANGE_ROLE ────────────────
  describe("9. Autorizační matice – MEMBER_CHANGE_ROLE", () => {
    const targetMemberToManager: MembershipAuthorizationTarget = {
      boardId,
      targetUserId: "target-member-id",
      targetRole: "MEMBER",
      newRole: "MANAGER",
      hasExistingManager: false,
    };

    const targetManagerToMember: MembershipAuthorizationTarget = {
      boardId,
      targetUserId: "target-manager-id",
      targetRole: "MANAGER",
      newRole: "MEMBER",
    };

    test("ADMIN: smí povýšit MEMBER na MANAGER → ALLOW", () => {
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        targetMemberToManager,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, true);
    });

    test("ADMIN: smí změnit MANAGER na MEMBER → ALLOW", () => {
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        null,
        targetManagerToMember,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, true);
    });

    test("OWNER: smí povýšit MEMBER na MANAGER → ALLOW", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetMemberToManager,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, true);
    });

    test("OWNER: smí změnit MANAGER na MEMBER → ALLOW", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetManagerToMember,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER: nesmí měnit roli člena na MANAGER → DENY(INSUFFICIENT_ROLE)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        targetMemberToManager,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MANAGER: nesmí měnit roli manažera na MEMBER → DENY(INSUFFICIENT_ROLE)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        targetManagerToMember,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("MEMBER: nesmí měnit žádnou roli → DENY(INSUFFICIENT_ROLE)", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        memberMembership,
        targetMemberToManager,
        "MEMBER_CHANGE_ROLE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });
  });

  // ── 10. Struktura návratové hodnoty ──────────────────────────
  describe("10. Struktura návratové hodnoty (MembershipAuthorizationResult)", () => {
    test("při úspěchu vrací { allowed: true } bez vlastnosti reason", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetAddMember,
        "MEMBER_ADD",
      );
      assert.deepEqual(result, { allowed: true });
    });

    test("při zamítnutí vrací přesně { allowed: false, reason }", () => {
      const result = checkMembershipPermission(
        userActor,
        boardId,
        memberMembership,
        targetAddMember,
        "MEMBER_ADD",
      );
      assert.deepEqual(result, {
        allowed: false,
        reason: "INSUFFICIENT_ROLE",
      });
    });
  });

  // ── 11. MEMBER_LEAVE – Dobrovolný odchod člena ──────────────
  describe("11. MEMBER_LEAVE – Dobrovolný odchod člena", () => {
    test("MEMBER smí dobrovolně opustit Nástěnku → ALLOW", () => {
      const targetLeave: MembershipAuthorizationTarget = {
        boardId,
        isBoardDeleted: false,
        targetUserId: userActor.actor_user_id,
        targetRole: "MEMBER",
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        memberMembership,
        targetLeave,
        "MEMBER_LEAVE",
      );
      assert.equal(result.allowed, true);
    });

    test("MANAGER smí dobrovolně opustit Nástěnku → ALLOW", () => {
      const targetLeave: MembershipAuthorizationTarget = {
        boardId,
        isBoardDeleted: false,
        targetUserId: userActor.actor_user_id,
        targetRole: "MANAGER",
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        managerMembership,
        targetLeave,
        "MEMBER_LEAVE",
      );
      assert.equal(result.allowed, true);
    });

    test("OWNER nesmí opustit Nástěnku bez převodu vlastnictví → DENY(CANNOT_REMOVE_SOLE_OWNER)", () => {
      const targetLeave: MembershipAuthorizationTarget = {
        boardId,
        isBoardDeleted: false,
        targetUserId: userActor.actor_user_id,
        targetRole: "OWNER",
        isSoleOwner: true,
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        ownerMembership,
        targetLeave,
        "MEMBER_LEAVE",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "CANNOT_REMOVE_SOLE_OWNER",
      );
    });

    test("ADMIN v roli OWNER také nesmí opustit Nástěnku → DENY(CANNOT_REMOVE_SOLE_OWNER)", () => {
      const targetLeave: MembershipAuthorizationTarget = {
        boardId,
        isBoardDeleted: false,
        targetUserId: adminActor.actor_user_id,
        targetRole: "OWNER",
        isSoleOwner: true,
      };
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        ownerMembership,
        targetLeave,
        "MEMBER_LEAVE",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "CANNOT_REMOVE_SOLE_OWNER",
      );
    });

    test("ADMIN v roli MEMBER smí opustit Nástěnku → ALLOW", () => {
      const targetLeave: MembershipAuthorizationTarget = {
        boardId,
        isBoardDeleted: false,
        targetUserId: adminActor.actor_user_id,
        targetRole: "MEMBER",
      };
      const result = checkMembershipPermission(
        adminActor,
        boardId,
        memberMembership,
        targetLeave,
        "MEMBER_LEAVE",
      );
      assert.equal(result.allowed, true);
    });

    test("nečlen nemůže opustit Nástěnku → DENY(NOT_A_MEMBER)", () => {
      const targetLeave: MembershipAuthorizationTarget = {
        boardId,
        isBoardDeleted: false,
        targetUserId: userActor.actor_user_id,
        targetRole: null,
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        null,
        targetLeave,
        "MEMBER_LEAVE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "NOT_A_MEMBER");
    });

    test("odchod ze smazané Nástěnky je zamítnut → DENY(BOARD_DELETED)", () => {
      const targetLeave: MembershipAuthorizationTarget = {
        boardId,
        isBoardDeleted: true,
        targetUserId: userActor.actor_user_id,
        targetRole: "MEMBER",
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        memberMembership,
        targetLeave,
        "MEMBER_LEAVE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("cross-board odchod je zamítnut → DENY(CROSS_BOARD_ACCESS)", () => {
      const targetLeave: MembershipAuthorizationTarget = {
        boardId: otherBoardId,
        isBoardDeleted: false,
        targetUserId: userActor.actor_user_id,
        targetRole: "MEMBER",
      };
      const result = checkMembershipPermission(
        userActor,
        boardId,
        memberMembership,
        targetLeave,
        "MEMBER_LEAVE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });
  });
});
