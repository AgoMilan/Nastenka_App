import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type {
  BoardRecord,
  BoardRepository,
  MembershipRecord,
  MembershipRepository,
  UserRecord,
  UserRepository,
} from "../../modules/boards/application/ports/index.ts";
import type {
  TaskRecord,
  TaskRepository,
  TaskParticipantRepository,
  TaskParticipantRecord,
} from "../../modules/tasks/application/ports/index.ts";
import type {
  AuditLogRecord,
  AuditLogRepository,
  AuditQueryOptions,
  CreateAuditLogData,
} from "../../modules/audit/application/ports/audit-log-repository.port.ts";
import {
  GetTaskAuditHistoryUseCase,
  GetBoardAuditHistoryUseCase,
  formatAuditEvent,
  AUDIT_EVENTS,
  type AuditLogView,
} from "../../modules/audit/index.ts";
import {
  getTaskAuditHistorySchema,
  getBoardAuditHistorySchema,
} from "../../modules/audit/api/dto/audit-query.dto.ts";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// Testovací In-Memory Repozitáře
// ─────────────────────────────────────────────────────────────

class InMemoryBoardRepository implements BoardRepository {
  public store = new Map<string, BoardRecord>();

  async findById(id: string): Promise<BoardRecord | null> {
    const r = this.store.get(id);
    return r ? { ...r } : null;
  }
  async findByIdForUpdate(id: string): Promise<BoardRecord | null> {
    return this.findById(id);
  }
  async create(data: { name: string; description?: string | null; createdBy: string }): Promise<BoardRecord> {
    const r: BoardRecord = {
      id: `board-${this.store.size + 1}`,
      name: data.name,
      description: data.description ?? null,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    this.store.set(r.id, r);
    return { ...r };
  }
  async update(boardId: string, data: { name?: string; description?: string | null }): Promise<BoardRecord> {
    const existing = this.store.get(boardId);
    if (!existing) throw new Error("Board not found");
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.store.set(boardId, updated);
    return { ...updated };
  }
  async softDelete(boardId: string, deletedAt: Date): Promise<void> {
    const r = this.store.get(boardId);
    if (r) this.store.set(boardId, { ...r, deletedAt });
  }
  async findActiveBoardsForUser(): Promise<any[]> {
    return [];
  }
  async findActiveBoardsForAdmin(): Promise<any[]> {
    return [];
  }
}

class InMemoryMembershipRepository implements MembershipRepository {
  public store: MembershipRecord[] = [];

  async findByBoardAndUser(boardId: string, userId: string): Promise<MembershipRecord | null> {
    const found = this.store.find((m) => m.boardId === boardId && m.userId === userId);
    return found ? { ...found } : null;
  }
  async findMembershipsByBoard(boardId: string): Promise<MembershipRecord[]> {
    return this.store.filter((m) => m.boardId === boardId);
  }
  async create(data: { boardId: string; userId: string; role: "OWNER" | "MANAGER" | "MEMBER" }): Promise<MembershipRecord> {
    const r: MembershipRecord = {
      id: `m-${this.store.length + 1}`,
      boardId: data.boardId,
      userId: data.userId,
      role: data.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.push(r);
    return { ...r };
  }
  async updateRole(boardId: string, userId: string, role: "OWNER" | "MANAGER" | "MEMBER"): Promise<void> {
    const idx = this.store.findIndex((m) => m.boardId === boardId && m.userId === userId);
    if (idx === -1) throw new Error("Membership not found");
    this.store[idx] = { ...this.store[idx], role, updatedAt: new Date() };
  }
  async delete(boardId: string, userId: string): Promise<void> {
    this.store = this.store.filter((m) => !(m.boardId === boardId && m.userId === userId));
  }
}

class InMemoryUserRepository implements UserRepository {
  public store = new Map<string, UserRecord>();

  async findById(id: string): Promise<UserRecord | null> {
    const u = this.store.get(id);
    return u ? { ...u } : null;
  }
  async findByIds(ids: string[]): Promise<UserRecord[]> {
    return ids.map((id) => this.store.get(id)).filter((u): u is UserRecord => u !== undefined);
  }
  async findByEmail(email: string): Promise<UserRecord | null> {
    for (const u of this.store.values()) {
      if (u.email === email) return { ...u };
    }
    return null;
  }
  async findActiveById(id: string): Promise<UserRecord | null> {
    const u = this.store.get(id);
    return u && u.isActive && !u.deletedAt ? { ...u } : null;
  }
  async findAllActive(): Promise<UserRecord[]> {
    return Array.from(this.store.values()).filter((u) => u.isActive && !u.deletedAt);
  }
  async findActiveUsers(): Promise<UserRecord[]> {
    return this.findAllActive();
  }
}

class InMemoryTaskRepository implements TaskRepository {
  public store = new Map<string, TaskRecord>();

  async findById(id: string): Promise<TaskRecord | null> {
    const t = this.store.get(id);
    return t ? { ...t } : null;
  }
  async findByIdForUpdate(id: string): Promise<TaskRecord | null> {
    return this.findById(id);
  }
  async findByBoardId(boardId: string): Promise<TaskRecord[]> {
    return Array.from(this.store.values()).filter((t) => t.boardId === boardId);
  }
  async findByAreaId(): Promise<TaskRecord[]> {
    return [];
  }
  async findUserTasksAcrossBoards(): Promise<TaskRecord[]> {
    return [];
  }
  async create(data: any): Promise<TaskRecord> {
    const r: TaskRecord = {
      id: `task-${this.store.size + 1}`,
      boardId: data.boardId,
      areaId: data.areaId ?? null,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "NOVÉ",
      priority: data.priority ?? "BĚŽNÁ",
      dueDate: data.dueDate ?? null,
      createdBy: data.createdBy,
      assigneeId: data.assigneeId ?? null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(r.id, r);
    return { ...r };
  }
  async update(taskId: string, data: any): Promise<TaskRecord> {
    const existing = this.store.get(taskId);
    if (!existing) throw new Error("Task not found");
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.store.set(taskId, updated);
    return { ...updated };
  }
  async delete(taskId: string): Promise<void> {
    this.store.delete(taskId);
  }
}

class InMemoryTaskParticipantRepository implements TaskParticipantRepository {
  public store: TaskParticipantRecord[] = [];

  async findByTaskId(taskId: string): Promise<TaskParticipantRecord[]> {
    return this.store.filter((p) => p.taskId === taskId);
  }
  async findByTaskIds(taskIds: string[]): Promise<TaskParticipantRecord[]> {
    return this.store.filter((p) => taskIds.includes(p.taskId));
  }
  async findByTaskAndUser(taskId: string, userId: string): Promise<TaskParticipantRecord | null> {
    const found = this.store.find((p) => p.taskId === taskId && p.userId === userId);
    return found ? { ...found } : null;
  }
  async add(taskId: string, userId: string, role = "PARTICIPANT"): Promise<TaskParticipantRecord> {
    const r: TaskParticipantRecord = {
      id: `tp-${this.store.length + 1}`,
      taskId,
      userId,
      role,
      createdAt: new Date(),
    };
    this.store.push(r);
    return { ...r };
  }
  async addParticipant(taskId: string, userId: string, role = "PARTICIPANT"): Promise<TaskParticipantRecord> {
    return this.add(taskId, userId, role);
  }
  async remove(taskId: string, userId: string): Promise<void> {
    this.store = this.store.filter((p) => !(p.taskId === taskId && p.userId === userId));
  }
  async removeParticipant(taskId: string, userId: string): Promise<void> {
    return this.remove(taskId, userId);
  }
  async removeAllByTaskId(taskId: string): Promise<void> {
    this.store = this.store.filter((p) => p.taskId !== taskId);
  }
  async removeAllForTask(taskId: string): Promise<void> {
    return this.removeAllByTaskId(taskId);
  }
}

class InMemoryAuditLogRepository implements AuditLogRepository {
  public store: AuditLogRecord[] = [];

  async log(data: CreateAuditLogData): Promise<AuditLogRecord> {
    const record: AuditLogRecord = {
      id: `audit-${this.store.length + 1}`,
      actorUserId: data.actorUserId,
      timestamp: data.timestamp ?? new Date(),
      boardId: data.boardId,
      operation: data.operation,
      targetId: data.targetId,
      previousState: (data.previousState as Record<string, unknown> | null) ?? null,
      newState: (data.newState as Record<string, unknown> | null) ?? null,
      metadata: (data.metadata as Record<string, unknown> | null) ?? null,
    };
    this.store.push(record);
    return record;
  }

  async findByBoardId(boardId: string, options?: AuditQueryOptions): Promise<AuditLogRecord[]> {
    const list = this.store
      .filter((r) => r.boardId === boardId)
      .slice()
      .reverse();
    return options?.limit ? list.slice(0, options.limit) : list;
  }

  async findByTaskId(boardId: string, taskId: string, options?: AuditQueryOptions): Promise<AuditLogRecord[]> {
    const list = this.store
      .filter(
        (r) =>
          r.boardId === boardId &&
          (r.targetId === taskId ||
            r.newState?.taskId === taskId ||
            r.previousState?.taskId === taskId),
      )
      .slice()
      .reverse();
    return options?.limit ? list.slice(0, options.limit) : list;
  }
}

// ─────────────────────────────────────────────────────────────
// Testovací suita: STEP 9B-UI – Audit Trail UI
// ─────────────────────────────────────────────────────────────

describe("STEP 9B-UI – Audit Trail UI", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let taskRepo: InMemoryTaskRepository;
  let participantRepo: InMemoryTaskParticipantRepository;
  let auditRepo: InMemoryAuditLogRepository;

  const aliceActor: ActorContext = {
    actor_user_id: "user-alice",
    global_role: "USER",
    session_id: "session-alice",
    is_active: true,
  };

  const bobActor: ActorContext = {
    actor_user_id: "user-bob",
    global_role: "USER",
    session_id: "session-bob",
    is_active: true,
  };

  const charlieActor: ActorContext = {
    actor_user_id: "user-charlie",
    global_role: "USER",
    session_id: "session-charlie",
    is_active: true,
  };

  const adminActor: ActorContext = {
    actor_user_id: "user-admin",
    global_role: "ADMIN",
    session_id: "session-admin",
    is_active: true,
  };

  let testBoard: BoardRecord;
  let testTask: TaskRecord;

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    taskRepo = new InMemoryTaskRepository();
    participantRepo = new InMemoryTaskParticipantRepository();
    auditRepo = new InMemoryAuditLogRepository();

    // Uživatelé
    userRepo.store.set("user-alice", {
      id: "user-alice",
      email: "alice@test.cz",
      name: "Alice Veselá",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });

    userRepo.store.set("user-bob", {
      id: "user-bob",
      email: "bob@test.cz",
      name: "Bob Novák",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });

    userRepo.store.set("user-admin", {
      id: "user-admin",
      email: "admin@test.cz",
      name: "Správce Systému",
      globalRole: "ADMIN",
      isActive: true,
      deletedAt: null,
    });

    // Vytvoření testovacího boardu a členství
    testBoard = await boardRepo.create({
      name: "Vývojový Board",
      description: "Projektový board pro testy",
      createdBy: "user-alice",
    });

    await membershipRepo.create({
      boardId: testBoard.id,
      userId: "user-alice",
      role: "OWNER",
    });

    await membershipRepo.create({
      boardId: testBoard.id,
      userId: "user-bob",
      role: "MEMBER",
    });

    // Vytvoření testovacího úkolu
    testTask = await taskRepo.create({
      boardId: testBoard.id,
      title: "Implementovat Audit UI",
      description: "Tajný text popisu úkolu",
      createdBy: "user-alice",
    });
  });

  // ───────────────────────────────────────────────────────────
  // 1. GetTaskAuditHistoryUseCase
  // ───────────────────────────────────────────────────────────
  describe("1. GetTaskAuditHistoryUseCase", () => {
    let useCase: GetTaskAuditHistoryUseCase;

    beforeEach(() => {
      useCase = new GetTaskAuditHistoryUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        auditRepo,
        userRepo,
        participantRepo,
      );
    });

    test("odmítne neautentizovaného nebo neaktivního volajícího", async () => {
      const resUnauth = await useCase.execute(null, {
        boardId: testBoard.id,
        taskId: testTask.id,
      });
      assert.equal(resUnauth.success, false);
      assert.ok(resUnauth.error instanceof AuthenticationError);

      const resInactive = await useCase.execute(
        { ...aliceActor, is_active: false },
        { boardId: testBoard.id, taskId: testTask.id },
      );
      assert.equal(resInactive.success, false);
      assert.ok(resInactive.error instanceof AuthenticationError);
    });

    test("odmítne neplatný nebo prázdný vstup", async () => {
      const res1 = await useCase.execute(aliceActor, {
        boardId: "",
        taskId: testTask.id,
      });
      assert.equal(res1.success, false);
      assert.ok(res1.error instanceof ValidationError);

      const res2 = await useCase.execute(aliceActor, {
        boardId: testBoard.id,
        taskId: "   ",
      });
      assert.equal(res2.success, false);
      assert.ok(res2.error instanceof ValidationError);
    });

    test("odmítne neexistující nebo smazanou nástěnku", async () => {
      const resNonExistent = await useCase.execute(aliceActor, {
        boardId: "non-existent-board",
        taskId: testTask.id,
      });
      assert.equal(resNonExistent.success, false);
      assert.ok(resNonExistent.error instanceof NotFoundError);

      await boardRepo.softDelete(testBoard.id, new Date());
      const resDeleted = await useCase.execute(aliceActor, {
        boardId: testBoard.id,
        taskId: testTask.id,
      });
      assert.equal(resDeleted.success, false);
      assert.ok(resDeleted.error instanceof NotFoundError);
    });

    test("odmítne neexistující úkol", async () => {
      const res = await useCase.execute(aliceActor, {
        boardId: testBoard.id,
        taskId: "non-existent-task",
      });
      assert.equal(res.success, false);
      assert.ok(res.error instanceof NotFoundError);
    });

    test("odmítne cross-board přístup (úkol z jiné nástěnky)", async () => {
      const otherBoard = await boardRepo.create({
        name: "Jiná nástěnka",
        createdBy: "user-alice",
      });
      const res = await useCase.execute(aliceActor, {
        boardId: otherBoard.id,
        taskId: testTask.id,
      });
      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
      assert.equal(res.error.reason, "CROSS_BOARD_ACCESS");
    });

    test("odmítne nečlena nástěnky", async () => {
      const res = await useCase.execute(charlieActor, {
        boardId: testBoard.id,
        taskId: testTask.id,
      });
      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
    });

    test("povolí členovi nástěnky (MEMBER i OWNER) zobrazit historii úkolu", async () => {
      await auditRepo.log({
        actorUserId: "user-alice",
        boardId: testBoard.id,
        operation: "TASK_CREATED",
        targetId: testTask.id,
        newState: { title: testTask.title },
      });

      const resBob = await useCase.execute(bobActor, {
        boardId: testBoard.id,
        taskId: testTask.id,
      });
      assert.equal(resBob.success, true);
      assert.equal(resBob.data.length, 1);
      assert.equal(resBob.data[0].operation, "TASK_CREATED");
      assert.equal(resBob.data[0].actor.name, "Alice Veselá");

      const resAlice = await useCase.execute(aliceActor, {
        boardId: testBoard.id,
        taskId: testTask.id,
      });
      assert.equal(resAlice.success, true);
      assert.equal(resAlice.data.length, 1);
    });

    test("povolí ADMINovi zobrazit historii úkolu i bez přímého členství", async () => {
      await auditRepo.log({
        actorUserId: "user-alice",
        boardId: testBoard.id,
        operation: "TASK_CREATED",
        targetId: testTask.id,
        newState: { title: testTask.title },
      });

      const resAdmin = await useCase.execute(adminActor, {
        boardId: testBoard.id,
        taskId: testTask.id,
      });
      assert.equal(resAdmin.success, true);
      assert.equal(resAdmin.data.length, 1);
    });

    test("povolí zobrazení historie archivovaného úkolu", async () => {
      await taskRepo.update(testTask.id, { status: "ARCHIVOVÁNO" });
      await auditRepo.log({
        actorUserId: "user-alice",
        boardId: testBoard.id,
        operation: "TASK_ARCHIVED",
        targetId: testTask.id,
      });

      const res = await useCase.execute(bobActor, {
        boardId: testBoard.id,
        taskId: testTask.id,
      });
      assert.equal(res.success, true);
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].operation, "TASK_ARCHIVED");
    });

    test("respektuje zadaný limit dotazu", async () => {
      for (let i = 1; i <= 5; i++) {
        await auditRepo.log({
          actorUserId: "user-alice",
          boardId: testBoard.id,
          operation: "TASK_TITLE_CHANGED",
          targetId: testTask.id,
          newState: { title: `Titulek ${i}` },
        });
      }

      const resLimit = await useCase.execute(bobActor, {
        boardId: testBoard.id,
        taskId: testTask.id,
        limit: 2,
      });
      assert.equal(resLimit.success, true);
      assert.equal(resLimit.data.length, 2);
    });

    test("zahrnuje i události komentářů vázaných na daný úkol", async () => {
      await auditRepo.log({
        actorUserId: "user-bob",
        boardId: testBoard.id,
        operation: "TASK_COMMENT_CREATED",
        targetId: "comment-1",
        newState: { taskId: testTask.id },
      });

      const res = await useCase.execute(aliceActor, {
        boardId: testBoard.id,
        taskId: testTask.id,
      });
      assert.equal(res.success, true);
      assert.equal(res.data.length, 1);
      assert.equal(res.data[0].operation, "TASK_COMMENT_CREATED");
      assert.equal(res.data[0].actor.name, "Bob Novák");
    });

    test("dávkově mapuje jména aktérů s bezpečným fallbackem", async () => {
      await auditRepo.log({
        actorUserId: "user-unknown",
        boardId: testBoard.id,
        operation: "TASK_TITLE_CHANGED",
        targetId: testTask.id,
      });

      const res = await useCase.execute(aliceActor, {
        boardId: testBoard.id,
        taskId: testTask.id,
      });
      assert.equal(res.success, true);
      assert.equal(res.data[0].actor.name, "Uživatel");
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. GetBoardAuditHistoryUseCase
  // ───────────────────────────────────────────────────────────
  describe("2. GetBoardAuditHistoryUseCase", () => {
    let useCase: GetBoardAuditHistoryUseCase;

    beforeEach(() => {
      useCase = new GetBoardAuditHistoryUseCase(
        boardRepo,
        membershipRepo,
        auditRepo,
        userRepo,
      );
    });

    test("odmítne neautentizovaného volajícího", async () => {
      const res = await useCase.execute(null, { boardId: testBoard.id });
      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthenticationError);
    });

    test("odmítne neplatné ID nástěnky", async () => {
      const res = await useCase.execute(aliceActor, { boardId: "" });
      assert.equal(res.success, false);
      assert.ok(res.error instanceof ValidationError);
    });

    test("odmítne neexistující nebo smazanou nástěnku", async () => {
      const res1 = await useCase.execute(aliceActor, { boardId: "unknown-board" });
      assert.equal(res1.success, false);
      assert.ok(res1.error instanceof NotFoundError);

      await boardRepo.softDelete(testBoard.id, new Date());
      const res2 = await useCase.execute(aliceActor, { boardId: testBoard.id });
      assert.equal(res2.success, false);
      assert.ok(res2.error instanceof NotFoundError);
    });

    test("odmítne nečlena nástěnky", async () => {
      const res = await useCase.execute(charlieActor, { boardId: testBoard.id });
      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
    });

    test("povolí členovi i ADMINovi načíst historii nástěnky", async () => {
      await auditRepo.log({
        actorUserId: "user-alice",
        boardId: testBoard.id,
        operation: "BOARD_CREATED",
        targetId: testBoard.id,
        newState: { name: testBoard.name },
      });

      const resBob = await useCase.execute(bobActor, { boardId: testBoard.id });
      assert.equal(resBob.success, true);
      assert.equal(resBob.data.length, 1);
      assert.equal(resBob.data[0].operation, "BOARD_CREATED");

      const resAdmin = await useCase.execute(adminActor, { boardId: testBoard.id });
      assert.equal(resAdmin.success, true);
      assert.equal(resAdmin.data.length, 1);
    });

    test("respektuje limit a seřazení", async () => {
      for (let i = 1; i <= 4; i++) {
        await auditRepo.log({
          actorUserId: "user-alice",
          boardId: testBoard.id,
          operation: "AREA_CREATED",
          targetId: `area-${i}`,
          newState: { name: `Oblast ${i}` },
        });
      }

      const res = await useCase.execute(aliceActor, { boardId: testBoard.id, limit: 2 });
      assert.equal(res.success, true);
      assert.equal(res.data.length, 2);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. formatAuditEvent Presenter & Privacy Policy
  // ───────────────────────────────────────────────────────────
  describe("3. formatAuditEvent Presenter & Privacy Policy", () => {
    function createMockLog(
      operation: string,
      prev?: Record<string, unknown> | null,
      next?: Record<string, unknown> | null,
    ): AuditLogView {
      return {
        id: "mock-log",
        actor: { id: "user-1", name: "Jan Tester" },
        timestamp: new Date("2026-10-06T12:00:00Z"),
        boardId: "board-1",
        operation,
        targetId: "target-1",
        previousState: prev ?? null,
        newState: next ?? null,
        metadata: null,
      };
    }

    test("pokrývá všech 25 událostí z AUDIT_EVENTS s českými texty", () => {
      for (const event of AUDIT_EVENTS) {
        const formatted = formatAuditEvent(createMockLog(event));
        assert.ok(formatted.title.length > 0, `Event ${event} must have a non-empty title`);
        assert.ok(formatted.description.length > 0, `Event ${event} must have a non-empty description`);
      }
    });

    test("PRIVACY RULE: TASK_DESCRIPTION_CHANGED nesmí nikdy odhalit text popisu", () => {
      const sensitiveDescription = "Tajné heslo a citlivý interní plán";
      const log = createMockLog(
        "TASK_DESCRIPTION_CHANGED",
        { hasDescription: true, description: sensitiveDescription },
        { hasDescription: true, description: sensitiveDescription },
      );
      const formatted = formatAuditEvent(log);

      assert.equal(formatted.title, "Změna popisu úkolu");
      assert.equal(formatted.description.includes(sensitiveDescription), false);
      assert.equal(JSON.stringify(formatted).includes(sensitiveDescription), false);
    });

    test("PRIVACY RULE: Komentáře (TASK_COMMENT_*) nesmí nikdy odhalit obsah textu", () => {
      const sensitiveComment = "Důvěrný klientský komentář";
      const logCreated = createMockLog("TASK_COMMENT_CREATED", null, { taskId: "t1", content: sensitiveComment });
      const logEdited = createMockLog("TASK_COMMENT_EDITED", { taskId: "t1" }, { taskId: "t1", content: sensitiveComment });
      const logDeleted = createMockLog("TASK_COMMENT_DELETED", { taskId: "t1", content: sensitiveComment }, null);

      for (const log of [logCreated, logEdited, logDeleted]) {
        const formatted = formatAuditEvent(log);
        assert.equal(JSON.stringify(formatted).includes(sensitiveComment), false);
      }
    });

    test("správně formátuje změny stavu, priority a termínu", () => {
      const statusLog = createMockLog("TASK_STATUS_CHANGED", { status: "NOVÉ" }, { status: "ROZPRACOVANÉ" });
      const formattedStatus = formatAuditEvent(statusLog);
      assert.equal(formattedStatus.title, "Změna stavu");
      assert.ok(formattedStatus.description.includes("NOVÉ → ROZPRACOVANÉ"));

      const priLog = createMockLog("TASK_PRIORITY_CHANGED", { priority: "BĚŽNÁ" }, { priority: "SPĚCHÁ" });
      const formattedPri = formatAuditEvent(priLog);
      assert.equal(formattedPri.title, "Změna priority");
      assert.ok(formattedPri.description.includes("BĚŽNÁ → SPĚCHÁ"));

      const dueLog = createMockLog(
        "TASK_DUE_DATE_CHANGED",
        null,
        { dueDate: "2026-12-31T00:00:00.000Z" },
      );
      const formattedDue = formatAuditEvent(dueLog);
      assert.equal(formattedDue.title, "Změna termínu");
      assert.ok(formattedDue.description.includes("Termín splnění byl nastaven na"));
    });

    test("správně formátuje operace členství a rolí", () => {
      const roleLog = createMockLog(
        "MEMBER_ROLE_CHANGED",
        { role: "MEMBER" },
        { role: "MANAGER" },
      );
      const formattedRole = formatAuditEvent(roleLog);
      assert.equal(formattedRole.title, "Změna role člena");
      assert.ok(formattedRole.description.includes("MEMBER na MANAGER"));
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. Validační schémata pro dotazování (DTO)
  // ───────────────────────────────────────────────────────────
  describe("4. Validační schémata dotazů (DTO)", () => {
    test("getTaskAuditHistorySchema validuje boardId i taskId", () => {
      const valid = getTaskAuditHistorySchema.safeParse({
        boardId: "board-1",
        taskId: "task-1",
      });
      assert.equal(valid.success, true);

      const invalid = getTaskAuditHistorySchema.safeParse({
        boardId: "",
        taskId: "   ",
      });
      assert.equal(invalid.success, false);
    });

    test("getBoardAuditHistorySchema validuje boardId", () => {
      const valid = getBoardAuditHistorySchema.safeParse({
        boardId: "board-1",
      });
      assert.equal(valid.success, true);

      const invalid = getBoardAuditHistorySchema.safeParse({
        boardId: "   ",
      });
      assert.equal(invalid.success, false);
    });
  });
});
