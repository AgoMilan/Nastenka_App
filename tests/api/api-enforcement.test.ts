import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  enforceAuthorization,
  executeProtectedOperation,
  type BoardEnforcementTarget,
  type TaskEnforcementTarget,
  type AreaEnforcementTarget,
  type ActorContext,
} from "../../infrastructure/auth/index.ts";
import { POST as testEnforcementRoute } from "../../app/api/test-enforcement/route.ts";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../shared/errors/index.ts";

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

const ownerActor: ActorContext = {
  actor_user_id: actorUserId,
  global_role: "USER",
  session_id: "session-owner",
  is_active: true,
};

const managerActor: ActorContext = {
  actor_user_id: actorUserId,
  global_role: "USER",
  session_id: "session-manager",
  is_active: true,
};

const memberActor: ActorContext = {
  actor_user_id: actorUserId,
  global_role: "USER",
  session_id: "session-member",
  is_active: true,
};

const inactiveActor: ActorContext = {
  actor_user_id: "inactive-uuid",
  global_role: "USER",
  session_id: "session-inactive",
  is_active: false,
};

const ownerMembership = { role: "OWNER" as const };
const managerMembership = { role: "MANAGER" as const };
const memberMembership = { role: "MEMBER" as const };

const relAssignee = { isAssignee: true, isParticipant: false };
const relParticipant = { isAssignee: false, isParticipant: true };
const relOrdinaryMember = { isAssignee: false, isParticipant: false };

const activeBoard = {
  boardId,
  isDeleted: false,
};

const deletedBoard = {
  boardId,
  isDeleted: true,
};

const taskWithAssignee = {
  taskId: "task-uuid-1",
  boardId,
  createdBy: otherUserId,
  assigneeId: otherUserId,
  isBoardDeleted: false,
};

const taskUnassigned = {
  taskId: "task-uuid-unassigned",
  boardId,
  createdBy: actorUserId,
  assigneeId: null,
  isBoardDeleted: false,
};

const activeArea = {
  boardId,
  areaId: "area-uuid-1",
  isBoardDeleted: false,
};

const otherBoardArea = {
  boardId: otherBoardId,
  areaId: "area-uuid-other",
  isBoardDeleted: false,
};

// ─────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────

describe("STEP 17.8D – Server API Enforcement & Testovací Matice", () => {
  // ── A. Authentication (401 Unauthorized) ─────────────────────
  describe("A. Authentication (401 Unauthorized)", () => {
    test("A1: Neautentizovaný request bez session vrací 401 a chráněná operace se nespustí", async () => {
      let operationExecuted = false;

      const mockAuth = {
        api: {
          getSession: async () => null,
        },
      };

      const target: BoardEnforcementTarget = {
        type: "board",
        board: activeBoard,
        membership: memberMembership,
        action: "BOARD_VIEW",
      };

      const response = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { done: true };
        },
        { resolveOptions: { auth: mockAuth as any } },
      );

      assert.equal(response.status, 401);
      assert.equal(
        operationExecuted,
        false,
        "Chráněná operace se nesmí spustit!",
      );

      const body = await response.json();
      assert.equal(body.error.code, "UNAUTHORIZED");
    });

    test("A2: Neplatná session vrací 401 a chráněná operace se nespustí", async () => {
      let operationExecuted = false;

      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relOrdinaryMember,
        action: "TASK_VIEW",
      };

      const response = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { done: true };
        },
        { actor: null }, // simulace neplatné/neexistující session
      );

      assert.equal(response.status, 401);
      assert.equal(operationExecuted, false);

      const body = await response.json();
      assert.equal(body.error.code, "UNAUTHORIZED");
    });

    test("A3: Neaktivní uživatel (is_active: false) vrací 401 a chráněná operace se nespustí", async () => {
      let operationExecuted = false;

      const target: AreaEnforcementTarget = {
        type: "area",
        actorBoardId: boardId,
        membership: memberMembership,
        area: activeArea,
        action: "AREA_VIEW",
      };

      const response = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { done: true };
        },
        { actor: inactiveActor },
      );

      assert.equal(response.status, 401);
      assert.equal(operationExecuted, false);

      const body = await response.json();
      assert.equal(body.error.code, "UNAUTHORIZED");
    });
  });

  // ── B. Board Authorization (403 vs 200) ──────────────────────
  describe("B. Board Authorization Enforcement", () => {
    test("ADMIN → ALLOW (200, operace provedena)", async () => {
      let operationExecuted = false;

      const target: BoardEnforcementTarget = {
        type: "board",
        board: activeBoard,
        membership: null,
        action: "BOARD_DELETE",
      };

      const response = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { boardDeleted: true };
        },
        { actor: adminActor },
      );

      assert.equal(response.status, 200);
      assert.equal(operationExecuted, true);
    });

    test("OWNER → ALLOW pro BOARD_DELETE (200, operace provedena)", async () => {
      let operationExecuted = false;

      const target: BoardEnforcementTarget = {
        type: "board",
        board: activeBoard,
        membership: ownerMembership,
        action: "BOARD_DELETE",
      };

      const response = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { boardDeleted: true };
        },
        { actor: ownerActor },
      );

      assert.equal(response.status, 200);
      assert.equal(operationExecuted, true);
    });

    test("MANAGER → DENY pro BOARD_DELETE (403, operace se nespustí)", async () => {
      let operationExecuted = false;

      const target: BoardEnforcementTarget = {
        type: "board",
        board: activeBoard,
        membership: managerMembership,
        action: "BOARD_DELETE",
      };

      const response = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { boardDeleted: true };
        },
        { actor: managerActor },
      );

      assert.equal(response.status, 403);
      assert.equal(operationExecuted, false);

      const body = await response.json();
      assert.equal(body.error.code, "FORBIDDEN");
      assert.equal(body.error.reason, "INSUFFICIENT_ROLE");
    });

    test("MEMBER → ALLOW pro BOARD_VIEW (200, operace provedena)", async () => {
      let operationExecuted = false;

      const target: BoardEnforcementTarget = {
        type: "board",
        board: activeBoard,
        membership: memberMembership,
        action: "BOARD_VIEW",
      };

      const response = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { view: true };
        },
        { actor: memberActor },
      );

      assert.equal(response.status, 200);
      assert.equal(operationExecuted, true);
    });

    test("MEMBER → DENY pro BOARD_EDIT (403, operace se nespustí)", async () => {
      let operationExecuted = false;

      const target: BoardEnforcementTarget = {
        type: "board",
        board: activeBoard,
        membership: memberMembership,
        action: "BOARD_EDIT",
      };

      const response = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { edited: true };
        },
        { actor: memberActor },
      );

      assert.equal(response.status, 403);
      assert.equal(operationExecuted, false);

      const body = await response.json();
      assert.equal(body.error.code, "FORBIDDEN");
      assert.equal(body.error.reason, "INSUFFICIENT_ROLE");
    });

    test("Uživatel bez membership → DENY (403 NOT_A_MEMBER)", async () => {
      let operationExecuted = false;

      const target: BoardEnforcementTarget = {
        type: "board",
        board: activeBoard,
        membership: null,
        action: "BOARD_VIEW",
      };

      const response = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { view: true };
        },
        { actor: memberActor },
      );

      assert.equal(response.status, 403);
      assert.equal(operationExecuted, false);

      const body = await response.json();
      assert.equal(body.error.code, "FORBIDDEN");
      assert.equal(body.error.reason, "NOT_A_MEMBER");
    });

    test("Soft-deleted board → DENY (403 BOARD_DELETED) i pro ADMIN", async () => {
      let operationExecuted = false;

      const target: BoardEnforcementTarget = {
        type: "board",
        board: deletedBoard,
        membership: null,
        action: "BOARD_VIEW",
      };

      const response = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { view: true };
        },
        { actor: adminActor },
      );

      assert.equal(response.status, 403);
      assert.equal(operationExecuted, false);

      const body = await response.json();
      assert.equal(body.error.code, "FORBIDDEN");
      assert.equal(body.error.reason, "BOARD_DELETED");
    });
  });

  // ── C. Task Authorization Enforcement ────────────────────────
  describe("C. Task Authorization Enforcement", () => {
    test("TASK_VIEW: MEMBER → ALLOW (200)", async () => {
      let operationExecuted = false;
      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relOrdinaryMember,
        action: "TASK_VIEW",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { taskView: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 200);
      assert.equal(operationExecuted, true);
    });

    test("TASK_CREATE: MEMBER → ALLOW (200)", async () => {
      let operationExecuted = false;
      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relOrdinaryMember,
        action: "TASK_CREATE",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { created: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 200);
      assert.equal(operationExecuted, true);
    });

    test("TASK_EDIT_TITLE: MEMBER → ALLOW (200)", async () => {
      let operationExecuted = false;
      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relOrdinaryMember,
        action: "TASK_EDIT_TITLE",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { titleEdited: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 200);
      assert.equal(operationExecuted, true);
    });

    test("TASK_CHANGE_STATUS: ASSIGNEE → ALLOW (200)", async () => {
      let operationExecuted = false;
      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relAssignee,
        action: "TASK_CHANGE_STATUS",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { statusChanged: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 200);
      assert.equal(operationExecuted, true);
    });

    test("TASK_CHANGE_STATUS: běžný MEMBER → DENY (403, operace se nespustí)", async () => {
      let operationExecuted = false;
      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relOrdinaryMember,
        action: "TASK_CHANGE_STATUS",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { statusChanged: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 403);
      assert.equal(operationExecuted, false);

      const body = await res.json();
      assert.equal(body.error.reason, "INSUFFICIENT_ROLE");
    });

    test("TASK_CHANGE_ASSIGNEE: MEMBER → ALLOW (200)", async () => {
      let operationExecuted = false;
      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relOrdinaryMember,
        action: "TASK_CHANGE_ASSIGNEE",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { assigneeChanged: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 200);
      assert.equal(operationExecuted, true);
    });

    test("TASK_TAKE_OVER: MEMBER → ALLOW (200)", async () => {
      let operationExecuted = false;
      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relOrdinaryMember,
        action: "TASK_TAKE_OVER",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { takenOver: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 200);
      assert.equal(operationExecuted, true);
    });

    test("TASK_DELETE: ASSIGNEE, MANAGER a OWNER → ALLOW (200)", async () => {
      // ASSIGNEE
      const targetAssignee: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relAssignee,
        action: "TASK_DELETE",
      };
      const resAssignee = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        targetAssignee,
        () => ({ deleted: true }),
        { actor: memberActor },
      );
      assert.equal(resAssignee.status, 200);

      // MANAGER
      const targetManager: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: managerMembership,
        task: taskWithAssignee,
        taskRel: relOrdinaryMember,
        action: "TASK_DELETE",
      };
      const resManager = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        targetManager,
        () => ({ deleted: true }),
        { actor: managerActor },
      );
      assert.equal(resManager.status, 200);

      // OWNER
      const targetOwner: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: ownerMembership,
        task: taskWithAssignee,
        taskRel: relOrdinaryMember,
        action: "TASK_DELETE",
      };
      const resOwner = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        targetOwner,
        () => ({ deleted: true }),
        { actor: ownerActor },
      );
      assert.equal(resOwner.status, 200);
    });

    test("TASK_ARCHIVE: ASSIGNEE → ALLOW (200), běžný MEMBER → DENY (403)", async () => {
      const targetAllowed: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relAssignee,
        action: "TASK_ARCHIVE",
      };
      const resAllowed = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        targetAllowed,
        () => ({ archived: true }),
        { actor: memberActor },
      );
      assert.equal(resAllowed.status, 200);

      let operationExecuted = false;
      const targetDenied: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskWithAssignee,
        taskRel: relOrdinaryMember,
        action: "TASK_ARCHIVE",
      };
      const resDenied = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        targetDenied,
        () => {
          operationExecuted = true;
          return { archived: true };
        },
        { actor: memberActor },
      );
      assert.equal(resDenied.status, 403);
      assert.equal(operationExecuted, false);
    });

    test("TASK_JOIN_AS_PARTICIPANT: úkol bez assignee → DENY (403 TASK_HAS_NO_ASSIGNEE)", async () => {
      let operationExecuted = false;
      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: taskUnassigned,
        taskRel: relOrdinaryMember,
        action: "TASK_JOIN_AS_PARTICIPANT",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { joined: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 403);
      assert.equal(operationExecuted, false);

      const body = await res.json();
      assert.equal(body.error.reason, "TASK_HAS_NO_ASSIGNEE");
    });

    test("TASK_LEAVE_AS_PARTICIPANT: pokus odpojit jiného uživatele → DENY (403 CANNOT_LEAVE_OTHER_PARTICIPANT)", async () => {
      let operationExecuted = false;
      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: {
          ...taskWithAssignee,
          targetUserId: otherUserId,
        },
        taskRel: relParticipant,
        action: "TASK_LEAVE_AS_PARTICIPANT",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { left: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 403);
      assert.equal(operationExecuted, false);

      const body = await res.json();
      assert.equal(body.error.reason, "CANNOT_LEAVE_OTHER_PARTICIPANT");
    });

    test("Cross-board task → DENY (403 CROSS_BOARD_ACCESS)", async () => {
      let operationExecuted = false;
      const target: TaskEnforcementTarget = {
        type: "task",
        actorBoardId: boardId,
        membership: memberMembership,
        task: {
          ...taskWithAssignee,
          boardId: otherBoardId,
        },
        taskRel: relOrdinaryMember,
        action: "TASK_VIEW",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { view: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 403);
      assert.equal(operationExecuted, false);

      const body = await res.json();
      assert.equal(body.error.reason, "CROSS_BOARD_ACCESS");
    });
  });

  // ── D. Area Authorization Enforcement ────────────────────────
  describe("D. Area Authorization Enforcement", () => {
    test("AREA_VIEW: MEMBER → ALLOW (200)", async () => {
      let operationExecuted = false;
      const target: AreaEnforcementTarget = {
        type: "area",
        actorBoardId: boardId,
        membership: memberMembership,
        area: activeArea,
        action: "AREA_VIEW",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { view: true };
        },
        { actor: memberActor },
      );

      assert.equal(res.status, 200);
      assert.equal(operationExecuted, true);
    });

    test("AREA_CREATE: OWNER a MANAGER → ALLOW (200), MEMBER → DENY (403)", async () => {
      const target: AreaEnforcementTarget = {
        type: "area",
        actorBoardId: boardId,
        membership: ownerMembership,
        area: activeArea,
        action: "AREA_CREATE",
      };
      const resOwner = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => ({ created: true }),
        { actor: ownerActor },
      );
      assert.equal(resOwner.status, 200);

      const resManager = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        { ...target, membership: managerMembership },
        () => ({ created: true }),
        { actor: managerActor },
      );
      assert.equal(resManager.status, 200);

      let operationExecuted = false;
      const resMember = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        { ...target, membership: memberMembership },
        () => {
          operationExecuted = true;
          return { created: true };
        },
        { actor: memberActor },
      );
      assert.equal(resMember.status, 403);
      assert.equal(operationExecuted, false);
    });

    test("AREA_EDIT: OWNER a MANAGER → ALLOW (200), MEMBER → DENY (403)", async () => {
      const target: AreaEnforcementTarget = {
        type: "area",
        actorBoardId: boardId,
        membership: managerMembership,
        area: activeArea,
        action: "AREA_EDIT",
      };
      const resManager = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => ({ edited: true }),
        { actor: managerActor },
      );
      assert.equal(resManager.status, 200);

      let operationExecuted = false;
      const resMember = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        { ...target, membership: memberMembership },
        () => {
          operationExecuted = true;
          return { edited: true };
        },
        { actor: memberActor },
      );
      assert.equal(resMember.status, 403);
      assert.equal(operationExecuted, false);
    });

    test("AREA_DELETE: OWNER a MANAGER → ALLOW (200), MEMBER → DENY (403)", async () => {
      const target: AreaEnforcementTarget = {
        type: "area",
        actorBoardId: boardId,
        membership: managerMembership,
        area: activeArea,
        action: "AREA_DELETE",
      };
      const resManager = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => ({ deleted: true }),
        { actor: managerActor },
      );
      assert.equal(resManager.status, 200);

      let operationExecuted = false;
      const resMember = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        { ...target, membership: memberMembership },
        () => {
          operationExecuted = true;
          return { deleted: true };
        },
        { actor: memberActor },
      );
      assert.equal(resMember.status, 403);
      assert.equal(operationExecuted, false);
    });

    test("ADMIN → ALLOW pro všechny Area akce", async () => {
      const actions = [
        "AREA_VIEW",
        "AREA_CREATE",
        "AREA_EDIT",
        "AREA_DELETE",
      ] as const;
      for (const action of actions) {
        const target: AreaEnforcementTarget = {
          type: "area",
          actorBoardId: boardId,
          membership: null,
          area: activeArea,
          action,
        };
        const res = await executeProtectedOperation(
          new Request("http://localhost:3000/api/test-enforcement"),
          target,
          () => ({ success: true }),
          { actor: adminActor },
        );
        assert.equal(res.status, 200);
      }
    });

    test("Cross-board area → DENY (403 CROSS_BOARD_ACCESS)", async () => {
      let operationExecuted = false;
      const target: AreaEnforcementTarget = {
        type: "area",
        actorBoardId: boardId,
        membership: ownerMembership,
        area: otherBoardArea,
        action: "AREA_EDIT",
      };

      const res = await executeProtectedOperation(
        new Request("http://localhost:3000/api/test-enforcement"),
        target,
        () => {
          operationExecuted = true;
          return { edited: true };
        },
        { actor: ownerActor },
      );

      assert.equal(res.status, 403);
      assert.equal(operationExecuted, false);

      const body = await res.json();
      assert.equal(body.error.reason, "CROSS_BOARD_ACCESS");
    });
  });

  // ── E. UI Bypass Test ────────────────────────────────────────
  describe("E. UI Bypass Test (přímé HTTP volání endpointu)", () => {
    test("MEMBER pošle přímý HTTP POST na TASK_DELETE (UI tlačítko skryto) → server vrátí 403", async () => {
      const payload = {
        target: {
          type: "task",
          actorBoardId: boardId,
          membership: memberMembership,
          task: taskWithAssignee,
          taskRel: relOrdinaryMember,
          action: "TASK_DELETE",
        },
        options: {
          actor: memberActor,
        },
      };

      const req = new Request("http://localhost:3000/api/test-enforcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const response = await testEnforcementRoute(req);
      assert.equal(response.status, 403);

      const body = await response.json();
      assert.equal(body.error.code, "FORBIDDEN");
      assert.equal(body.error.reason, "INSUFFICIENT_ROLE");
    });

    test("MEMBER pošle přímý HTTP POST na BOARD_DELETE → server vrátí 403", async () => {
      const payload = {
        target: {
          type: "board",
          board: activeBoard,
          membership: memberMembership,
          action: "BOARD_DELETE",
        },
        options: {
          actor: memberActor,
        },
      };

      const req = new Request("http://localhost:3000/api/test-enforcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const response = await testEnforcementRoute(req);
      assert.equal(response.status, 403);

      const body = await response.json();
      assert.equal(body.error.code, "FORBIDDEN");
      assert.equal(body.error.reason, "INSUFFICIENT_ROLE");
    });

    test("MEMBER pošle přímý HTTP POST na AREA_DELETE → server vrátí 403", async () => {
      const payload = {
        target: {
          type: "area",
          actorBoardId: boardId,
          membership: memberMembership,
          area: activeArea,
          action: "AREA_DELETE",
        },
        options: {
          actor: memberActor,
        },
      };

      const req = new Request("http://localhost:3000/api/test-enforcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const response = await testEnforcementRoute(req);
      assert.equal(response.status, 403);

      const body = await response.json();
      assert.equal(body.error.code, "FORBIDDEN");
      assert.equal(body.error.reason, "INSUFFICIENT_ROLE");
    });

    test("Neautentizovaný uživatel pošle přímý HTTP POST na endpoint → server vrátí 401", async () => {
      const payload = {
        target: {
          type: "task",
          actorBoardId: boardId,
          membership: memberMembership,
          task: taskWithAssignee,
          taskRel: relOrdinaryMember,
          action: "TASK_VIEW",
        },
        options: {
          actor: null,
        },
      };

      const req = new Request("http://localhost:3000/api/test-enforcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const response = await testEnforcementRoute(req);
      assert.equal(response.status, 401);

      const body = await response.json();
      assert.equal(body.error.code, "UNAUTHORIZED");
    });

    test("Oprávněný OWNER pošle platný HTTP POST na endpoint → server vrátí 200 a operace se provede", async () => {
      const payload = {
        target: {
          type: "board",
          board: activeBoard,
          membership: ownerMembership,
          action: "BOARD_EDIT",
        },
        options: {
          actor: ownerActor,
        },
      };

      const req = new Request("http://localhost:3000/api/test-enforcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const response = await testEnforcementRoute(req);
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.equal(body.success, true);
      assert.equal(body.data.executed, true);
      assert.equal(body.data.action, "BOARD_EDIT");
    });
  });

  // ── F. Reusable enforceAuthorization API ─────────────────────
  describe("F. Čistá enforceAuthorization funkce", () => {
    test("vrací err(AuthenticationError) pro null actor", () => {
      const result = enforceAuthorization(null, {
        type: "board",
        board: activeBoard,
        membership: memberMembership,
        action: "BOARD_VIEW",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthenticationError);
        assert.equal(result.error.statusCode, 401);
      }
    });

    test("vrací err(AuthorizationError) pro nepovolenou akci", () => {
      const result = enforceAuthorization(memberActor, {
        type: "board",
        board: activeBoard,
        membership: memberMembership,
        action: "BOARD_DELETE",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthorizationError);
        assert.equal(result.error.statusCode, 403);
        assert.equal(result.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("vrací ok(actor) pro povolenou akci", () => {
      const result = enforceAuthorization(ownerActor, {
        type: "board",
        board: activeBoard,
        membership: ownerMembership,
        action: "BOARD_DELETE",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.actor_user_id, actorUserId);
      }
    });
  });
});
