import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type {
  BoardRecord,
  BoardRepository,
  CreateBoardData,
  MembershipRecord,
  MembershipRepository,
  UnitOfWork,
  UnitOfWorkRepositories,
  UserRecord,
  UserRepository,
} from "../../modules/boards/application/ports/index.ts";
import type {
  CreateTaskData,
  TaskParticipantRecord,
  TaskParticipantRepository,
  TaskPriority,
  TaskRecord,
  TaskRepository,
  TaskStatus,
  UpdateTaskData,
} from "../../modules/tasks/application/ports/index.ts";
import {
  ChangeTaskStatusUseCase,
  TakeOverTaskUseCase,
  JoinTaskAsParticipantUseCase,
  LeaveTaskAsParticipantUseCase,
  RemoveTaskParticipantUseCase,
  ArchiveTaskUseCase,
  DeleteTaskUseCase,
} from "../../modules/tasks/application/use-cases/index.ts";
import {
  changeTaskStatusSchema,
  takeOverTaskSchema,
  joinTaskAsParticipantSchema,
  leaveTaskAsParticipantSchema,
  removeTaskParticipantSchema,
  archiveTaskSchema,
  deleteTaskSchema,
} from "../../modules/tasks/api/dto/task.dto.ts";
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// Testovací In-Memory Repozitáře
// ─────────────────────────────────────────────────────────────

class InMemoryBoardRepository implements BoardRepository {
  public store = new Map<string, BoardRecord>();

  async findById(boardId: string): Promise<BoardRecord | null> {
    const r = this.store.get(boardId);
    return r ? { ...r } : null;
  }

  async findByIdForUpdate(boardId: string): Promise<BoardRecord | null> {
    return this.findById(boardId);
  }

  async create(data: CreateBoardData): Promise<BoardRecord> {
    const id = data.id ?? `board-${crypto.randomUUID()}`;
    const record: BoardRecord = {
      id,
      name: data.name,
      description: data.description ?? null,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    this.store.set(id, record);
    return { ...record };
  }

  async update(boardId: string, data: any): Promise<BoardRecord> {
    const existing = this.store.get(boardId);
    if (!existing) throw new Error("Board not found");
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.store.set(boardId, updated);
    return updated;
  }

  async softDelete(boardId: string, deletedAt: Date): Promise<void> {
    const r = this.store.get(boardId);
    if (r) {
      this.store.set(boardId, { ...r, deletedAt });
    }
  }

  async findActiveBoardsForUser(): Promise<any[]> {
    return [];
  }

  async findActiveBoardsForAdmin(): Promise<any[]> {
    return [];
  }
}

class InMemoryMembershipRepository implements MembershipRepository {
  public store = new Map<string, MembershipRecord>();

  async findByBoardAndUser(
    boardId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    for (const m of this.store.values()) {
      if (m.boardId === boardId && m.userId === userId) {
        return { ...m };
      }
    }
    return null;
  }

  async findByBoardAndUserForUpdate(
    boardId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    return this.findByBoardAndUser(boardId, userId);
  }

  async findByBoardId(boardId: string): Promise<MembershipRecord[]> {
    return Array.from(this.store.values())
      .filter((m) => m.boardId === boardId)
      .map((m) => ({ ...m }));
  }

  async findMembershipsByBoard(boardId: string): Promise<MembershipRecord[]> {
    return this.findByBoardId(boardId);
  }

  async countManagers(boardId: string): Promise<number> {
    return Array.from(this.store.values()).filter(
      (m) => m.boardId === boardId && m.role === "MANAGER",
    ).length;
  }

  async create(data: {
    id?: string;
    boardId: string;
    userId: string;
    role: "OWNER" | "MANAGER" | "MEMBER";
  }): Promise<MembershipRecord> {
    const id = data.id ?? `mem-${crypto.randomUUID()}`;
    const record: MembershipRecord = {
      id,
      boardId: data.boardId,
      userId: data.userId,
      role: data.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(id, record);
    return { ...record };
  }

  async updateRole(
    boardId: string,
    userId: string,
    newRole: "OWNER" | "MANAGER" | "MEMBER",
  ): Promise<void> {
    for (const [id, r] of this.store.entries()) {
      if (r.boardId === boardId && r.userId === userId) {
        this.store.set(id, { ...r, role: newRole, updatedAt: new Date() });
        return;
      }
    }
  }

  async delete(boardId: string, userId: string): Promise<void> {
    for (const [id, r] of this.store.entries()) {
      if (r.boardId === boardId && r.userId === userId) {
        this.store.delete(id);
        return;
      }
    }
  }
}

class InMemoryTaskRepository implements TaskRepository {
  public store = new Map<string, TaskRecord>();

  async findById(taskId: string): Promise<TaskRecord | null> {
    const t = this.store.get(taskId);
    return t ? { ...t } : null;
  }

  async findByIdForUpdate(taskId: string): Promise<TaskRecord | null> {
    return this.findById(taskId);
  }

  async findByBoardId(
    boardId: string,
    filter?: "ACTIVE" | "ARCHIVED" | "ALL",
  ): Promise<TaskRecord[]> {
    return Array.from(this.store.values()).filter((t) => {
      if (t.boardId !== boardId) return false;
      if (filter === "ARCHIVED") return t.status === "ARCHIVOVÁNO";
      if (filter === "ACTIVE") return t.status !== "ARCHIVOVÁNO";
      return true;
    });
  }

  async findByAreaId(areaId: string): Promise<TaskRecord[]> {
    return Array.from(this.store.values()).filter((t) => t.areaId === areaId);
  }

  async create(data: CreateTaskData): Promise<TaskRecord> {
    const id = data.id ?? `task-${crypto.randomUUID()}`;
    const record: TaskRecord = {
      id,
      boardId: data.boardId,
      areaId: data.areaId ?? null,
      title: data.title,
      description: data.description ?? null,
      status: (data.status as TaskStatus) ?? "NOVÉ",
      priority: (data.priority as TaskPriority) ?? "BĚŽNÁ",
      dueDate: data.dueDate ?? null,
      createdBy: data.createdBy,
      assigneeId: data.assigneeId ?? null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(id, record);
    return { ...record };
  }

  async update(taskId: string, data: UpdateTaskData): Promise<TaskRecord> {
    const existing = this.store.get(taskId);
    if (!existing) throw new Error("Task not found");
    const updated: TaskRecord = {
      ...existing,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.areaId !== undefined ? { areaId: data.areaId } : {}),
      ...(data.assigneeId !== undefined
        ? { assigneeId: data.assigneeId }
        : {}),
      ...(data.status !== undefined
        ? { status: data.status as TaskStatus }
        : {}),
      ...(data.priority !== undefined
        ? { priority: data.priority as TaskPriority }
        : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.completedAt !== undefined
        ? { completedAt: data.completedAt }
        : {}),
      updatedAt: new Date(),
    };
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
    return this.store
      .filter((p) => p.taskId === taskId)
      .map((p) => ({ ...p }));
  }

  async findByTaskIds(taskIds: string[]): Promise<TaskParticipantRecord[]> {
    const idSet = new Set(taskIds);
    return this.store
      .filter((p) => idSet.has(p.taskId))
      .map((p) => ({ ...p }));
  }

  async findByTaskAndUser(
    taskId: string,
    userId: string,
  ): Promise<TaskParticipantRecord | null> {
    const r = this.store.find(
      (p) => p.taskId === taskId && p.userId === userId,
    );
    return r ? { ...r } : null;
  }

  async addParticipant(
    taskId: string,
    userId: string,
    role?: string,
  ): Promise<TaskParticipantRecord> {
    const id = `tp-${crypto.randomUUID()}`;
    const record: TaskParticipantRecord = {
      id,
      taskId,
      userId,
      role: role ?? "CONTRIBUTOR",
      createdAt: new Date(),
    };
    this.store.push(record);
    return { ...record };
  }

  async removeParticipant(taskId: string, userId: string): Promise<void> {
    this.store = this.store.filter(
      (p) => !(p.taskId === taskId && p.userId === userId),
    );
  }

  async removeAllForTask(taskId: string): Promise<void> {
    this.store = this.store.filter((p) => p.taskId !== taskId);
  }
}

class InMemoryUserRepository implements UserRepository {
  public store = new Map<string, UserRecord>();

  async findById(userId: string): Promise<UserRecord | null> {
    const r = this.store.get(userId);
    return r ? { ...r } : null;
  }

  async findByIds(userIds: readonly string[]): Promise<UserRecord[]> {
    return userIds
      .map((id) => this.store.get(id))
      .filter((u): u is UserRecord => u !== undefined);
  }

  async findActiveUsers(): Promise<UserRecord[]> {
    return Array.from(this.store.values()).filter((u) => u.isActive);
  }
}

class InMemoryUnitOfWork implements UnitOfWork {
  public readonly boardRepo: InMemoryBoardRepository;
  public readonly memberRepo: InMemoryMembershipRepository;
  public readonly userRepo: InMemoryUserRepository;
  public readonly taskRepo: InMemoryTaskRepository;
  public readonly participantRepo: InMemoryTaskParticipantRepository;

  constructor(
    boardRepo: InMemoryBoardRepository,
    memberRepo: InMemoryMembershipRepository,
    userRepo: InMemoryUserRepository,
    taskRepo: InMemoryTaskRepository,
    participantRepo: InMemoryTaskParticipantRepository,
  ) {
    this.boardRepo = boardRepo;
    this.memberRepo = memberRepo;
    this.userRepo = userRepo;
    this.taskRepo = taskRepo;
    this.participantRepo = participantRepo;
  }

  async runInTransaction<T>(
    fn: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return fn({
      boards: this.boardRepo,
      memberships: this.memberRepo,
      users: this.userRepo,
      tasks: this.taskRepo,
      taskParticipants: this.participantRepo,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite: Task Status, Take Over, Participants & Lifecycle
// ─────────────────────────────────────────────────────────────

describe("STEP 5B – Task Status, Take Over, Participants & Lifecycle", () => {
  let boardRepo: InMemoryBoardRepository;
  let memberRepo: InMemoryMembershipRepository;
  let taskRepo: InMemoryTaskRepository;
  let participantRepo: InMemoryTaskParticipantRepository;
  let uow: InMemoryUnitOfWork;

  const ownerActor: ActorContext = {
    actor_user_id: "user-owner",
    session_id: "sess-owner",
    global_role: "USER",
    is_active: true,
  };

  const managerActor: ActorContext = {
    actor_user_id: "user-manager",
    session_id: "sess-manager",
    global_role: "USER",
    is_active: true,
  };

  const assigneeActor: ActorContext = {
    actor_user_id: "user-assignee",
    session_id: "sess-assignee",
    global_role: "USER",
    is_active: true,
  };

  const participantActor: ActorContext = {
    actor_user_id: "user-participant",
    session_id: "sess-participant",
    global_role: "USER",
    is_active: true,
  };

  const regularMemberActor: ActorContext = {
    actor_user_id: "user-regular",
    session_id: "sess-regular",
    global_role: "USER",
    is_active: true,
  };

  const nonMemberActor: ActorContext = {
    actor_user_id: "user-nonmember",
    session_id: "sess-nonmember",
    global_role: "USER",
    is_active: true,
  };

  const adminActor: ActorContext = {
    actor_user_id: "user-admin",
    session_id: "sess-admin",
    global_role: "ADMIN",
    is_active: true,
  };

  let testBoard: BoardRecord;
  let testTask: TaskRecord;

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    memberRepo = new InMemoryMembershipRepository();
    const userRepo = new InMemoryUserRepository();
    taskRepo = new InMemoryTaskRepository();
    participantRepo = new InMemoryTaskParticipantRepository();
    uow = new InMemoryUnitOfWork(
      boardRepo,
      memberRepo,
      userRepo,
      taskRepo,
      participantRepo,
    );

    testBoard = await boardRepo.create({
      id: "board-1",
      name: "Projekt Alfa",
      description: "Testovací nástěnka",
      createdBy: ownerActor.actor_user_id,
    });

    await memberRepo.create({
      boardId: testBoard.id,
      userId: ownerActor.actor_user_id,
      role: "OWNER",
    });

    await memberRepo.create({
      boardId: testBoard.id,
      userId: managerActor.actor_user_id,
      role: "MANAGER",
    });

    await memberRepo.create({
      boardId: testBoard.id,
      userId: assigneeActor.actor_user_id,
      role: "MEMBER",
    });

    await memberRepo.create({
      boardId: testBoard.id,
      userId: participantActor.actor_user_id,
      role: "MEMBER",
    });

    await memberRepo.create({
      boardId: testBoard.id,
      userId: regularMemberActor.actor_user_id,
      role: "MEMBER",
    });

    testTask = await taskRepo.create({
      id: "task-1",
      boardId: testBoard.id,
      title: "Původní úkol",
      description: "Popis úkolu",
      status: "NOVÉ",
      priority: "BĚŽNÁ",
      createdBy: ownerActor.actor_user_id,
      assigneeId: assigneeActor.actor_user_id,
    });

    await participantRepo.addParticipant(
      testTask.id,
      participantActor.actor_user_id,
    );
  });

  // ───────────────────────────────────────────────────────────
  // 1. ChangeTaskStatusUseCase
  // ───────────────────────────────────────────────────────────
  describe("1. ChangeTaskStatusUseCase", () => {
    test("assignee can change status to ROZPRACOVANÉ", async () => {
      const useCase = new ChangeTaskStatusUseCase(uow);
      const res = await useCase.execute(assigneeActor, {
        taskId: testTask.id,
        newStatus: "ROZPRACOVANÉ",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "ROZPRACOVANÉ");
        assert.strictEqual(res.data.completedAt, null);
      }
    });

    test("participant can change status to ČEKÁ SE", async () => {
      const useCase = new ChangeTaskStatusUseCase(uow);
      const res = await useCase.execute(participantActor, {
        taskId: testTask.id,
        newStatus: "ČEKÁ SE",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "ČEKÁ SE");
      }
    });

    test("transition to HOTOVO automatically sets completedAt", async () => {
      const useCase = new ChangeTaskStatusUseCase(uow);
      const res = await useCase.execute(managerActor, {
        taskId: testTask.id,
        newStatus: "HOTOVO",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "HOTOVO");
        assert.ok(res.data.completedAt instanceof Date);
      }
    });

    test("transition from HOTOVO back to ROZPRACOVANÉ clears completedAt", async () => {
      // Nejprve nastavit HOTOVO
      await taskRepo.update(testTask.id, {
        status: "HOTOVO",
        completedAt: new Date(),
      });

      const useCase = new ChangeTaskStatusUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: testTask.id,
        newStatus: "ROZPRACOVANÉ",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "ROZPRACOVANÉ");
        assert.strictEqual(res.data.completedAt, null);
      }
    });

    test("regular member who is neither assignee nor participant cannot change status", async () => {
      const useCase = new ChangeTaskStatusUseCase(uow);
      const res = await useCase.execute(regularMemberActor, {
        taskId: testTask.id,
        newStatus: "ROZPRACOVANÉ",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("global admin can change status", async () => {
      const useCase = new ChangeTaskStatusUseCase(uow);
      const res = await useCase.execute(adminActor, {
        taskId: testTask.id,
        newStatus: "PŘEVZATÉ",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "PŘEVZATÉ");
      }
    });

    test("changeTaskStatusSchema validates status properly", () => {
      const valid = changeTaskStatusSchema.safeParse({
        taskId: "task-1",
        status: "ROZPRACOVANÉ",
      });
      assert.strictEqual(valid.success, true);

      const invalid = changeTaskStatusSchema.safeParse({
        taskId: "task-1",
        status: "NEZNAMY_STAV",
      });
      assert.strictEqual(invalid.success, false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. TakeOverTaskUseCase
  // ───────────────────────────────────────────────────────────
  describe("2. TakeOverTaskUseCase", () => {
    test("member takes over task from current assignee", async () => {
      const useCase = new TakeOverTaskUseCase(uow);
      const res = await useCase.execute(regularMemberActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(
          res.data.assigneeId,
          regularMemberActor.actor_user_id,
        );
      }
    });

    test("taking over removes actor from participants if they were already participant", async () => {
      const useCase = new TakeOverTaskUseCase(uow);
      const res = await useCase.execute(participantActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(
          res.data.assigneeId,
          participantActor.actor_user_id,
        );
      }

      // Ověření, že už není spoluřešitelem
      const part = await participantRepo.findByTaskAndUser(
        testTask.id,
        participantActor.actor_user_id,
      );
      assert.strictEqual(part, null);
    });

    test("non-member cannot take over task", async () => {
      const useCase = new TakeOverTaskUseCase(uow);
      const res = await useCase.execute(nonMemberActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "NOT_A_MEMBER");
      }
    });

    test("takeOverTaskSchema validates taskId", () => {
      const valid = takeOverTaskSchema.safeParse({ taskId: "task-1" });
      assert.strictEqual(valid.success, true);

      const invalid = takeOverTaskSchema.safeParse({ taskId: "" });
      assert.strictEqual(invalid.success, false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. JoinTaskAsParticipantUseCase
  // ───────────────────────────────────────────────────────────
  describe("3. JoinTaskAsParticipantUseCase", () => {
    test("regular member joins as participant when task has assignee", async () => {
      const useCase = new JoinTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(regularMemberActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(
          res.data.userId,
          regularMemberActor.actor_user_id,
        );
      }

      const p = await participantRepo.findByTaskAndUser(
        testTask.id,
        regularMemberActor.actor_user_id,
      );
      assert.ok(p !== null);
    });

    test("joining fails if user is already a participant (conflict)", async () => {
      const useCase = new JoinTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(participantActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ConflictError);
      }
    });

    test("assignee cannot join as participant to own task", async () => {
      const useCase = new JoinTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(assigneeActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ConflictError);
      }
    });

    test("cannot join task without assignee (TASK_HAS_NO_ASSIGNEE)", async () => {
      await taskRepo.update(testTask.id, { assigneeId: null });

      const useCase = new JoinTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(regularMemberActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "TASK_HAS_NO_ASSIGNEE");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. LeaveTaskAsParticipantUseCase
  // ───────────────────────────────────────────────────────────
  describe("4. LeaveTaskAsParticipantUseCase", () => {
    test("participant leaves task successfully", async () => {
      const useCase = new LeaveTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(participantActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, true);

      const p = await participantRepo.findByTaskAndUser(
        testTask.id,
        participantActor.actor_user_id,
      );
      assert.strictEqual(p, null);
    });

    test("non-participant leaving returns NotFoundError", async () => {
      const useCase = new LeaveTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(regularMemberActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 5. RemoveTaskParticipantUseCase
  // ───────────────────────────────────────────────────────────
  describe("5. RemoveTaskParticipantUseCase", () => {
    test("assignee can remove participant", async () => {
      const useCase = new RemoveTaskParticipantUseCase(uow);
      const res = await useCase.execute(assigneeActor, {
        taskId: testTask.id,
        targetUserId: participantActor.actor_user_id,
      });

      assert.strictEqual(res.success, true);
      const p = await participantRepo.findByTaskAndUser(
        testTask.id,
        participantActor.actor_user_id,
      );
      assert.strictEqual(p, null);
    });

    test("owner and manager can remove participant", async () => {
      const useCase = new RemoveTaskParticipantUseCase(uow);
      const res = await useCase.execute(managerActor, {
        taskId: testTask.id,
        targetUserId: participantActor.actor_user_id,
      });

      assert.strictEqual(res.success, true);
    });

    test("regular member cannot remove participant (INSUFFICIENT_ROLE)", async () => {
      const useCase = new RemoveTaskParticipantUseCase(uow);
      const res = await useCase.execute(regularMemberActor, {
        taskId: testTask.id,
        targetUserId: participantActor.actor_user_id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("removing non-participant returns NotFoundError", async () => {
      const useCase = new RemoveTaskParticipantUseCase(uow);
      const res = await useCase.execute(assigneeActor, {
        taskId: testTask.id,
        targetUserId: "unknown-user",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 6. ArchiveTaskUseCase
  // ───────────────────────────────────────────────────────────
  describe("6. ArchiveTaskUseCase", () => {
    test("assignee can archive task", async () => {
      const useCase = new ArchiveTaskUseCase(uow);
      const res = await useCase.execute(assigneeActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "ARCHIVOVÁNO");
      }
    });

    test("manager and owner can archive task", async () => {
      const useCase = new ArchiveTaskUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "ARCHIVOVÁNO");
      }
    });

    test("regular member cannot archive task", async () => {
      const useCase = new ArchiveTaskUseCase(uow);
      const res = await useCase.execute(regularMemberActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("archive rejects on soft-deleted board", async () => {
      await boardRepo.softDelete(testBoard.id, new Date());

      const useCase = new ArchiveTaskUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: testTask.id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "BOARD_DELETED");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 7. DeleteTaskUseCase
  // ───────────────────────────────────────────────────────────
  describe("7. DeleteTaskUseCase", () => {
    test("owner can delete task with exact SMAZAT confirmation", async () => {
      const useCase = new DeleteTaskUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: testTask.id,
        confirmation: "SMAZAT",
      });

      assert.strictEqual(res.success, true);

      // Úkol musí být z repozitáře odstraněn
      const deleted = await taskRepo.findById(testTask.id);
      assert.strictEqual(deleted, null);
    });

    test("deleteTask cascades deletion of participants", async () => {
      const useCase = new DeleteTaskUseCase(uow);
      const res = await useCase.execute(assigneeActor, {
        taskId: testTask.id,
        confirmation: "SMAZAT",
      });

      assert.strictEqual(res.success, true);

      // Účastníci musí být odstraněni
      const parts = await participantRepo.findByTaskId(testTask.id);
      assert.strictEqual(parts.length, 0);
    });

    test("deleteTask fails when confirmation is not SMAZAT", async () => {
      const useCase = new DeleteTaskUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: testTask.id,
        confirmation: "smazat", // malá písmena
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });

    test("regular member cannot delete task", async () => {
      const useCase = new DeleteTaskUseCase(uow);
      const res = await useCase.execute(regularMemberActor, {
        taskId: testTask.id,
        confirmation: "SMAZAT",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("deleteTaskSchema requires confirmation to be exactly SMAZAT", () => {
      const valid = deleteTaskSchema.safeParse({
        taskId: "task-1",
        confirmation: "SMAZAT",
      });
      assert.strictEqual(valid.success, true);

      const invalid = deleteTaskSchema.safeParse({
        taskId: "task-1",
        confirmation: "POTVRDIT",
      });
      assert.strictEqual(invalid.success, false);
    });
  });
});
