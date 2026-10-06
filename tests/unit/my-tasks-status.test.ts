import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type {
  BoardRecord,
  BoardRepository,
  UserBoardRecord,
  MembershipRecord,
  MembershipRepository,
  UnitOfWork,
  UnitOfWorkRepositories,
  UserRecord,
  UserRepository,
} from "../../modules/boards/application/ports/index.ts";
import type {
  AreaRecord,
  AreaRepository,
} from "../../modules/areas/application/ports/area-repository.port.ts";
import type {
  CreateTaskCommentData,
  TaskCommentRecord,
  TaskCommentRepository,
  TaskParticipantRecord,
  TaskParticipantRepository,
  TaskRecord,
  TaskRepository,
  UserTaskNoteRecord,
  UserTaskNoteRepository,
  UpsertUserTaskNoteData,
} from "../../modules/tasks/application/ports/index.ts";
import {
  GetMyTasksUseCase,
  ChangeTaskStatusUseCase,
} from "../../modules/tasks/application/use-cases/index.ts";
import { changeTaskStatusSchema } from "../../modules/tasks/api/dto/task.dto.ts";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// Testovací In-Memory Repozitáře
// ─────────────────────────────────────────────────────────────

class InMemoryBoardRepository implements BoardRepository {
  public store = new Map<string, BoardRecord>();

  async findById(id: string): Promise<BoardRecord | null> {
    const b = this.store.get(id);
    return b ? { ...b } : null;
  }
  async findByIdForUpdate(id: string): Promise<BoardRecord | null> {
    return this.findById(id);
  }
  async findByCreatedBy(): Promise<BoardRecord[]> {
    return [];
  }
  async create(): Promise<BoardRecord> {
    throw new Error("Not implemented");
  }
  async update(): Promise<BoardRecord> {
    throw new Error("Not implemented");
  }
  async softDelete(): Promise<void> {}
  async findAll(): Promise<BoardRecord[]> {
    return Array.from(this.store.values());
  }
  async findActiveBoardsForUser(): Promise<UserBoardRecord[]> {
    return Array.from(this.store.values())
      .filter((b) => b.deletedAt === null)
      .map((b) => ({ ...b, role: "MEMBER" as const }));
  }
  async findActiveBoardsForAdmin(): Promise<UserBoardRecord[]> {
    return Array.from(this.store.values())
      .filter((b) => b.deletedAt === null)
      .map((b) => ({ ...b, role: null }));
  }
}

class InMemoryMembershipRepository implements MembershipRepository {
  public store = new Map<string, MembershipRecord>();

  private key(boardId: string, userId: string): string {
    return `${boardId}:${userId}`;
  }

  async findByBoardAndUser(
    boardId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    const m = this.store.get(this.key(boardId, userId));
    return m ? { ...m } : null;
  }

  async findMembershipsByBoard(boardId: string): Promise<MembershipRecord[]> {
    return Array.from(this.store.values()).filter((m) => m.boardId === boardId);
  }

  async create(data: {
    boardId: string;
    userId: string;
    role: "OWNER" | "MANAGER" | "MEMBER";
  }): Promise<MembershipRecord> {
    const id = `mem-${crypto.randomUUID()}`;
    const record: MembershipRecord = {
      id,
      boardId: data.boardId,
      userId: data.userId,
      role: data.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(this.key(data.boardId, data.userId), record);
    return { ...record };
  }

  async updateRole(
    boardId: string,
    userId: string,
    newRole: "OWNER" | "MANAGER" | "MEMBER",
  ): Promise<void> {
    const r = await this.findByBoardAndUser(boardId, userId);
    if (r) {
      this.store.set(this.key(boardId, userId), { ...r, role: newRole });
    }
  }

  async delete(boardId: string, userId: string): Promise<void> {
    this.store.delete(this.key(boardId, userId));
  }
}

class InMemoryUserRepository implements UserRepository {
  public store = new Map<string, UserRecord>();

  async findById(id: string): Promise<UserRecord | null> {
    const u = this.store.get(id);
    return u ? { ...u } : null;
  }

  async findByIds(ids: string[]): Promise<UserRecord[]> {
    return ids.map((id) => this.store.get(id)!).filter(Boolean);
  }

  async findActiveUsers(): Promise<UserRecord[]> {
    return Array.from(this.store.values()).filter(
      (u) => u.isActive && u.deletedAt === null,
    );
  }
}

class InMemoryAreaRepository implements AreaRepository {
  public store = new Map<string, AreaRecord>();

  async findById(id: string): Promise<AreaRecord | null> {
    const a = this.store.get(id);
    return a ? { ...a } : null;
  }

  async findByBoardId(boardId: string): Promise<AreaRecord[]> {
    return Array.from(this.store.values()).filter((a) => a.boardId === boardId);
  }

  async findByNameAndBoard(name: string, boardId: string): Promise<AreaRecord | null> {
    return this.findByBoardAndName(boardId, name);
  }

  async findByBoardAndName(boardId: string, name: string): Promise<AreaRecord | null> {
    return (
      Array.from(this.store.values()).find(
        (a) => a.name === name && a.boardId === boardId,
      ) ?? null
    );
  }

  async create(): Promise<AreaRecord> {
    throw new Error("Not implemented");
  }

  async update(): Promise<AreaRecord> {
    throw new Error("Not implemented");
  }

  async delete(): Promise<void> {}
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

  async findByAreaId(areaId: string): Promise<TaskRecord[]> {
    return Array.from(this.store.values()).filter((t) => t.areaId === areaId);
  }

  async findUserTasksAcrossBoards(
    userId: string,
    boardIds: string[],
  ): Promise<TaskRecord[]> {
    return Array.from(this.store.values()).filter(
      (t) =>
        boardIds.includes(t.boardId) &&
        (t.assigneeId === userId || t.createdBy === userId),
    );
  }

  async create(data: {
    boardId: string;
    areaId?: string | null;
    title: string;
    description?: string | null;
    status?: TaskRecord["status"];
    priority?: TaskRecord["priority"];
    dueDate?: Date | null;
    assigneeId?: string | null;
    createdBy: string;
  }): Promise<TaskRecord> {
    const id = `task-${crypto.randomUUID()}`;
    const record: TaskRecord = {
      id,
      boardId: data.boardId,
      areaId: data.areaId ?? null,
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? "NOVÉ",
      priority: data.priority ?? "BĚŽNÁ",
      dueDate: data.dueDate ?? null,
      assigneeId: data.assigneeId ?? null,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };
    this.store.set(id, record);
    return { ...record };
  }

  async update(id: string, data: Partial<TaskRecord>): Promise<TaskRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Task not found");
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

class InMemoryTaskParticipantRepository implements TaskParticipantRepository {
  public store = new Map<string, TaskParticipantRecord>();

  private key(taskId: string, userId: string): string {
    return `${taskId}:${userId}`;
  }

  async findByTaskId(taskId: string): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values()).filter((p) => p.taskId === taskId);
  }

  async findByTaskIds(taskIds: string[]): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values()).filter((p) =>
      taskIds.includes(p.taskId),
    );
  }

  async findByTaskAndUser(
    taskId: string,
    userId: string,
  ): Promise<TaskParticipantRecord | null> {
    const r = this.store.get(this.key(taskId, userId));
    return r ? { ...r } : null;
  }

  async findByUserId(userId: string): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values()).filter((p) => p.userId === userId);
  }

  async addParticipant(
    taskId: string,
    userId: string,
    role: string = "CONTRIBUTOR",
  ): Promise<TaskParticipantRecord> {
    const id = `part-${crypto.randomUUID()}`;
    const rec = { id, taskId, userId, role, createdAt: new Date() };
    this.store.set(this.key(taskId, userId), rec);
    return rec;
  }

  async removeParticipant(taskId: string, userId: string): Promise<void> {
    this.store.delete(this.key(taskId, userId));
  }

  async removeAllForTask(taskId: string): Promise<void> {
    for (const [k, v] of this.store.entries()) {
      if (v.taskId === taskId) this.store.delete(k);
    }
  }

  async create(data: { taskId: string; userId: string; role: string }): Promise<TaskParticipantRecord> {
    return this.addParticipant(data.taskId, data.userId, data.role);
  }

  async delete(taskId: string, userId: string): Promise<void> {
    return this.removeParticipant(taskId, userId);
  }

  async deleteAllForTask(taskId: string): Promise<void> {
    return this.removeAllForTask(taskId);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [k, v] of this.store.entries()) {
      if (v.userId === userId) this.store.delete(k);
    }
  }
}

class InMemoryTaskCommentRepository implements TaskCommentRepository {
  public store = new Map<string, TaskCommentRecord>();

  async findById(id: string): Promise<TaskCommentRecord | null> {
    return this.store.get(id) ?? null;
  }

  async findByTaskId(taskId: string): Promise<TaskCommentRecord[]> {
    return Array.from(this.store.values()).filter((c) => c.taskId === taskId);
  }

  async countByTaskId(taskId: string): Promise<number> {
    return (await this.findByTaskId(taskId)).length;
  }

  async countByTaskIds(taskIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const taskId of taskIds) {
      map.set(taskId, (await this.findByTaskId(taskId)).length);
    }
    return map;
  }

  async create(data: CreateTaskCommentData): Promise<TaskCommentRecord> {
    const id = `comm-${crypto.randomUUID()}`;
    const rec: TaskCommentRecord = {
      id,
      taskId: data.taskId,
      authorId: data.authorId,
      content: data.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(id, rec);
    return rec;
  }

  async update(id: string, data: { content: string }): Promise<TaskCommentRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Comment not found");
    const updated = { ...existing, content: data.content, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async deleteAllForTask(taskId: string): Promise<void> {
    for (const [k, c] of this.store.entries()) {
      if (c.taskId === taskId) this.store.delete(k);
    }
  }
}

class InMemoryUserTaskNoteRepository implements UserTaskNoteRepository {
  public store = new Map<string, UserTaskNoteRecord>();

  private key(userId: string, taskId: string): string {
    return `${userId}:${taskId}`;
  }

  async findById(id: string): Promise<UserTaskNoteRecord | null> {
    return Array.from(this.store.values()).find((n) => n.id === id) ?? null;
  }

  async findByUserAndTask(userId: string, taskId: string): Promise<UserTaskNoteRecord | null> {
    return this.store.get(this.key(userId, taskId)) ?? null;
  }

  async findByUserAndTaskIds(
    userId: string,
    taskIds: string[],
  ): Promise<Map<string, UserTaskNoteRecord>> {
    const map = new Map<string, UserTaskNoteRecord>();
    for (const tId of taskIds) {
      const n = this.store.get(this.key(userId, tId));
      if (n) map.set(tId, { ...n });
    }
    return map;
  }

  async upsert(data: UpsertUserTaskNoteData): Promise<UserTaskNoteRecord> {
    const k = this.key(data.userId, data.taskId);
    const existing = this.store.get(k);
    const now = new Date();
    if (existing) {
      const u = { ...existing, content: data.content, updatedAt: now };
      this.store.set(k, u);
      return { ...u };
    }
    const n: UserTaskNoteRecord = {
      id: `note-${crypto.randomUUID()}`,
      userId: data.userId,
      taskId: data.taskId,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(k, n);
    return { ...n };
  }

  async delete(userId: string, taskId: string): Promise<void> {
    this.store.delete(this.key(userId, taskId));
  }

  async deleteAllForTask(taskId: string): Promise<void> {
    for (const [k, n] of this.store.entries()) {
      if (n.taskId === taskId) this.store.delete(k);
    }
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [k, n] of this.store.entries()) {
      if (n.userId === userId) this.store.delete(k);
    }
  }
}

class InMemoryUnitOfWork implements UnitOfWork {
  private readonly repos: UnitOfWorkRepositories;

  constructor(repos: UnitOfWorkRepositories) {
    this.repos = repos;
  }

  async runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return await work(this.repos);
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────

describe("STEP 9A – Quick Status v Moje práce", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let areaRepo: InMemoryAreaRepository;
  let taskRepo: InMemoryTaskRepository;
  let participantRepo: InMemoryTaskParticipantRepository;
  let commentRepo: InMemoryTaskCommentRepository;
  let noteRepo: InMemoryUserTaskNoteRepository;
  let uow: InMemoryUnitOfWork;

  const boardId = "board-1";
  const aliceId = "user-alice";
  const bobId = "user-bob";
  const charlieId = "user-charlie";
  const adminId = "user-admin";

  const aliceActor: ActorContext = {
    actor_user_id: aliceId,
    session_id: "sess-alice",
    global_role: "USER",
    is_active: true,
  };

  const bobActor: ActorContext = {
    actor_user_id: bobId,
    session_id: "sess-bob",
    global_role: "USER",
    is_active: true,
  };

  const charlieActor: ActorContext = {
    actor_user_id: charlieId,
    session_id: "sess-charlie",
    global_role: "USER",
    is_active: true,
  };

  const adminActor: ActorContext = {
    actor_user_id: adminId,
    session_id: "sess-admin",
    global_role: "ADMIN",
    is_active: true,
  };

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    areaRepo = new InMemoryAreaRepository();
    taskRepo = new InMemoryTaskRepository();
    participantRepo = new InMemoryTaskParticipantRepository();
    commentRepo = new InMemoryTaskCommentRepository();
    noteRepo = new InMemoryUserTaskNoteRepository();

    uow = new InMemoryUnitOfWork({
      boards: boardRepo,
      memberships: membershipRepo,
      tasks: taskRepo,
      taskParticipants: participantRepo,
      users: userRepo,
    });

    boardRepo.store.set(boardId, {
      id: boardId,
      name: "Projekt Alfa",
      description: "Testovací nástěnka",
      createdBy: aliceId,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    userRepo.store.set(aliceId, {
      id: aliceId,
      name: "Alice",
      email: "alice@example.com",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });

    userRepo.store.set(bobId, {
      id: bobId,
      name: "Bob",
      email: "bob@example.com",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });

    userRepo.store.set(charlieId, {
      id: charlieId,
      name: "Charlie",
      email: "charlie@example.com",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });

    userRepo.store.set(adminId, {
      id: adminId,
      name: "Admin",
      email: "admin@example.com",
      globalRole: "ADMIN",
      isActive: true,
      deletedAt: null,
    });

    await membershipRepo.create({ boardId, userId: aliceId, role: "OWNER" });
    await membershipRepo.create({ boardId, userId: bobId, role: "MEMBER" });
    await membershipRepo.create({ boardId, userId: charlieId, role: "MEMBER" });
  });

  // ─────────────────────────────────────────────────────────────
  // 1. DTO validace (changeTaskStatusSchema)
  // ─────────────────────────────────────────────────────────────
  describe("1. DTO validace (changeTaskStatusSchema)", () => {
    test("přijímá platné hodnoty stavů", () => {
      const validStatuses = [
        "NOVÉ",
        "PŘEVZATÉ",
        "ROZPRACOVANÉ",
        "ČEKÁ SE",
        "HOTOVO",
        "ARCHIVOVÁNO",
      ];
      for (const status of validStatuses) {
        const parsed = changeTaskStatusSchema.safeParse({
          taskId: "task-123",
          status,
        });
        assert.equal(parsed.success, true);
      }
    });

    test("odmítá neplatný stav úkolu", () => {
      const parsed = changeTaskStatusSchema.safeParse({
        taskId: "task-123",
        status: "NEZNÁMÝ_STAV",
      });
      assert.equal(parsed.success, false);
    });

    test("odmítá prázdné taskId", () => {
      const parsed = changeTaskStatusSchema.safeParse({
        taskId: "",
        status: "HOTOVO",
      });
      assert.equal(parsed.success, false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. ChangeTaskStatusUseCase v kontextu Moje úkoly
  // ─────────────────────────────────────────────────────────────
  describe("2. ChangeTaskStatusUseCase v kontextu Moje úkoly", () => {
    test("Assignee může změnit stav úkolu z ROZPRACOVANÉ na HOTOVO a nastaví se completedAt", async () => {
      const task = await taskRepo.create({
        boardId,
        title: "Důležitý úkol pro Boba",
        createdBy: aliceId,
        assigneeId: bobId,
        status: "ROZPRACOVANÉ",
      });

      const useCase = new ChangeTaskStatusUseCase(uow);
      const result = await useCase.execute(bobActor, {
        taskId: task.id,
        newStatus: "HOTOVO",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.status, "HOTOVO");
        assert.ok(result.data.completedAt instanceof Date);
      }
    });

    test("Přechod z HOTOVO zpět do ROZPRACOVANÉ vymaže completedAt", async () => {
      const task = await taskRepo.create({
        boardId,
        title: "Hotový úkol k znovuotevření",
        createdBy: aliceId,
        assigneeId: bobId,
        status: "HOTOVO",
      });
      await taskRepo.update(task.id, { completedAt: new Date() });

      const useCase = new ChangeTaskStatusUseCase(uow);
      const result = await useCase.execute(bobActor, {
        taskId: task.id,
        newStatus: "ROZPRACOVANÉ",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.status, "ROZPRACOVANÉ");
        assert.equal(result.data.completedAt, null);
      }
    });

    test("Participant (Spoluřešitel) může změnit stav úkolu z NOVÉ na PŘEVZATÉ", async () => {
      const task = await taskRepo.create({
        boardId,
        title: "Týmový úkol",
        createdBy: aliceId,
        assigneeId: aliceId,
        status: "NOVÉ",
      });
      await participantRepo.addParticipant(task.id, bobId);

      const useCase = new ChangeTaskStatusUseCase(uow);
      const result = await useCase.execute(bobActor, {
        taskId: task.id,
        newStatus: "PŘEVZATÉ",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.status, "PŘEVZATÉ");
      }
    });

    test("Běžný člen, který není assignee ani participant, nemůže změnit stav", async () => {
      const task = await taskRepo.create({
        boardId,
        title: "Cizí úkol",
        createdBy: aliceId,
        assigneeId: aliceId,
        status: "NOVÉ",
      });

      const useCase = new ChangeTaskStatusUseCase(uow);
      const result = await useCase.execute(charlieActor, {
        taskId: task.id,
        newStatus: "ROZPRACOVANÉ",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthorizationError);
        assert.equal(result.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("Neautentizovaný požadavek je zamítnut AuthenticationError", async () => {
      const task = await taskRepo.create({
        boardId,
        title: "Úkol",
        createdBy: aliceId,
        assigneeId: bobId,
        status: "NOVÉ",
      });

      const useCase = new ChangeTaskStatusUseCase(uow);
      const result = await useCase.execute(null, {
        taskId: task.id,
        newStatus: "ROZPRACOVANÉ",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthenticationError);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Ochrana archivovaného úkolu (TASK_ARCHIVED)
  // ─────────────────────────────────────────────────────────────
  describe("3. Ochrana archivovaného úkolu (TASK_ARCHIVED)", () => {
    test("Změna stavu archivovaného úkolu skončí chybou TASK_ARCHIVED pro Assignee", async () => {
      const task = await taskRepo.create({
        boardId,
        title: "Archivovaný úkol",
        createdBy: aliceId,
        assigneeId: bobId,
        status: "ARCHIVOVÁNO",
      });

      const useCase = new ChangeTaskStatusUseCase(uow);
      const result = await useCase.execute(bobActor, {
        taskId: task.id,
        newStatus: "ROZPRACOVANÉ",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthorizationError);
        assert.equal(result.error.reason, "TASK_ARCHIVED");
      }
    });

    test("Změna stavu archivovaného úkolu skončí chybou TASK_ARCHIVED i pro ADMINa", async () => {
      const task = await taskRepo.create({
        boardId,
        title: "Archivovaný úkol",
        createdBy: aliceId,
        assigneeId: bobId,
        status: "ARCHIVOVÁNO",
      });

      const useCase = new ChangeTaskStatusUseCase(uow);
      const result = await useCase.execute(adminActor, {
        taskId: task.id,
        newStatus: "ROZPRACOVANÉ",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthorizationError);
        assert.equal(result.error.reason, "TASK_ARCHIVED");
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Integrace filtrů v Moje úkoly (GetMyTasksUseCase) po změně stavu
  // ─────────────────────────────────────────────────────────────
  describe("4. Integrace filtrů v Moje úkoly (GetMyTasksUseCase) po změně stavu", () => {
    test("Po změně z ROZPRACOVANÉ na HOTOVO úkol zmizí z filtru ACTIVE a objeví se ve filtru COMPLETED", async () => {
      const task = await taskRepo.create({
        boardId,
        title: "Úkol přecházející do HOTOVO",
        createdBy: aliceId,
        assigneeId: bobId,
        status: "ROZPRACOVANÉ",
      });

      const getMyTasksUseCase = new GetMyTasksUseCase(
        boardRepo,
        taskRepo,
        participantRepo,
        areaRepo,
        userRepo,
        undefined,
        commentRepo,
        noteRepo,
      );

      // 1. Před změnou: Úkol je v ACTIVE
      const activeBefore = await getMyTasksUseCase.execute(bobActor, {
        filter: "ACTIVE",
      });
      assert.equal(activeBefore.success, true);
      if (activeBefore.success) {
        assert.equal(activeBefore.data.length, 1);
        assert.equal(activeBefore.data[0].id, task.id);
      }

      // 2. Před změnou: Úkol NENÍ v COMPLETED
      const completedBefore = await getMyTasksUseCase.execute(bobActor, {
        filter: "COMPLETED",
      });
      assert.equal(completedBefore.success, true);
      if (completedBefore.success) {
        assert.equal(completedBefore.data.length, 0);
      }

      // 3. Provedení Quick Status změny na HOTOVO
      const changeStatusUseCase = new ChangeTaskStatusUseCase(uow);
      const changeRes = await changeStatusUseCase.execute(bobActor, {
        taskId: task.id,
        newStatus: "HOTOVO",
      });
      assert.equal(changeRes.success, true);

      // 4. Po změně: Úkol NENÍ v ACTIVE
      const activeAfter = await getMyTasksUseCase.execute(bobActor, {
        filter: "ACTIVE",
      });
      assert.equal(activeAfter.success, true);
      if (activeAfter.success) {
        assert.equal(activeAfter.data.length, 0);
      }

      // 5. Po změně: Úkol JE v COMPLETED
      const completedAfter = await getMyTasksUseCase.execute(bobActor, {
        filter: "COMPLETED",
      });
      assert.equal(completedAfter.success, true);
      if (completedAfter.success) {
        assert.equal(completedAfter.data.length, 1);
        assert.equal(completedAfter.data[0].id, task.id);
        assert.equal(completedAfter.data[0].status, "HOTOVO");
      }

      // 6. Provedení Quick Status změny zpět z HOTOVO na ROZPRACOVANÉ
      const revertRes = await changeStatusUseCase.execute(bobActor, {
        taskId: task.id,
        newStatus: "ROZPRACOVANÉ",
      });
      assert.equal(revertRes.success, true);

      // 7. Po vrácení: Úkol je opět v ACTIVE a NENÍ v COMPLETED
      const activeReverted = await getMyTasksUseCase.execute(bobActor, {
        filter: "ACTIVE",
      });
      assert.equal(activeReverted.success, true);
      if (activeReverted.success) {
        assert.equal(activeReverted.data.length, 1);
        assert.equal(activeReverted.data[0].id, task.id);
        assert.equal(activeReverted.data[0].status, "ROZPRACOVANÉ");
      }
    });
  });
});
