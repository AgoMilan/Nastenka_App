import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type {
  BoardRecord,
  BoardRepository,
  CreateBoardData,
  CreateMembershipData,
  MembershipRecord,
  MembershipRepository,
  UnitOfWork,
  UnitOfWorkRepositories,
  UserRecord,
  UserRepository,
  BoardRole,
} from "../../modules/boards/application/ports/index.ts";
import type {
  AreaRecord,
  AreaRepository,
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
  AddMemberUseCase,
  RemoveMemberUseCase,
  ChangeMemberRoleUseCase,
} from "../../modules/membership/application/use-cases/index.ts";
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

  async create(data: CreateMembershipData): Promise<MembershipRecord> {
    const id = data.id ?? `member-${crypto.randomUUID()}`;
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
    newRole: BoardRole,
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

  clone(): Map<string, MembershipRecord> {
    return new Map(this.store);
  }

  restore(snap: Map<string, MembershipRecord>): void {
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
  public readonly areas?: AreaRepository;
  public readonly tasks?: InMemoryTaskRepository;
  public readonly taskParticipants?: InMemoryTaskParticipantRepository;

  constructor(
    boards: InMemoryBoardRepository,
    memberships: InMemoryMembershipRepository,
    users: InMemoryUserRepository,
    tasks?: InMemoryTaskRepository,
    taskParticipants?: InMemoryTaskParticipantRepository,
  ) {
    this.boards = boards;
    this.memberships = memberships;
    this.users = users;
    this.tasks = tasks;
    this.taskParticipants = taskParticipants;
  }

  async runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    const memSnap = this.memberships.clone();
    const taskSnap = this.tasks ? this.tasks.clone() : null;
    const partSnap = this.taskParticipants
      ? this.taskParticipants.clone()
      : null;
    try {
      return await work({
        boards: this.boards,
        memberships: this.memberships,
        users: this.users,
        tasks: this.tasks,
        taskParticipants: this.taskParticipants,
      });
    } catch (err) {
      this.memberships.restore(memSnap);
      if (taskSnap && this.tasks) this.tasks.restore(taskSnap);
      if (partSnap && this.taskParticipants)
        this.taskParticipants.restore(partSnap);
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────

describe("STEP 1 – Membership Use Cases", () => {
  let boardsRepo: InMemoryBoardRepository;
  let membershipsRepo: InMemoryMembershipRepository;
  let usersRepo: InMemoryUserRepository;
  let tasksRepo: InMemoryTaskRepository;
  let participantsRepo: InMemoryTaskParticipantRepository;
  let uow: InMemoryUnitOfWork;

  const boardId = "board-test-1";

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

  const candidateUser: UserRecord = {
    id: "user-candidate",
    name: "Candidate User",
    email: "candidate@test.cz",
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

  const adminUser: UserRecord = {
    id: "user-admin",
    name: "Admin User",
    email: "admin@test.cz",
    globalRole: "ADMIN",
    isActive: true,
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
  const candidateActor = makeActor(candidateUser);
  const adminActor = makeActor(adminUser);
  const inactiveActor = makeActor(inactiveUser);

  beforeEach(async () => {
    boardsRepo = new InMemoryBoardRepository();
    membershipsRepo = new InMemoryMembershipRepository();
    usersRepo = new InMemoryUserRepository();
    tasksRepo = new InMemoryTaskRepository();
    participantsRepo = new InMemoryTaskParticipantRepository();

    uow = new InMemoryUnitOfWork(
      boardsRepo,
      membershipsRepo,
      usersRepo,
      tasksRepo,
      participantsRepo,
    );

    // Register users
    for (const u of [
      ownerUser,
      managerUser,
      memberUser1,
      candidateUser,
      inactiveUser,
      adminUser,
    ]) {
      usersRepo.store.set(u.id, u);
    }

    // Create Board
    await boardsRepo.create({
      id: boardId,
      name: "Týmová Nástěnka",
      createdBy: ownerUser.id,
    });

    // Memberships for Board
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
  });

  // ───────────────────────────────────────────────────────────
  // 1. AddMemberUseCase
  // ───────────────────────────────────────────────────────────
  describe("1. AddMemberUseCase", () => {
    test("rejects unauthenticated or inactive actor", async () => {
      const useCase = new AddMemberUseCase(uow);

      const resNull = await useCase.execute(null, {
        boardId,
        targetUserId: candidateUser.id,
      });
      assert.strictEqual(resNull.success, false);
      if (!resNull.success) {
        assert.ok(resNull.error instanceof AuthenticationError);
      }

      const resInactive = await useCase.execute(inactiveActor, {
        boardId,
        targetUserId: candidateUser.id,
      });
      assert.strictEqual(resInactive.success, false);
      if (!resInactive.success) {
        assert.ok(resInactive.error instanceof AuthenticationError);
      }
    });

    test("rejects empty boardId or targetUserId", async () => {
      const useCase = new AddMemberUseCase(uow);

      const resEmptyBoard = await useCase.execute(ownerActor, {
        boardId: "",
        targetUserId: candidateUser.id,
      });
      assert.strictEqual(resEmptyBoard.success, false);
      if (!resEmptyBoard.success) {
        assert.ok(resEmptyBoard.error instanceof ValidationError);
      }

      const resEmptyTarget = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: "   ",
      });
      assert.strictEqual(resEmptyTarget.success, false);
      if (!resEmptyTarget.success) {
        assert.ok(resEmptyTarget.error instanceof ValidationError);
      }
    });

    test("rejects non-existent board", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId: "unknown-board",
        targetUserId: candidateUser.id,
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });

    test("rejects soft-deleted board", async () => {
      await boardsRepo.softDelete(boardId, new Date());
      const useCase = new AddMemberUseCase(uow);

      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: candidateUser.id,
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "BOARD_DELETED");
      }
    });

    test("rejects non-existent target user", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: "non-existent-user",
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });

    test("rejects inactive target user", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: inactiveUser.id,
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });

    test("rejects if target user is already a member", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: memberUser1.id,
      });
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ConflictError);
      }
    });

    test("OWNER can add user as MEMBER (default role)", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: candidateUser.id,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.userId, candidateUser.id);
        assert.strictEqual(res.data.boardId, boardId);
        assert.strictEqual(res.data.role, "MEMBER");
      }

      const inRepo = await membershipsRepo.findByBoardAndUser(
        boardId,
        candidateUser.id,
      );
      assert.ok(inRepo !== null);
      assert.strictEqual(inRepo.role, "MEMBER");
    });

    test("MANAGER can add user as MEMBER", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(managerActor, {
        boardId,
        targetUserId: candidateUser.id,
        role: "MEMBER",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.role, "MEMBER");
      }
    });

    test("MANAGER cannot add user as MANAGER", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(managerActor, {
        boardId,
        targetUserId: candidateUser.id,
        role: "MANAGER",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "MANAGER_LIMIT_EXCEEDED");
      }
    });

    test("regular MEMBER cannot add members", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        boardId,
        targetUserId: candidateUser.id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("adding with role OWNER is rejected (OWNERSHIP_TRANSFER_REQUIRED)", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: candidateUser.id,
        role: "OWNER",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "OWNERSHIP_TRANSFER_REQUIRED");
      }
    });

    test("adding second MANAGER is rejected (MANAGER_LIMIT_EXCEEDED)", async () => {
      // managerUser is already MANAGER on boardId
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: candidateUser.id,
        role: "MANAGER",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "MANAGER_LIMIT_EXCEEDED");
      }
    });

    test("OWNER can add MANAGER when no existing manager is present", async () => {
      // Remove existing manager first
      await membershipsRepo.delete(boardId, managerUser.id);

      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: candidateUser.id,
        role: "MANAGER",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.role, "MANAGER");
      }
    });

    test("ADMIN can add member even without board membership", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(adminActor, {
        boardId,
        targetUserId: candidateUser.id,
        role: "MEMBER",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.role, "MEMBER");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. RemoveMemberUseCase
  // ───────────────────────────────────────────────────────────
  describe("2. RemoveMemberUseCase", () => {
    test("rejects unauthenticated or inactive actor", async () => {
      const useCase = new RemoveMemberUseCase(uow);

      const resNull = await useCase.execute(null, {
        boardId,
        targetUserId: memberUser1.id,
      });
      assert.strictEqual(resNull.success, false);
      if (!resNull.success) {
        assert.ok(resNull.error instanceof AuthenticationError);
      }

      const resInactive = await useCase.execute(inactiveActor, {
        boardId,
        targetUserId: memberUser1.id,
      });
      assert.strictEqual(resInactive.success, false);
      if (!resInactive.success) {
        assert.ok(resInactive.error instanceof AuthenticationError);
      }
    });

    test("rejects non-existent board or soft-deleted board", async () => {
      const useCase = new RemoveMemberUseCase(uow);

      const res404 = await useCase.execute(ownerActor, {
        boardId: "non-existent-board",
        targetUserId: memberUser1.id,
      });
      assert.strictEqual(res404.success, false);
      if (!res404.success) {
        assert.ok(res404.error instanceof NotFoundError);
      }

      await boardsRepo.softDelete(boardId, new Date());
      const resDel = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: memberUser1.id,
      });
      assert.strictEqual(resDel.success, false);
      if (!resDel.success) {
        assert.ok(resDel.error instanceof AuthorizationError);
        assert.strictEqual(resDel.error.reason, "BOARD_DELETED");
      }
    });

    test("rejects removing user who is not a member", async () => {
      const useCase = new RemoveMemberUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: candidateUser.id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });

    test("cannot remove sole OWNER (CANNOT_REMOVE_SOLE_OWNER) by OWNER or ADMIN", async () => {
      const useCase = new RemoveMemberUseCase(uow);

      // OWNER tries to remove self
      const resOwner = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: ownerUser.id,
      });
      assert.strictEqual(resOwner.success, false);
      if (!resOwner.success) {
        assert.ok(resOwner.error instanceof AuthorizationError);
        assert.strictEqual(resOwner.error.reason, "CANNOT_REMOVE_SOLE_OWNER");
      }

      // ADMIN tries to remove sole OWNER
      const resAdmin = await useCase.execute(adminActor, {
        boardId,
        targetUserId: ownerUser.id,
      });
      assert.strictEqual(resAdmin.success, false);
      if (!resAdmin.success) {
        assert.ok(resAdmin.error instanceof AuthorizationError);
        assert.strictEqual(resAdmin.error.reason, "CANNOT_REMOVE_SOLE_OWNER");
      }
    });

    test("OWNER can remove MEMBER and MANAGER", async () => {
      const useCase = new RemoveMemberUseCase(uow);

      // Remove Member
      const res1 = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: memberUser1.id,
      });
      assert.strictEqual(res1.success, true);
      assert.strictEqual(
        await membershipsRepo.findByBoardAndUser(boardId, memberUser1.id),
        null,
      );

      // Remove Manager
      const res2 = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: managerUser.id,
      });
      assert.strictEqual(res2.success, true);
      assert.strictEqual(
        await membershipsRepo.findByBoardAndUser(boardId, managerUser.id),
        null,
      );
    });

    test("MANAGER can remove MEMBER, but not another MANAGER", async () => {
      const useCase = new RemoveMemberUseCase(uow);

      // Manager removes Member -> ALLOW
      const res1 = await useCase.execute(managerActor, {
        boardId,
        targetUserId: memberUser1.id,
      });
      assert.strictEqual(res1.success, true);

      // Manager tries to remove Manager (self or other) -> DENY
      const res2 = await useCase.execute(managerActor, {
        boardId,
        targetUserId: managerUser.id,
      });
      assert.strictEqual(res2.success, false);
      if (!res2.success) {
        assert.ok(res2.error instanceof AuthorizationError);
        assert.strictEqual(res2.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("regular MEMBER cannot administratively remove another member", async () => {
      const useCase = new RemoveMemberUseCase(uow);
      const res = await useCase.execute(memberActor1, {
        boardId,
        targetUserId: managerUser.id,
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("ADMIN can remove non-owner member", async () => {
      const useCase = new RemoveMemberUseCase(uow);
      const res = await useCase.execute(adminActor, {
        boardId,
        targetUserId: memberUser1.id,
      });

      assert.strictEqual(res.success, true);
      assert.strictEqual(
        await membershipsRepo.findByBoardAndUser(boardId, memberUser1.id),
        null,
      );
    });

    test("cascade task cleanup: unassigns member and clears participants", async () => {
      // Create a task where memberUser1 is assignee and managerUser is participant
      const task = await tasksRepo.create({
        boardId,
        title: "Důležitý úkol",
        createdBy: ownerUser.id,
        assigneeId: memberUser1.id,
      });
      await participantsRepo.addParticipant(task.id, managerUser.id);
      await participantsRepo.addParticipant(task.id, memberUser1.id);

      const useCase = new RemoveMemberUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: memberUser1.id,
      });

      assert.strictEqual(res.success, true);

      // Task assignee should now be null
      const updatedTask = await tasksRepo.findById(task.id);
      assert.ok(updatedTask !== null);
      assert.strictEqual(updatedTask.assigneeId, null);

      // Task has no assignee, so its participants must be cleaned up
      const participants = await participantsRepo.findByTaskId(task.id);
      assert.strictEqual(participants.length, 0);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. ChangeMemberRoleUseCase
  // ───────────────────────────────────────────────────────────
  describe("3. ChangeMemberRoleUseCase", () => {
    test("rejects unauthenticated or inactive actor", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);

      const resNull = await useCase.execute(null, {
        boardId,
        targetUserId: memberUser1.id,
        newRole: "MANAGER",
      });
      assert.strictEqual(resNull.success, false);
      if (!resNull.success) {
        assert.ok(resNull.error instanceof AuthenticationError);
      }

      const resInactive = await useCase.execute(inactiveActor, {
        boardId,
        targetUserId: memberUser1.id,
        newRole: "MANAGER",
      });
      assert.strictEqual(resInactive.success, false);
      if (!resInactive.success) {
        assert.ok(resInactive.error instanceof AuthenticationError);
      }
    });

    test("rejects non-existent board or non-existent member", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);

      const res404Board = await useCase.execute(ownerActor, {
        boardId: "non-existent-board",
        targetUserId: memberUser1.id,
        newRole: "MANAGER",
      });
      assert.strictEqual(res404Board.success, false);
      if (!res404Board.success) {
        assert.ok(res404Board.error instanceof NotFoundError);
      }

      const res404User = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: candidateUser.id,
        newRole: "MANAGER",
      });
      assert.strictEqual(res404User.success, false);
      if (!res404User.success) {
        assert.ok(res404User.error instanceof NotFoundError);
      }
    });

    test("idempotence: changing to the same role returns immediately without DB update", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: memberUser1.id,
        newRole: "MEMBER",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.role, "MEMBER");
      }
    });

    test("cannot promote to OWNER via ChangeMemberRole (OWNERSHIP_TRANSFER_REQUIRED)", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);

      const resOwner = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: memberUser1.id,
        newRole: "OWNER",
      });
      assert.strictEqual(resOwner.success, false);
      if (!resOwner.success) {
        assert.ok(resOwner.error instanceof AuthorizationError);
        assert.strictEqual(
          resOwner.error.reason,
          "OWNERSHIP_TRANSFER_REQUIRED",
        );
      }

      const resAdmin = await useCase.execute(adminActor, {
        boardId,
        targetUserId: memberUser1.id,
        newRole: "OWNER",
      });
      assert.strictEqual(resAdmin.success, false);
      if (!resAdmin.success) {
        assert.ok(resAdmin.error instanceof AuthorizationError);
        assert.strictEqual(
          resAdmin.error.reason,
          "OWNERSHIP_TRANSFER_REQUIRED",
        );
      }
    });

    test("cannot demote sole OWNER to MEMBER or MANAGER (CANNOT_DEMOTE_SOLE_OWNER)", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);

      const resOwner = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: ownerUser.id,
        newRole: "MEMBER",
      });
      assert.strictEqual(resOwner.success, false);
      if (!resOwner.success) {
        assert.ok(resOwner.error instanceof AuthorizationError);
        assert.strictEqual(resOwner.error.reason, "CANNOT_DEMOTE_SOLE_OWNER");
      }

      const resAdmin = await useCase.execute(adminActor, {
        boardId,
        targetUserId: ownerUser.id,
        newRole: "MANAGER",
      });
      assert.strictEqual(resAdmin.success, false);
      if (!resAdmin.success) {
        assert.ok(resAdmin.error instanceof AuthorizationError);
        assert.strictEqual(resAdmin.error.reason, "CANNOT_DEMOTE_SOLE_OWNER");
      }
    });

    test("rejects promoting MEMBER to MANAGER when another MANAGER already exists", async () => {
      // managerUser already has role MANAGER
      const useCase = new ChangeMemberRoleUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: memberUser1.id,
        newRole: "MANAGER",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(res.error.reason, "MANAGER_LIMIT_EXCEEDED");
      }
    });

    test("OWNER can demote MANAGER to MEMBER", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: managerUser.id,
        newRole: "MEMBER",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.role, "MEMBER");
      }

      const inRepo = await membershipsRepo.findByBoardAndUser(
        boardId,
        managerUser.id,
      );
      assert.strictEqual(inRepo?.role, "MEMBER");
    });

    test("OWNER can promote MEMBER to MANAGER once previous manager is demoted", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);

      // 1. Demote manager
      await useCase.execute(ownerActor, {
        boardId,
        targetUserId: managerUser.id,
        newRole: "MEMBER",
      });

      // 2. Promote member to manager
      const res = await useCase.execute(ownerActor, {
        boardId,
        targetUserId: memberUser1.id,
        newRole: "MANAGER",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.role, "MANAGER");
      }
    });

    test("MANAGER and regular MEMBER cannot change roles", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);

      const resManager = await useCase.execute(managerActor, {
        boardId,
        targetUserId: memberUser1.id,
        newRole: "MEMBER",
      });
      assert.strictEqual(resManager.success, false);
      if (!resManager.success) {
        assert.ok(resManager.error instanceof AuthorizationError);
        assert.strictEqual(resManager.error.reason, "INSUFFICIENT_ROLE");
      }

      const resMember = await useCase.execute(memberActor1, {
        boardId,
        targetUserId: managerUser.id,
        newRole: "MEMBER",
      });
      assert.strictEqual(resMember.success, false);
      if (!resMember.success) {
        assert.ok(resMember.error instanceof AuthorizationError);
        assert.strictEqual(resMember.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("ADMIN can change member roles adhering to invariants", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);

      // Admin demotes manager
      const res1 = await useCase.execute(adminActor, {
        boardId,
        targetUserId: managerUser.id,
        newRole: "MEMBER",
      });
      assert.strictEqual(res1.success, true);

      // Admin promotes member to manager
      const res2 = await useCase.execute(adminActor, {
        boardId,
        targetUserId: memberUser1.id,
        newRole: "MANAGER",
      });
      assert.strictEqual(res2.success, true);
      if (res2.success) {
        assert.strictEqual(res2.data.role, "MANAGER");
      }
    });
  });
});
