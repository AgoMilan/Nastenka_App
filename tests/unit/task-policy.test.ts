import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkTaskPermission } from "../../modules/tasks/application/policies/task-policy.ts";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type { ActorMembership } from "../../modules/boards/application/policies/board-authorization.ts";
import type {
  ActorTaskRelationship,
  TaskAction,
  TaskAuthorizationTarget,
} from "../../modules/tasks/application/policies/task-authorization.ts";
import type { AreaAuthorizationTarget } from "../../modules/areas/application/policies/area-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────

const boardId = "board-uuid-1";
const otherBoardId = "board-uuid-2";

const actorUserId = "user-uuid-actor";
const otherUserId = "user-uuid-other";

const adminActor: ActorContext = {
  actor_user_id: "admin-uuid",
  global_role: "ADMIN",
  session_id: "session-admin",
  is_active: true,
};

const userActor: ActorContext = {
  actor_user_id: actorUserId,
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

// Vztahy Actora k úkolu
const relAssignee: ActorTaskRelationship = {
  isAssignee: true,
  isParticipant: false,
};
const relParticipant: ActorTaskRelationship = {
  isAssignee: false,
  isParticipant: true,
};
const relOrdinaryMember: ActorTaskRelationship = {
  isAssignee: false,
  isParticipant: false,
};

// Cílové oblasti
const sameBoardArea: AreaAuthorizationTarget = {
  boardId,
  areaId: "area-uuid-same",
};

const differentBoardArea: AreaAuthorizationTarget = {
  boardId: otherBoardId,
  areaId: "area-uuid-diff",
};

// Cílové úkoly
const taskWithAssignee: TaskAuthorizationTarget = {
  taskId: "task-uuid-1",
  boardId,
  createdBy: otherUserId,
  creatorId: otherUserId,
  assigneeId: otherUserId,
  isBoardDeleted: false,
};

const taskUnassigned: TaskAuthorizationTarget = {
  taskId: "task-uuid-unassigned",
  boardId,
  createdBy: actorUserId,
  creatorId: actorUserId,
  assigneeId: null,
  isBoardDeleted: false,
};

const taskDeletedBoard: TaskAuthorizationTarget = {
  taskId: "task-uuid-deleted",
  boardId,
  createdBy: otherUserId,
  assigneeId: otherUserId,
  isBoardDeleted: true,
};

const otherBoardTask: TaskAuthorizationTarget = {
  taskId: "task-uuid-other-board",
  boardId: otherBoardId,
  createdBy: otherUserId,
  assigneeId: otherUserId,
  isBoardDeleted: false,
};

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("TaskPolicy – checkTaskPermission", () => {
  // ── 1. Unauthenticated & Inactive guards ─────────────────────
  describe("1. Unauthenticated & Inactive guards", () => {
    test("null ActorContext vrací DENY(UNAUTHENTICATED)", () => {
      const result = checkTaskPermission(
        null,
        boardId,
        null,
        taskWithAssignee,
        relOrdinaryMember,
        "TASK_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "UNAUTHENTICATED");
    });

    test("neaktivní uživatel (is_active: false) vrací DENY(UNAUTHENTICATED)", () => {
      const result = checkTaskPermission(
        inactiveActor,
        boardId,
        memberMembership,
        taskWithAssignee,
        relOrdinaryMember,
        "TASK_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "UNAUTHENTICATED");
    });

    test("smazaný uživatel (simulovaný null) vrací DENY(UNAUTHENTICATED)", () => {
      const result = checkTaskPermission(
        null,
        boardId,
        null,
        taskWithAssignee,
        relOrdinaryMember,
        "TASK_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "UNAUTHENTICATED");
    });
  });

  // ── 2. Soft-delete guard ────────────────────────────────────
  describe("2. Soft-deleted Nástěnka (isBoardDeleted: true)", () => {
    test("blokuje ADMIN – vrací DENY(BOARD_DELETED)", () => {
      const result = checkTaskPermission(
        adminActor,
        boardId,
        null,
        taskDeletedBoard,
        relOrdinaryMember,
        "TASK_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("blokuje OWNER – vrací DENY(BOARD_DELETED)", () => {
      const result = checkTaskPermission(
        userActor,
        boardId,
        ownerMembership,
        taskDeletedBoard,
        relOrdinaryMember,
        "TASK_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });

    test("blokuje ASSIGNEE – vrací DENY(BOARD_DELETED)", () => {
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        taskDeletedBoard,
        relAssignee,
        "TASK_CHANGE_STATUS",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "BOARD_DELETED");
    });
  });

  // ── 3. Cross-board security ─────────────────────────────────
  describe("3. Cross-board security", () => {
    test("úkol z jiného boardu vrací DENY(CROSS_BOARD_ACCESS) pro člena", () => {
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        otherBoardTask,
        relOrdinaryMember,
        "TASK_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });

    test("úkol z jiného boardu vrací DENY(CROSS_BOARD_ACCESS) i pro ADMIN", () => {
      const result = checkTaskPermission(
        adminActor,
        boardId,
        null,
        otherBoardTask,
        relOrdinaryMember,
        "TASK_VIEW",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });

    test("přesun do oblasti z jiného boardu vrací DENY(CROSS_BOARD_ACCESS)", () => {
      const taskWithCrossArea: TaskAuthorizationTarget = {
        ...taskWithAssignee,
        targetArea: differentBoardArea,
      };
      const result = checkTaskPermission(
        userActor,
        boardId,
        ownerMembership,
        taskWithCrossArea,
        relAssignee,
        "TASK_CHANGE_AREA",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "CROSS_BOARD_ACCESS");
    });

    test("přesun do oblasti ze stejného boardu projde pro oprávněnou roli", () => {
      const taskWithSameArea: TaskAuthorizationTarget = {
        ...taskWithAssignee,
        targetArea: sameBoardArea,
      };
      const result = checkTaskPermission(
        userActor,
        boardId,
        ownerMembership,
        taskWithSameArea,
        relAssignee,
        "TASK_CHANGE_AREA",
      );
      assert.equal(result.allowed, true);
    });
  });

  // ── 4. Non-member USER ──────────────────────────────────────
  describe("4. Non-member USER", () => {
    const allActions: TaskAction[] = [
      "TASK_VIEW",
      "TASK_CREATE",
      "TASK_EDIT_TITLE",
      "TASK_EDIT_DESCRIPTION",
      "TASK_SET_PRIORITY",
      "TASK_CHANGE_ASSIGNEE",
      "TASK_TAKE_OVER",
      "TASK_JOIN_AS_PARTICIPANT",
      "TASK_LEAVE_AS_PARTICIPANT",
      "TASK_REMOVE_PARTICIPANT",
      "TASK_CHANGE_STATUS",
      "TASK_CHANGE_AREA",
      "TASK_CHANGE_DUE_DATE",
      "TASK_ARCHIVE",
      "TASK_DELETE",
    ];

    for (const action of allActions) {
      test(`nečlen boardu → DENY(NOT_A_MEMBER) pro ${action}`, () => {
        const result = checkTaskPermission(
          userActor,
          boardId,
          null,
          taskWithAssignee,
          relOrdinaryMember,
          action,
        );
        assert.equal(result.allowed, false);
        assert.ok(!result.allowed && result.reason === "NOT_A_MEMBER");
      });
    }
  });

  // ── 5. Participant pravidla (JOIN / LEAVE / REMOVE) ─────────
  describe("5. Participant pravidla (JOIN / LEAVE / REMOVE)", () => {
    test("JOIN bez assignee → DENY(TASK_HAS_NO_ASSIGNEE)", () => {
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        taskUnassigned,
        relOrdinaryMember,
        "TASK_JOIN_AS_PARTICIPANT",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "TASK_HAS_NO_ASSIGNEE");
    });

    test("JOIN s assignee → ALLOW", () => {
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        taskWithAssignee,
        relOrdinaryMember,
        "TASK_JOIN_AS_PARTICIPANT",
      );
      assert.equal(result.allowed, true);
    });

    test("LEAVE sám sebe (targetUserId = actor_user_id) → ALLOW", () => {
      const target: TaskAuthorizationTarget = {
        ...taskWithAssignee,
        targetUserId: actorUserId,
      };
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        target,
        relParticipant,
        "TASK_LEAVE_AS_PARTICIPANT",
      );
      assert.equal(result.allowed, true);
    });

    test("LEAVE bez specifikace targetUserId (implicitně sám sebe) → ALLOW", () => {
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        taskWithAssignee,
        relParticipant,
        "TASK_LEAVE_AS_PARTICIPANT",
      );
      assert.equal(result.allowed, true);
    });

    test("LEAVE jiného uživatele (targetUserId !== actor_user_id) → DENY(CANNOT_LEAVE_OTHER_PARTICIPANT)", () => {
      const target: TaskAuthorizationTarget = {
        ...taskWithAssignee,
        targetUserId: otherUserId,
      };
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        target,
        relParticipant,
        "TASK_LEAVE_AS_PARTICIPANT",
      );
      assert.equal(result.allowed, false);
      assert.ok(
        !result.allowed && result.reason === "CANNOT_LEAVE_OTHER_PARTICIPANT",
      );
    });

    test("REMOVE participant assigneem → ALLOW", () => {
      const target: TaskAuthorizationTarget = {
        ...taskWithAssignee,
        targetUserId: otherUserId,
      };
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        target,
        relAssignee,
        "TASK_REMOVE_PARTICIPANT",
      );
      assert.equal(result.allowed, true);
    });

    test("REMOVE participant běžným memberem → DENY(INSUFFICIENT_ROLE)", () => {
      const target: TaskAuthorizationTarget = {
        ...taskWithAssignee,
        targetUserId: otherUserId,
      };
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        target,
        relOrdinaryMember,
        "TASK_REMOVE_PARTICIPANT",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("REMOVE participant spoluřešitelem (který není assignee) → DENY(INSUFFICIENT_ROLE)", () => {
      const target: TaskAuthorizationTarget = {
        ...taskWithAssignee,
        targetUserId: otherUserId,
      };
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        target,
        relParticipant,
        "TASK_REMOVE_PARTICIPANT",
      );
      assert.equal(result.allowed, false);
      assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
    });

    test("REMOVE participant managerem → ALLOW", () => {
      const target: TaskAuthorizationTarget = {
        ...taskWithAssignee,
        targetUserId: otherUserId,
      };
      const result = checkTaskPermission(
        userActor,
        boardId,
        managerMembership,
        target,
        relOrdinaryMember,
        "TASK_REMOVE_PARTICIPANT",
      );
      assert.equal(result.allowed, true);
    });

    test("REMOVE participant ownerem → ALLOW", () => {
      const target: TaskAuthorizationTarget = {
        ...taskWithAssignee,
        targetUserId: otherUserId,
      };
      const result = checkTaskPermission(
        userActor,
        boardId,
        ownerMembership,
        target,
        relOrdinaryMember,
        "TASK_REMOVE_PARTICIPANT",
      );
      assert.equal(result.allowed, true);
    });

    test("REMOVE participant adminem → ALLOW", () => {
      const target: TaskAuthorizationTarget = {
        ...taskWithAssignee,
        targetUserId: otherUserId,
      };
      const result = checkTaskPermission(
        adminActor,
        boardId,
        null,
        target,
        relOrdinaryMember,
        "TASK_REMOVE_PARTICIPANT",
      );
      assert.equal(result.allowed, true);
    });
  });

  // ── 6. Global ADMIN bypass ──────────────────────────────────
  describe("6. Global ADMIN – plná oprávnění na platném boardu", () => {
    const adminActions: TaskAction[] = [
      "TASK_VIEW",
      "TASK_CREATE",
      "TASK_EDIT_TITLE",
      "TASK_EDIT_DESCRIPTION",
      "TASK_SET_PRIORITY",
      "TASK_CHANGE_ASSIGNEE",
      "TASK_TAKE_OVER",
      "TASK_JOIN_AS_PARTICIPANT",
      "TASK_LEAVE_AS_PARTICIPANT",
      "TASK_REMOVE_PARTICIPANT",
      "TASK_CHANGE_STATUS",
      "TASK_CHANGE_AREA",
      "TASK_CHANGE_DUE_DATE",
      "TASK_ARCHIVE",
      "TASK_DELETE",
    ];

    for (const action of adminActions) {
      test(`ADMIN → ALLOW pro ${action}`, () => {
        const result = checkTaskPermission(
          adminActor,
          boardId,
          null,
          taskWithAssignee,
          relOrdinaryMember,
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

  // ── 7. OWNER & MANAGER pravomoci ────────────────────────────
  describe("7. OWNER a MANAGER pravomoci", () => {
    const privilegedActions: TaskAction[] = [
      "TASK_CHANGE_STATUS",
      "TASK_CHANGE_AREA",
      "TASK_CHANGE_DUE_DATE",
      "TASK_ARCHIVE",
      "TASK_DELETE",
    ];

    for (const action of privilegedActions) {
      test(`OWNER (i když není řešitel) → ALLOW pro ${action}`, () => {
        const result = checkTaskPermission(
          userActor,
          boardId,
          ownerMembership,
          taskWithAssignee,
          relOrdinaryMember,
          action,
        );
        assert.equal(result.allowed, true);
      });

      test(`MANAGER (i když není řešitel) → ALLOW pro ${action}`, () => {
        const result = checkTaskPermission(
          userActor,
          boardId,
          managerMembership,
          taskWithAssignee,
          relOrdinaryMember,
          action,
        );
        assert.equal(result.allowed, true);
      });
    }
  });

  // ── 8. ASSIGNEE & PARTICIPANT rozšířená pracovní práva ──────
  describe("8. ASSIGNEE & PARTICIPANT rozšířená pracovní práva", () => {
    const workerActions: TaskAction[] = [
      "TASK_CHANGE_STATUS",
      "TASK_CHANGE_AREA",
      "TASK_CHANGE_DUE_DATE",
      "TASK_ARCHIVE",
      "TASK_DELETE",
    ];

    for (const action of workerActions) {
      test(`ASSIGNEE (s rolí MEMBER) → ALLOW pro ${action}`, () => {
        const result = checkTaskPermission(
          userActor,
          boardId,
          memberMembership,
          taskWithAssignee,
          relAssignee,
          action,
        );
        assert.equal(result.allowed, true);
      });

      test(`PARTICIPANT (s rolí MEMBER) → ALLOW pro ${action}`, () => {
        const result = checkTaskPermission(
          userActor,
          boardId,
          memberMembership,
          taskWithAssignee,
          relParticipant,
          action,
        );
        assert.equal(result.allowed, true);
      });
    }
  });

  // ── 9. Běžný MEMBER (základní vs zakázané operace) ─────────
  describe("9. Běžný MEMBER", () => {
    describe("Základní týmová práva (povolené)", () => {
      const allowedActions: TaskAction[] = [
        "TASK_VIEW",
        "TASK_CREATE",
        "TASK_EDIT_TITLE",
        "TASK_EDIT_DESCRIPTION",
        "TASK_SET_PRIORITY",
        "TASK_CHANGE_ASSIGNEE",
        "TASK_TAKE_OVER",
      ];

      for (const action of allowedActions) {
        test(`MEMBER → ALLOW pro ${action}`, () => {
          const result = checkTaskPermission(
            userActor,
            boardId,
            memberMembership,
            taskWithAssignee,
            relOrdinaryMember,
            action,
          );
          assert.equal(result.allowed, true);
        });
      }
    });

    describe("Zakázané operace pro běžného člena", () => {
      const forbiddenActions: TaskAction[] = [
        "TASK_CHANGE_STATUS",
        "TASK_CHANGE_AREA",
        "TASK_CHANGE_DUE_DATE",
        "TASK_ARCHIVE",
        "TASK_DELETE",
        "TASK_REMOVE_PARTICIPANT",
      ];

      for (const action of forbiddenActions) {
        test(`běžný MEMBER (není řešitel ani spoluřešitel) → DENY(INSUFFICIENT_ROLE) pro ${action}`, () => {
          const result = checkTaskPermission(
            userActor,
            boardId,
            memberMembership,
            taskWithAssignee,
            relOrdinaryMember,
            action,
          );
          assert.equal(result.allowed, false);
          assert.ok(!result.allowed && result.reason === "INSUFFICIENT_ROLE");
        });
      }
    });
  });

  // ── 10. Tvar AuthorizationResult ────────────────────────────
  describe("10. Tvar AuthorizationResult", () => {
    test("ALLOW výsledek má allowed: true a žádné pole reason", () => {
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        taskWithAssignee,
        relOrdinaryMember,
        "TASK_VIEW",
      );
      assert.equal(result.allowed, true);
      assert.ok(!("reason" in result));
    });

    test("DENY výsledek má allowed: false a pole reason", () => {
      const result = checkTaskPermission(
        userActor,
        boardId,
        memberMembership,
        taskWithAssignee,
        relOrdinaryMember,
        "TASK_DELETE",
      );
      assert.equal(result.allowed, false);
      assert.ok("reason" in result && result.reason === "INSUFFICIENT_ROLE");
    });
  });
});
