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
  AreaRecord,
  AreaRepository,
  CreateAreaData,
  UpdateAreaData,
} from "../../modules/areas/application/ports/index.ts";
import type {
  CreateTaskData,
  TaskRecord,
  TaskRepository,
  UpdateTaskData,
  TaskParticipantRecord,
  TaskParticipantRepository,
} from "../../modules/tasks/application/ports/index.ts";
import {
  CreateTaskUseCase,
  UpdateTaskUseCase,
  ChangeTaskAssigneeUseCase,
  TakeOverTaskUseCase,
  JoinTaskAsParticipantUseCase,
  LeaveTaskAsParticipantUseCase,
  RemoveTaskParticipantUseCase,
  ChangeTaskStatusUseCase,
  ChangeTaskAreaUseCase,
  ChangeTaskDueDateUseCase,
  ChangeTaskPriorityUseCase,
  ArchiveTaskUseCase,
  DeleteTaskUseCase,
} from "../../modules/tasks/application/use-cases/index.ts";
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// Test In-Memory Repositories
// ─────────────────────────────────────────────────────────────

class InMemoryAreaRepository implements AreaRepository {
  public store = new Map<string, AreaRecord>();

  async findById(id: string): Promise<AreaRecord | null> {
    const r = this.store.get(id);
    return r ? { ...r } : null;
  }

  async findByBoardAndName(
    boardId: string,
    name: string,
  ): Promise<AreaRecord | null> {
    for (const r of this.store.values()) {
      if (r.boardId === boardId && r.name === name) {
        return { ...r };
      }
    }
    return null;
  }

  async findByBoardId(boardId: string): Promise<AreaRecord[]> {
    return Array.from(this.store.values()).filter((r) => r.boardId === boardId);
  }

  async create(data: CreateAreaData): Promise<AreaRecord> {
    const id = data.id ?? `area-${crypto.randomUUID()}`;
    const record: AreaRecord = {
      id,
      boardId: data.boardId,
      name: data.name,
      description: data.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(id, record);
    return { ...record };
  }

  async update(id: string, data: UpdateAreaData): Promise<AreaRecord> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`Area not found: ${id}`);
    }
    const updated: AreaRecord = {
      ...existing,
      name: data.name !== undefined ? data.name : existing.name,
      description:
        data.description !== undefined
          ? data.description
          : existing.description,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  clone(): Map<string, AreaRecord> {
    return new Map(this.store);
  }

  restore(snap: Map<string, AreaRecord>): void {
    this.store = new Map(snap);
  }
}

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

  async softDelete(boardId: string, deletedAt: Date): Promise<void> {
    const r = this.store.get(boardId);
    if (r) {
      this.store.set(boardId, { ...r, deletedAt });
    }
  }
}

class InMemoryMembershipRepository implements MembershipRepository {
  public store = new Map<string, MembershipRecord>();

  async findByBoardAndUser(
    boardId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    for (const r of this.store.values()) {
      if (r.boardId === boardId && r.userId === userId) {
        return { ...r };
      }
    }
    return null;
  }

  async findByBoardId(boardId: string): Promise<MembershipRecord[]> {
    return Array.from(this.store.values()).filter((m) => m.boardId === boardId);
  }

  async findMembershipsByBoard(boardId: string): Promise<MembershipRecord[]> {
    return this.findByBoardId(boardId);
  }

  async create(data: {
    boardId: string;
    userId: string;
    role: "OWNER" | "MANAGER" | "MEMBER";
  }): Promise<MembershipRecord> {
    const id = `member-${crypto.randomUUID()}`;
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
        this.store.set(id, { ...r, role: newRole });
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

class InMemoryUserRepository implements UserRepository {
  public store = new Map<string, UserRecord>();

  async findById(userId: string): Promise<UserRecord | null> {
    const u = this.store.get(userId);
    return u ? { ...u } : null;
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
      status: data.status ?? "NOVÉ",
      priority: data.priority ?? "BĚŽNÁ",
      dueDate: data.dueDate ?? null,
      createdBy: data.createdBy,
      assigneeId: data.assigneeId ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    };
    this.store.set(id, record);
    return { ...record };
  }

  async update(id: string, data: UpdateTaskData): Promise<TaskRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Task not found");
    const updated: TaskRecord = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  clone(): Map<string, TaskRecord> {
    return new Map(this.store);
  }

  restore(snap: Map<string, TaskRecord>): void {
    this.store = new Map(snap);
  }
}

class InMemoryTaskParticipantRepository implements TaskParticipantRepository {
  public store = new Map<string, TaskParticipantRecord>();

  async findByTaskId(taskId: string): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values()).filter((p) => p.taskId === taskId);
  }

  async findByTaskAndUser(
    taskId: string,
    userId: string,
  ): Promise<TaskParticipantRecord | null> {
    for (const p of this.store.values()) {
      if (p.taskId === taskId && p.userId === userId) {
        return { ...p };
      }
    }
    return null;
  }

  async addParticipant(
    taskId: string,
    userId: string,
    role?: string,
  ): Promise<TaskParticipantRecord> {
    const id = `part-${crypto.randomUUID()}`;
    const record: TaskParticipantRecord = {
      id,
      taskId,
      userId,
      role: role ?? "CONTRIBUTOR",
      createdAt: new Date(),
    };
    this.store.set(id, record);
    return { ...record };
  }

  async removeParticipant(taskId: string, userId: string): Promise<void> {
    for (const [id, p] of this.store.entries()) {
      if (p.taskId === taskId && p.userId === userId) {
        this.store.delete(id);
        return;
      }
    }
  }

  async removeAllForTask(taskId: string): Promise<void> {
    for (const [id, p] of this.store.entries()) {
      if (p.taskId === taskId) {
        this.store.delete(id);
      }
    }
  }

  clone(): Map<string, TaskParticipantRecord> {
    return new Map(this.store);
  }

  restore(snap: Map<string, TaskParticipantRecord>): void {
    this.store = new Map(snap);
  }
}

class InMemoryUnitOfWork implements UnitOfWork {
  public readonly boards: InMemoryBoardRepository;
  public readonly memberships: InMemoryMembershipRepository;
  public readonly users: InMemoryUserRepository;
  public readonly areas: InMemoryAreaRepository;
  public readonly tasks: InMemoryTaskRepository;
  public readonly taskParticipants: InMemoryTaskParticipantRepository;

  constructor(
    boards: InMemoryBoardRepository,
    memberships: InMemoryMembershipRepository,
    users: InMemoryUserRepository,
    areas: InMemoryAreaRepository,
    tasks: InMemoryTaskRepository,
    taskParticipants: InMemoryTaskParticipantRepository,
  ) {
    this.boards = boards;
    this.memberships = memberships;
    this.users = users;
    this.areas = areas;
    this.tasks = tasks;
    this.taskParticipants = taskParticipants;
  }

  async runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    const taskSnap = this.tasks.clone();
    const partSnap = this.taskParticipants.clone();
    const areaSnap = this.areas.clone();
    try {
      return await work({
        boards: this.boards,
        memberships: this.memberships,
        users: this.users,
        areas: this.areas,
        tasks: this.tasks,
        taskParticipants: this.taskParticipants,
      });
    } catch (err) {
      this.tasks.restore(taskSnap);
      this.taskParticipants.restore(partSnap);
      this.areas.restore(areaSnap);
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────

describe("STEP 19 – Task Use Cases", () => {
  let boardsRepo: InMemoryBoardRepository;
  let membershipsRepo: InMemoryMembershipRepository;
  let usersRepo: InMemoryUserRepository;
  let areasRepo: InMemoryAreaRepository;
  let tasksRepo: InMemoryTaskRepository;
  let participantsRepo: InMemoryTaskParticipantRepository;
  let uow: InMemoryUnitOfWork;

  const boardId = "board-1";
  const otherBoardId = "board-2";

  const ownerUser: UserRecord = {
    id: "user-owner",
    name: "Owner User",
    email: "owner@test.cz",
    globalRole: "USER",
    isActive: true,
    deletedAt: null,
  };

  const managerUser: UserRecord = {
    id: "user-manager",
    name: "Manager User",
    email: "manager@test.cz",
    globalRole: "USER",
    isActive: true,
    deletedAt: null,
  };

  const memberUser1: UserRecord = {
    id: "user-member-1",
    name: "Member User 1",
    email: "member1@test.cz",
    globalRole: "USER",
    isActive: true,
    deletedAt: null,
  };

  const memberUser2: UserRecord = {
    id: "user-member-2",
    name: "Member User 2",
    email: "member2@test.cz",
    globalRole: "USER",
    isActive: true,
    deletedAt: null,
  };

  const adminUser: UserRecord = {
    id: "user-admin",
    name: "Admin User",
    email: "admin@test.cz",
    globalRole: "ADMIN",
    isActive: true,
    deletedAt: null,
  };

  const nonMemberUser: UserRecord = {
    id: "user-non-member",
    name: "Non Member",
    email: "nonmember@test.cz",
    globalRole: "USER",
    isActive: true,
    deletedAt: null,
  };

  const inactiveUser: UserRecord = {
    id: "user-inactive",
    name: "Inactive User",
    email: "inactive@test.cz",
    globalRole: "USER",
    isActive: false,
    deletedAt: null,
  };

  const makeActor = (user: UserRecord): ActorContext => ({
    actor_user_id: user.id,
    global_role: user.globalRole,
    is_active: user.isActive,
    session_id: `sess-${user.id}`,
  });

  const ownerActor = makeActor(ownerUser);
  const managerActor = makeActor(managerUser);
  const memberActor1 = makeActor(memberUser1);
  const memberActor2 = makeActor(memberUser2);
  const adminActor = makeActor(adminUser);
  const nonMemberActor = makeActor(nonMemberUser);
  const inactiveActor = makeActor(inactiveUser);

  beforeEach(async () => {
    boardsRepo = new InMemoryBoardRepository();
    membershipsRepo = new InMemoryMembershipRepository();
    usersRepo = new InMemoryUserRepository();
    areasRepo = new InMemoryAreaRepository();
    tasksRepo = new InMemoryTaskRepository();
    participantsRepo = new InMemoryTaskParticipantRepository();
    uow = new InMemoryUnitOfWork(
      boardsRepo,
      membershipsRepo,
      usersRepo,
      areasRepo,
      tasksRepo,
      participantsRepo,
    );

    // Register users
    for (const u of [
      ownerUser,
      managerUser,
      memberUser1,
      memberUser2,
      adminUser,
      nonMemberUser,
      inactiveUser,
    ]) {
      usersRepo.store.set(u.id, u);
    }

    // Create Board 1
    await boardsRepo.create({
      id: boardId,
      name: "Projekt Alfa",
      createdBy: ownerUser.id,
    });

    // Create Board 2
    await boardsRepo.create({
      id: otherBoardId,
      name: "Projekt Beta",
      createdBy: ownerUser.id,
    });

    // Memberships for Board 1
    await membershipsRepo.create({
      boardId,
      userId: ownerUser.id,
      role: "OWNER",
    });
    await membershipsRepo.create({
      boardId,
      userId: managerUser.id,
      role: "MANAGER",
    });
    await membershipsRepo.create({
      boardId,
      userId: memberUser1.id,
      role: "MEMBER",
    });
    await membershipsRepo.create({
      boardId,
      userId: memberUser2.id,
      role: "MEMBER",
    });

    // Create default Area on Board 1
    await areasRepo.create({
      id: "area-1",
      boardId,
      name: "Backend",
    });

    // Create default Area on Board 2
    await areasRepo.create({
      id: "area-board-2",
      boardId: otherBoardId,
      name: "Marketing",
    });
  });

  // ───────────────────────────────────────────────────────────
  // 1. CreateTaskUseCase
  // ───────────────────────────────────────────────────────────
  describe("1. CreateTaskUseCase", () => {
    test("rejects unauthenticated or inactive actor", async () => {
      const useCase = new CreateTaskUseCase(uow);

      const resNull = await useCase.execute(null, {
        boardId,
        title: "Úkol 1",
      });
      assert.strictEqual(resNull.success, false);
      if (!resNull.success) {
        assert.ok(resNull.error instanceof AuthenticationError);
      }

      const resInactive = await useCase.execute(inactiveActor, {
        boardId,
        title: "Úkol 1",
      });
      assert.strictEqual(resInactive.success, false);
      if (!resInactive.success) {
        assert.ok(resInactive.error instanceof AuthenticationError);
      }
    });

    test("rejects if board is soft-deleted", async () => {
      await boardsRepo.softDelete(boardId, new Date());
      const useCase = new CreateTaskUseCase(uow);

      const res = await useCase.execute(ownerActor, {
        boardId,
        title: "Úkol 1",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "BOARD_DELETED");
      }
    });

    test("rejects non-member actor", async () => {
      const useCase = new CreateTaskUseCase(uow);

      const res = await useCase.execute(nonMemberActor, {
        boardId,
        title: "Úkol 1",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "NOT_A_MEMBER");
      }
    });

    test("creates task with default status and priority by MEMBER", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        boardId,
        title: "Nový úkol",
        description: "Popis úkolu",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.title, "Nový úkol");
        assert.strictEqual(res.data.description, "Popis úkolu");
        assert.strictEqual(res.data.status, "NOVÉ");
        assert.strictEqual(res.data.priority, "BĚŽNÁ");
        assert.strictEqual(res.data.createdBy, memberUser1.id);
        assert.strictEqual(res.data.assigneeId, null);
        assert.strictEqual(res.data.areaId, null);
        assert.strictEqual(res.data.dueDate, null);
        assert.strictEqual(res.data.completedAt, null);
      }
    });

    test("creates task with area, priority SPĚCHÁ, and valid assignee by MANAGER", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const dueDate = new Date("2026-10-15T00:00:00Z");

      const res = await useCase.execute(managerActor, {
        boardId,
        title: "Kritický úkol",
        areaId: "area-1",
        priority: "SPĚCHÁ",
        assigneeId: memberUser1.id,
        dueDate,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.title, "Kritický úkol");
        assert.strictEqual(res.data.areaId, "area-1");
        assert.strictEqual(res.data.priority, "SPĚCHÁ");
        assert.strictEqual(res.data.assigneeId, memberUser1.id);
        assert.deepStrictEqual(res.data.dueDate, dueDate);
      }
    });

    test("ADMIN can create task even if not a board member", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const res = await useCase.execute(adminActor, {
        boardId,
        title: "Admin úkol",
      });
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.title, "Admin úkol");
      }
    });

    test("rejects cross-board area", async () => {
      const useCase = new CreateTaskUseCase(uow);

      const res = await useCase.execute(ownerActor, {
        boardId,
        title: "Úkol s cizí oblastí",
        areaId: "area-board-2",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "CROSS_BOARD_ACCESS");
      }
    });

    test("rejects cross-board assignee (non-member of board)", async () => {
      const useCase = new CreateTaskUseCase(uow);

      const res = await useCase.execute(ownerActor, {
        boardId,
        title: "Úkol s nečlenem",
        assigneeId: nonMemberUser.id,
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "CROSS_BOARD_ACCESS");
      }
    });

    test("rejects inactive assignee", async () => {
      await membershipsRepo.create({
        boardId,
        userId: inactiveUser.id,
        role: "MEMBER",
      });
      const useCase = new CreateTaskUseCase(uow);

      const res = await useCase.execute(ownerActor, {
        boardId,
        title: "Úkol s neaktivním uživatelem",
        assigneeId: inactiveUser.id,
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. UpdateTaskUseCase
  // ───────────────────────────────────────────────────────────
  describe("2. UpdateTaskUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Původní název",
        description: "Původní popis",
        createdBy: ownerUser.id,
      });
      taskId = t.id;
    });

    test("rejects unauthenticated or inactive actor", async () => {
      const useCase = new UpdateTaskUseCase(uow);
      const resNull = await useCase.execute(null, {
        taskId,
        title: "Změna",
      });
      assert.strictEqual(resNull.success, false);
      if (!resNull.success) {
        assert.ok(resNull.error instanceof AuthenticationError);
      }

      const resInactive = await useCase.execute(inactiveActor, {
        taskId,
        title: "Změna",
      });
      assert.strictEqual(resInactive.success, false);
      if (!resInactive.success) {
        assert.ok(resInactive.error instanceof AuthenticationError);
      }
    });

    test("rejects non-existent task", async () => {
      const useCase = new UpdateTaskUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: "unknown-id",
        title: "Změna",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });

    test("member can update title and description", async () => {
      const useCase = new UpdateTaskUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        taskId,
        title: "Nový název",
        description: "Nový popis",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.title, "Nový název");
        assert.strictEqual(res.data.description, "Nový popis");
      }
    });

    test("non-member cannot update task", async () => {
      const useCase = new UpdateTaskUseCase(uow);
      const res = await useCase.execute(nonMemberActor, {
        taskId,
        title: "Změna",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "NOT_A_MEMBER");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. ChangeTaskAssigneeUseCase
  // ───────────────────────────────────────────────────────────
  describe("3. ChangeTaskAssigneeUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol k přiřazení",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
      });
      taskId = t.id;
    });

    test("assigns task to another member", async () => {
      const useCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await useCase.execute(managerActor, {
        taskId,
        assigneeId: memberUser2.id,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.assigneeId, memberUser2.id);
      }
    });

    test("rejects non-member as assignee", async () => {
      const useCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId,
        assigneeId: nonMemberUser.id,
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "CROSS_BOARD_ACCESS");
      }
    });

    test("setting assignee to null clears assignee AND removes all participants", async () => {
      await participantsRepo.addParticipant(taskId, memberUser2.id);
      const participantsBefore = await participantsRepo.findByTaskId(taskId);
      assert.strictEqual(participantsBefore.length, 1);

      const useCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId,
        assigneeId: null,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.assigneeId, null);
      }
      const participantsAfter = await participantsRepo.findByTaskId(taskId);
      assert.strictEqual(participantsAfter.length, 0);
    });

    test("if new assignee was a participant, removes them from participants", async () => {
      await participantsRepo.addParticipant(taskId, memberUser2.id);
      const useCase = new ChangeTaskAssigneeUseCase(uow);

      const res = await useCase.execute(ownerActor, {
        taskId,
        assigneeId: memberUser2.id,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.assigneeId, memberUser2.id);
      }
      const remaining = await participantsRepo.findByTaskAndUser(
        taskId,
        memberUser2.id,
      );
      assert.strictEqual(remaining, null);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. TakeOverTaskUseCase
  // ───────────────────────────────────────────────────────────
  describe("4. TakeOverTaskUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol k převzetí",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
      });
      taskId = t.id;
    });

    test("member takes over task from another assignee", async () => {
      const useCase = new TakeOverTaskUseCase(uow);
      const res = await useCase.execute(memberActor2, { taskId });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.assigneeId, memberUser2.id);
      }
    });

    test("taking over removes actor from participants if they were one", async () => {
      await participantsRepo.addParticipant(taskId, memberUser2.id);
      const useCase = new TakeOverTaskUseCase(uow);

      const res = await useCase.execute(memberActor2, { taskId });
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.assigneeId, memberUser2.id);
      }

      const part = await participantsRepo.findByTaskAndUser(
        taskId,
        memberUser2.id,
      );
      assert.strictEqual(part, null);
    });

    test("non-member cannot take over task", async () => {
      const useCase = new TakeOverTaskUseCase(uow);
      const res = await useCase.execute(nonMemberActor, { taskId });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "NOT_A_MEMBER");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 5. JoinTaskAsParticipantUseCase
  // ───────────────────────────────────────────────────────────
  describe("5. JoinTaskAsParticipantUseCase", () => {
    test("rejects if task has no assignee", async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Bez řešitele",
        createdBy: ownerUser.id,
        assigneeId: null,
      });

      const useCase = new JoinTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(memberActor1, { taskId: t.id });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "TASK_HAS_NO_ASSIGNEE");
      }
    });

    test("rejects if assignee tries to join as participant", async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol s řešitelem",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
      });

      const useCase = new JoinTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(memberActor1, { taskId: t.id });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ConflictError);
      }
    });

    test("member joins as participant successfully", async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol s řešitelem",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
      });

      const useCase = new JoinTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(memberActor2, { taskId: t.id });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.taskId, t.id);
        assert.strictEqual(res.data.userId, memberUser2.id);
      }
    });

    test("duplicate join throws ConflictError", async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol s řešitelem",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
      });

      await participantsRepo.addParticipant(t.id, memberUser2.id);
      const useCase = new JoinTaskAsParticipantUseCase(uow);

      const res = await useCase.execute(memberActor2, { taskId: t.id });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ConflictError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 6. LeaveTaskAsParticipantUseCase
  // ───────────────────────────────────────────────────────────
  describe("6. LeaveTaskAsParticipantUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol se spoluřešitelem",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
      });
      taskId = t.id;
      await participantsRepo.addParticipant(taskId, memberUser2.id);
    });

    test("participant leaves successfully", async () => {
      const useCase = new LeaveTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(memberActor2, { taskId });

      assert.strictEqual(res.success, true);
      const remaining = await participantsRepo.findByTaskAndUser(
        taskId,
        memberUser2.id,
      );
      assert.strictEqual(remaining, null);
    });

    test("non-participant leaving returns NotFoundError", async () => {
      const useCase = new LeaveTaskAsParticipantUseCase(uow);
      const res = await useCase.execute(managerActor, { taskId });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 7. RemoveTaskParticipantUseCase
  // ───────────────────────────────────────────────────────────
  describe("7. RemoveTaskParticipantUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol k odebrání spoluřešitele",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
      });
      taskId = t.id;
      await participantsRepo.addParticipant(taskId, memberUser2.id);
    });

    test("assignee can remove participant", async () => {
      const useCase = new RemoveTaskParticipantUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        taskId,
        targetUserId: memberUser2.id,
      });

      assert.strictEqual(res.success, true);
      const p = await participantsRepo.findByTaskAndUser(
        taskId,
        memberUser2.id,
      );
      assert.strictEqual(p, null);
    });

    test("manager can remove participant", async () => {
      const useCase = new RemoveTaskParticipantUseCase(uow);
      const res = await useCase.execute(managerActor, {
        taskId,
        targetUserId: memberUser2.id,
      });

      assert.strictEqual(res.success, true);
      const p = await participantsRepo.findByTaskAndUser(
        taskId,
        memberUser2.id,
      );
      assert.strictEqual(p, null);
    });

    test("owner can remove participant", async () => {
      const useCase = new RemoveTaskParticipantUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId,
        targetUserId: memberUser2.id,
      });

      assert.strictEqual(res.success, true);
      const p = await participantsRepo.findByTaskAndUser(
        taskId,
        memberUser2.id,
      );
      assert.strictEqual(p, null);
    });

    test("regular member who is not assignee cannot remove participant", async () => {
      const user3: UserRecord = {
        id: "user-member-3",
        name: "Member 3",
        email: "member3@test.cz",
        globalRole: "USER",
        isActive: true,
        deletedAt: null,
      };
      usersRepo.store.set(user3.id, user3);
      await membershipsRepo.create({
        boardId,
        userId: user3.id,
        role: "MEMBER",
      });
      const memberActor3 = makeActor(user3);

      const useCase = new RemoveTaskParticipantUseCase(uow);
      const res = await useCase.execute(memberActor3, {
        taskId,
        targetUserId: memberUser2.id,
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("non-existent participant returns NotFoundError", async () => {
      const useCase = new RemoveTaskParticipantUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId,
        targetUserId: "unknown-user",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 8. ChangeTaskStatusUseCase
  // ───────────────────────────────────────────────────────────
  describe("8. ChangeTaskStatusUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol se stavem",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
        status: "NOVÉ",
      });
      taskId = t.id;
    });

    test("assignee can change status to ROZPRACOVANÉ", async () => {
      const useCase = new ChangeTaskStatusUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        taskId,
        newStatus: "ROZPRACOVANÉ",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "ROZPRACOVANÉ");
        assert.strictEqual(res.data.completedAt, null);
      }
    });

    test("changing status to HOTOVO sets completedAt", async () => {
      const useCase = new ChangeTaskStatusUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        taskId,
        newStatus: "HOTOVO",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "HOTOVO");
        assert(res.data.completedAt instanceof Date);
      }
    });

    test("changing status away from HOTOVO clears completedAt", async () => {
      const useCase = new ChangeTaskStatusUseCase(uow);
      await useCase.execute(memberActor1, {
        taskId,
        newStatus: "HOTOVO",
      });

      const res = await useCase.execute(memberActor1, {
        taskId,
        newStatus: "ROZPRACOVANÉ",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "ROZPRACOVANÉ");
        assert.strictEqual(res.data.completedAt, null);
      }
    });

    test("regular member who is not assignee or participant cannot change status", async () => {
      const useCase = new ChangeTaskStatusUseCase(uow);
      const res = await useCase.execute(memberActor2, {
        taskId,
        newStatus: "ROZPRACOVANÉ",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 9. ChangeTaskAreaUseCase
  // ───────────────────────────────────────────────────────────
  describe("9. ChangeTaskAreaUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol s oblastí",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
        areaId: "area-1",
      });
      taskId = t.id;
    });

    test("manager can remove area (set to null)", async () => {
      const useCase = new ChangeTaskAreaUseCase(uow);
      const res = await useCase.execute(managerActor, {
        taskId,
        newAreaId: null,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.areaId, null);
      }
    });

    test("rejects area from different board", async () => {
      const useCase = new ChangeTaskAreaUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId,
        newAreaId: "area-board-2",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "CROSS_BOARD_ACCESS");
      }
    });

    test("rejects non-existent area", async () => {
      const useCase = new ChangeTaskAreaUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId,
        newAreaId: "non-existent-area",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 10. ChangeTaskDueDateUseCase
  // ───────────────────────────────────────────────────────────
  describe("10. ChangeTaskDueDateUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol s termínem",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
      });
      taskId = t.id;
    });

    test("sets valid Date", async () => {
      const useCase = new ChangeTaskDueDateUseCase(uow);
      const targetDate = new Date("2026-11-20T12:00:00Z");
      const res = await useCase.execute(memberActor1, {
        taskId,
        dueDate: targetDate,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.deepStrictEqual(res.data.dueDate, targetDate);
      }
    });

    test("sets date from valid ISO string", async () => {
      const useCase = new ChangeTaskDueDateUseCase(uow);
      const dateStr = "2026-11-20T12:00:00.000Z";
      const res = await useCase.execute(memberActor1, {
        taskId,
        dueDate: dateStr,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.deepStrictEqual(res.data.dueDate, new Date(dateStr));
      }
    });

    test("clears date with null", async () => {
      const useCase = new ChangeTaskDueDateUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        taskId,
        dueDate: null,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.dueDate, null);
      }
    });

    test("rejects invalid date string", async () => {
      const useCase = new ChangeTaskDueDateUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        taskId,
        dueDate: "invalid-date",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 11. ChangeTaskPriorityUseCase
  // ───────────────────────────────────────────────────────────
  describe("11. ChangeTaskPriorityUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol s prioritou",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
        priority: "BĚŽNÁ",
      });
      taskId = t.id;
    });

    test("changes priority to SPĚCHÁ", async () => {
      const useCase = new ChangeTaskPriorityUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        taskId,
        priority: "SPĚCHÁ",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.priority, "SPĚCHÁ");
      }
    });

    test("changes priority back to BĚŽNÁ", async () => {
      const useCase = new ChangeTaskPriorityUseCase(uow);
      await useCase.execute(memberActor1, {
        taskId,
        priority: "SPĚCHÁ",
      });

      const res = await useCase.execute(memberActor1, {
        taskId,
        priority: "BĚŽNÁ",
      });
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.priority, "BĚŽNÁ");
      }
    });

    test("rejects invalid priority string", async () => {
      const useCase = new ChangeTaskPriorityUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        taskId,
        // @ts-expect-error Testing invalid value
        priority: "NEPLATNA",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 12. ArchiveTaskUseCase
  // ───────────────────────────────────────────────────────────
  describe("12. ArchiveTaskUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol k archivaci",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
        status: "ROZPRACOVANÉ",
      });
      taskId = t.id;
    });

    test("assignee can archive task", async () => {
      const useCase = new ArchiveTaskUseCase(uow);
      const res = await useCase.execute(memberActor1, { taskId });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "ARCHIVOVÁNO");
      }
    });

    test("manager can archive task", async () => {
      const useCase = new ArchiveTaskUseCase(uow);
      const res = await useCase.execute(managerActor, { taskId });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.status, "ARCHIVOVÁNO");
      }
    });

    test("member who is not assignee cannot archive task", async () => {
      const useCase = new ArchiveTaskUseCase(uow);
      const res = await useCase.execute(memberActor2, { taskId });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 13. DeleteTaskUseCase
  // ───────────────────────────────────────────────────────────
  describe("13. DeleteTaskUseCase", () => {
    let taskId: string;

    beforeEach(async () => {
      const t = await tasksRepo.create({
        boardId,
        title: "Úkol ke smazání",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
      });
      taskId = t.id;
      await participantsRepo.addParticipant(taskId, memberUser2.id);
    });

    test("rejects if confirmation is not 'SMAZAT'", async () => {
      const useCase = new DeleteTaskUseCase(uow);

      const resWrong = await useCase.execute(ownerActor, {
        taskId,
        confirmation: "DELETE",
      });
      assert.strictEqual(resWrong.success, false);
      if (!resWrong.success) {
        assert.ok(resWrong.error instanceof ValidationError);
      }

      const resEmpty = await useCase.execute(ownerActor, {
        taskId,
        confirmation: "",
      });
      assert.strictEqual(resEmpty.success, false);
      if (!resEmpty.success) {
        assert.ok(resEmpty.error instanceof ValidationError);
      }
    });

    test("owner can delete task with confirmation 'SMAZAT'", async () => {
      const useCase = new DeleteTaskUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId,
        confirmation: "SMAZAT",
      });
      assert.strictEqual(res.success, true);

      const deletedTask = await tasksRepo.findById(taskId);
      assert.strictEqual(deletedTask, null);

      const participants = await participantsRepo.findByTaskId(taskId);
      assert.strictEqual(participants.length, 0);
    });

    test("assignee can delete task with confirmation 'SMAZAT'", async () => {
      const useCase = new DeleteTaskUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        taskId,
        confirmation: "SMAZAT",
      });
      assert.strictEqual(res.success, true);

      const deletedTask = await tasksRepo.findById(taskId);
      assert.strictEqual(deletedTask, null);
    });

    test("regular member who is not assignee or participant cannot delete task", async () => {
      // Add third member who is NOT assignee and NOT participant
      const user3: UserRecord = {
        id: "user-member-3",
        name: "Member 3",
        email: "member3@test.cz",
        globalRole: "USER",
        isActive: true,
        deletedAt: null,
      };
      usersRepo.store.set(user3.id, user3);
      await membershipsRepo.create({
        boardId,
        userId: user3.id,
        role: "MEMBER",
      });
      const memberActor3 = makeActor(user3);

      const useCase = new DeleteTaskUseCase(uow);
      const res = await useCase.execute(memberActor3, {
        taskId,
        confirmation: "SMAZAT",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("rejects deleting non-existent task", async () => {
      const useCase = new DeleteTaskUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId,
        confirmation: "SMAZAT",
      });
      // Delete once
      assert.strictEqual(res.success, true);

      // Delete again
      const resSecond = await useCase.execute(ownerActor, {
        taskId,
        confirmation: "SMAZAT",
      });
      assert.strictEqual(resSecond.success, false);
      if (!resSecond.success) {
        assert.ok(resSecond.error instanceof NotFoundError);
      }
    });
  });
});
