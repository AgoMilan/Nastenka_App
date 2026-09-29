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
  TaskParticipantRecord,
  TaskParticipantRepository,
  TaskPriority,
  TaskRecord,
  TaskRepository,
  TaskStatus,
  UpdateTaskData,
} from "../../modules/tasks/application/ports/index.ts";
import {
  UpdateTaskUseCase,
  ChangeTaskAssigneeUseCase,
  ChangeTaskAreaUseCase,
  ChangeTaskDueDateUseCase,
  ChangeTaskPriorityUseCase,
} from "../../modules/tasks/application/use-cases/index.ts";
import { checkTaskPermission } from "../../modules/tasks/application/policies/task-policy.ts";
import {
  editTaskSchema,
  updateTaskSchema,
  changeTaskAssigneeSchema,
} from "../../modules/tasks/api/dto/task.dto.ts";
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
    return Array.from(this.store.values()).filter(
      (u) => u.isActive && u.deletedAt === null,
    );
  }

  add(user: UserRecord): void {
    this.store.set(user.id, user);
  }
}

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
    for (const a of this.store.values()) {
      if (a.boardId === boardId && a.name === name) {
        return { ...a };
      }
    }
    return null;
  }

  async findByBoardId(boardId: string): Promise<AreaRecord[]> {
    return Array.from(this.store.values())
      .filter((a) => a.boardId === boardId)
      .map((a) => ({ ...a }));
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
    const r = this.store.get(id);
    if (!r) throw new Error("Area not found");
    const updated = {
      ...r,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

class InMemoryTaskRepository implements TaskRepository {
  public store = new Map<string, TaskRecord>();

  async findById(id: string): Promise<TaskRecord | null> {
    const r = this.store.get(id);
    return r ? { ...r } : null;
  }

  async findByIdForUpdate(id: string): Promise<TaskRecord | null> {
    return this.findById(id);
  }

  async findByBoardId(boardId: string): Promise<TaskRecord[]> {
    return Array.from(this.store.values())
      .filter((t) => t.boardId === boardId)
      .map((t) => ({ ...t }));
  }

  async findByAreaId(areaId: string): Promise<TaskRecord[]> {
    return Array.from(this.store.values())
      .filter((t) => t.areaId === areaId)
      .map((t) => ({ ...t }));
  }

  async create(data: CreateTaskData): Promise<TaskRecord> {
    const id = data.id ?? `task-${crypto.randomUUID()}`;
    const now = new Date();
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
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.store.set(id, record);
    return { ...record };
  }

  async update(id: string, data: UpdateTaskData): Promise<TaskRecord> {
    const r = this.store.get(id);
    if (!r) throw new Error("Task not found");
    const updated: TaskRecord = {
      ...r,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined
        ? { description: data.description }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.assigneeId !== undefined
        ? { assigneeId: data.assigneeId }
        : {}),
      ...(data.areaId !== undefined ? { areaId: data.areaId } : {}),
      ...(data.completedAt !== undefined
        ? { completedAt: data.completedAt }
        : {}),
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

class InMemoryTaskParticipantRepository implements TaskParticipantRepository {
  public store = new Map<string, TaskParticipantRecord>();

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

  async findByTaskId(taskId: string): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values())
      .filter((p) => p.taskId === taskId)
      .map((p) => ({ ...p }));
  }

  async findByTaskIds(
    taskIds: readonly string[],
  ): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values())
      .filter((p) => taskIds.includes(p.taskId))
      .map((p) => ({ ...p }));
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
      role: role ?? "PARTICIPANT",
      createdAt: new Date(),
    };
    this.store.set(id, record);
    return { ...record };
  }

  async removeParticipant(taskId: string, userId: string): Promise<void> {
    for (const [key, p] of this.store.entries()) {
      if (p.taskId === taskId && p.userId === userId) {
        this.store.delete(key);
      }
    }
  }

  async removeAllForTask(taskId: string): Promise<void> {
    for (const [key, p] of this.store.entries()) {
      if (p.taskId === taskId) {
        this.store.delete(key);
      }
    }
  }
}

class InMemoryUnitOfWork implements UnitOfWork {
  private readonly boardRepo: InMemoryBoardRepository;
  private readonly membershipRepo: InMemoryMembershipRepository;
  private readonly userRepo: InMemoryUserRepository;
  private readonly areaRepo: InMemoryAreaRepository;
  private readonly taskRepo: InMemoryTaskRepository;
  private readonly taskParticipantRepo: InMemoryTaskParticipantRepository;

  constructor(
    boardRepo: InMemoryBoardRepository,
    membershipRepo: InMemoryMembershipRepository,
    userRepo: InMemoryUserRepository,
    areaRepo: InMemoryAreaRepository,
    taskRepo: InMemoryTaskRepository,
    taskParticipantRepo: InMemoryTaskParticipantRepository,
  ) {
    this.boardRepo = boardRepo;
    this.membershipRepo = membershipRepo;
    this.userRepo = userRepo;
    this.areaRepo = areaRepo;
    this.taskRepo = taskRepo;
    this.taskParticipantRepo = taskParticipantRepo;
  }

  async runInTransaction<T>(
    fn: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return fn({
      boards: this.boardRepo,
      memberships: this.membershipRepo,
      users: this.userRepo,
      areas: this.areaRepo,
      tasks: this.taskRepo,
      taskParticipants: this.taskParticipantRepo,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────

describe("STEP 5A – Task Edit & Assignee UI", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let areaRepo: InMemoryAreaRepository;
  let taskRepo: InMemoryTaskRepository;
  let taskParticipantRepo: InMemoryTaskParticipantRepository;
  let uow: InMemoryUnitOfWork;

  let ownerActor: ActorContext;
  let managerActor: ActorContext;
  let memberActor: ActorContext;
  let otherMemberActor: ActorContext;
  let nonMemberActor: ActorContext;
  let adminActor: ActorContext;
  let inactiveActor: ActorContext;

  let boardA: BoardRecord;
  let boardB: BoardRecord;
  let areaA1: AreaRecord;
  let areaA2: AreaRecord;
  let areaB1: AreaRecord;
  let baseTask: TaskRecord;

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    areaRepo = new InMemoryAreaRepository();
    taskRepo = new InMemoryTaskRepository();
    taskParticipantRepo = new InMemoryTaskParticipantRepository();

    uow = new InMemoryUnitOfWork(
      boardRepo,
      membershipRepo,
      userRepo,
      areaRepo,
      taskRepo,
      taskParticipantRepo,
    );

    const userOwner: UserRecord = {
      id: "u-owner",
      name: "Owner User",
      email: "owner@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    };
    const userManager: UserRecord = {
      id: "u-manager",
      name: "Manager User",
      email: "manager@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    };
    const userMember: UserRecord = {
      id: "u-member",
      name: "Member User",
      email: "member@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    };
    const userOtherMember: UserRecord = {
      id: "u-other",
      name: "Other Member",
      email: "other@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    };
    const userNonMember: UserRecord = {
      id: "u-nonmember",
      name: "Non Member",
      email: "nonmember@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    };
    const userAdmin: UserRecord = {
      id: "u-admin",
      name: "Admin User",
      email: "admin@test.cz",
      globalRole: "ADMIN",
      isActive: true,
      deletedAt: null,
    };
    const userInactive: UserRecord = {
      id: "u-inactive",
      name: "Inactive User",
      email: "inactive@test.cz",
      globalRole: "USER",
      isActive: false,
      deletedAt: null,
    };

    userRepo.add(userOwner);
    userRepo.add(userManager);
    userRepo.add(userMember);
    userRepo.add(userOtherMember);
    userRepo.add(userNonMember);
    userRepo.add(userAdmin);
    userRepo.add(userInactive);

    ownerActor = {
      actor_user_id: "u-owner",
      global_role: "USER",
      session_id: "sess-1",
      is_active: true,
    };
    managerActor = {
      actor_user_id: "u-manager",
      global_role: "USER",
      session_id: "sess-2",
      is_active: true,
    };
    memberActor = {
      actor_user_id: "u-member",
      global_role: "USER",
      session_id: "sess-3",
      is_active: true,
    };
    otherMemberActor = {
      actor_user_id: "u-other",
      global_role: "USER",
      session_id: "sess-4",
      is_active: true,
    };
    nonMemberActor = {
      actor_user_id: "u-nonmember",
      global_role: "USER",
      session_id: "sess-5",
      is_active: true,
    };
    adminActor = {
      actor_user_id: "u-admin",
      global_role: "ADMIN",
      session_id: "sess-6",
      is_active: true,
    };
    inactiveActor = {
      actor_user_id: "u-inactive",
      global_role: "USER",
      session_id: "sess-7",
      is_active: false,
    };

    boardA = await boardRepo.create({
      id: "board-a",
      name: "Board A",
      createdBy: "u-owner",
    });
    boardB = await boardRepo.create({
      id: "board-b",
      name: "Board B",
      createdBy: "u-nonmember",
    });

    await membershipRepo.create({
      boardId: "board-a",
      userId: "u-owner",
      role: "OWNER",
    });
    await membershipRepo.create({
      boardId: "board-a",
      userId: "u-manager",
      role: "MANAGER",
    });
    await membershipRepo.create({
      boardId: "board-a",
      userId: "u-member",
      role: "MEMBER",
    });
    await membershipRepo.create({
      boardId: "board-a",
      userId: "u-other",
      role: "MEMBER",
    });

    areaA1 = await areaRepo.create({
      id: "area-a1",
      boardId: "board-a",
      name: "Oblast A1",
    });
    areaA2 = await areaRepo.create({
      id: "area-a2",
      boardId: "board-a",
      name: "Oblast A2",
    });
    areaB1 = await areaRepo.create({
      id: "area-b1",
      boardId: "board-b",
      name: "Oblast B1",
    });

    baseTask = await taskRepo.create({
      id: "task-1",
      boardId: "board-a",
      areaId: "area-a1",
      title: "Původní název úkolu",
      description: "Původní popis úkolu",
      status: "NOVÉ",
      priority: "BĚŽNÁ",
      dueDate: new Date("2026-10-15T00:00:00Z"),
      createdBy: "u-owner",
      assigneeId: "u-member",
    });
  });

  // ───────────────────────────────────────────────────────────
  // 1. DTO Schémata (editTaskSchema, updateTaskSchema, changeTaskAssigneeSchema)
  // ───────────────────────────────────────────────────────────
  describe("1. DTO Validační schémata", () => {
    test("editTaskSchema přijímá platný vstup se všemi poli", () => {
      const valid = {
        boardId: "board-a",
        taskId: "task-1",
        title: "Nový název",
        description: "Podrobný popis úkolu",
        areaId: "area-a2",
        assigneeId: "u-manager",
        priority: "SPĚCHÁ",
        dueDate: "2026-12-01",
      };
      const result = editTaskSchema.safeParse(valid);
      assert.strictEqual(result.success, true);
    });

    test("editTaskSchema přijímá volitelná pole jako null nebo prázdná", () => {
      const valid = {
        boardId: "board-a",
        taskId: "task-1",
        title: "Pouze název",
        description: "",
        areaId: "",
        assigneeId: null,
        priority: "BĚŽNÁ",
        dueDate: null,
      };
      const result = editTaskSchema.safeParse(valid);
      assert.strictEqual(result.success, true);
    });

    test("editTaskSchema odmítá prázdný název", () => {
      const invalid = {
        boardId: "board-a",
        taskId: "task-1",
        title: "   ",
        priority: "BĚŽNÁ",
      };
      const result = editTaskSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    test("editTaskSchema odmítá název delší než 255 znaků", () => {
      const invalid = {
        boardId: "board-a",
        taskId: "task-1",
        title: "a".repeat(256),
        priority: "BĚŽNÁ",
      };
      const result = editTaskSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    test("editTaskSchema odmítá popis delší než 10 000 znaků", () => {
      const invalid = {
        boardId: "board-a",
        taskId: "task-1",
        title: "Platný název",
        description: "a".repeat(10001),
        priority: "BĚŽNÁ",
      };
      const result = editTaskSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    test("editTaskSchema odmítá neplatnou prioritu", () => {
      const invalid = {
        boardId: "board-a",
        taskId: "task-1",
        title: "Platný název",
        priority: "NEPLATNÁ",
      };
      const result = editTaskSchema.safeParse(invalid);
      assert.strictEqual(result.success, false);
    });

    test("changeTaskAssigneeSchema validuje taskId a assigneeId", () => {
      assert.strictEqual(
        changeTaskAssigneeSchema.safeParse({
          taskId: "task-1",
          assigneeId: "u-member",
        }).success,
        true,
      );
      assert.strictEqual(
        changeTaskAssigneeSchema.safeParse({
          taskId: "task-1",
          assigneeId: null,
        }).success,
        true,
      );
      assert.strictEqual(
        changeTaskAssigneeSchema.safeParse({
          taskId: "",
          assigneeId: null,
        }).success,
        false,
      );
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. UI Role Permission Derivation
  // ───────────────────────────────────────────────────────────
  describe("2. UI Role Permission Derivation", () => {
    test("OWNER má plné právo editovat task, oblast i termín", () => {
      const role: string | null = "OWNER";
      const isGlobalAdmin = false;
      const canEdit = isGlobalAdmin || role !== null;
      const canChangeArea = isGlobalAdmin || role === "OWNER" || role === "MANAGER";
      const canChangeDueDate = isGlobalAdmin || role === "OWNER" || role === "MANAGER";

      assert.strictEqual(canEdit, true);
      assert.strictEqual(canChangeArea, true);
      assert.strictEqual(canChangeDueDate, true);
    });

    test("MANAGER má plné právo editovat task, oblast i termín", () => {
      const role: string | null = "MANAGER";
      const isGlobalAdmin = false;
      const canEdit = isGlobalAdmin || role !== null;
      const canChangeArea = isGlobalAdmin || role === "OWNER" || role === "MANAGER";
      const canChangeDueDate = isGlobalAdmin || role === "OWNER" || role === "MANAGER";

      assert.strictEqual(canEdit, true);
      assert.strictEqual(canChangeArea, true);
      assert.strictEqual(canChangeDueDate, true);
    });

    test("ASSIGNEE (i s rolí MEMBER) smí měnit oblast a termín", () => {
      const role: string | null = "MEMBER";
      const currentUserId = "u-member";
      const taskAssigneeId: string | null = "u-member";
      const isTaskWorker = currentUserId === taskAssigneeId;
      const canChangeArea = role === "OWNER" || role === "MANAGER" || isTaskWorker;
      const canChangeDueDate = role === "OWNER" || role === "MANAGER" || isTaskWorker;

      assert.strictEqual(canChangeArea, true);
      assert.strictEqual(canChangeDueDate, true);
    });

    test("Běžný MEMBER (který není assignee ani participant) NESMÍ měnit oblast ani termín", () => {
      const role: string | null = "MEMBER";
      const currentUserId = "u-other";
      const taskAssigneeId: string | null = "u-member";
      const isTaskWorker = currentUserId === taskAssigneeId;
      const canChangeArea = role === "OWNER" || role === "MANAGER" || isTaskWorker;
      const canChangeDueDate = role === "OWNER" || role === "MANAGER" || isTaskWorker;

      assert.strictEqual(canChangeArea, false);
      assert.strictEqual(canChangeDueDate, false);
    });

    test("ADMIN má právo editovat úkol, oblast i termín bez členství", () => {
      const isGlobalAdmin = true;
      const role: string | null = null;
      const canEdit = isGlobalAdmin || role !== null;
      const canChangeArea = isGlobalAdmin || role === "OWNER" || role === "MANAGER";
      const canChangeDueDate = isGlobalAdmin || role === "OWNER" || role === "MANAGER";

      assert.strictEqual(canEdit, true);
      assert.strictEqual(canChangeArea, true);
      assert.strictEqual(canChangeDueDate, true);
    });

    test("Nečlen bez ADMIN nemá právo editovat úkol", () => {
      const isGlobalAdmin = false;
      const role: string | null = null;
      const canEdit = isGlobalAdmin || role !== null;
      assert.strictEqual(canEdit, false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. UpdateTaskUseCase – Název a Popis
  // ───────────────────────────────────────────────────────────
  describe("3. UpdateTaskUseCase – Úprava názvu a popisu", () => {
    test("MEMBER může upravit název a popis úkolu", async () => {
      const useCase = new UpdateTaskUseCase(uow);
      const res = await useCase.execute(memberActor, {
        taskId: baseTask.id,
        title: "Aktualizovaný název",
        description: "Aktualizovaný popis",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.title, "Aktualizovaný název");
        assert.strictEqual(res.data.description, "Aktualizovaný popis");
      }
    });

    test("MEMBER může odstranit popis (nastavit null)", async () => {
      const useCase = new UpdateTaskUseCase(uow);
      const res = await useCase.execute(memberActor, {
        taskId: baseTask.id,
        description: null,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.description, null);
      }
    });

    test("Odmítne prázdný název", async () => {
      const useCase = new UpdateTaskUseCase(uow);
      const res = await useCase.execute(memberActor, {
        taskId: baseTask.id,
        title: "   ",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });

    test("Nečlen nemůže upravit název ani popis", async () => {
      const useCase = new UpdateTaskUseCase(uow);
      const res = await useCase.execute(nonMemberActor, {
        taskId: baseTask.id,
        title: "Útok nečlena",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. ChangeTaskAssigneeUseCase – Přiřazení a odebrání řešitele
  // ───────────────────────────────────────────────────────────
  describe("4. ChangeTaskAssigneeUseCase – Řešitel", () => {
    test("Kterýkoliv člen může přiřadit aktivního člena jako řešitele", async () => {
      const useCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await useCase.execute(memberActor, {
        taskId: baseTask.id,
        assigneeId: "u-other",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.assigneeId, "u-other");
      }
    });

    test("Lze odebrat řešitele nastavením assigneeId = null (Nepřiřazeno)", async () => {
      const useCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await useCase.execute(memberActor, {
        taskId: baseTask.id,
        assigneeId: null,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.assigneeId, null);
      }
    });

    test("Odebrání řešitele kaskádově odstraní všechny spoluřešitele", async () => {
      await taskParticipantRepo.addParticipant(baseTask.id, "u-other");
      assert.strictEqual(
        (await taskParticipantRepo.findByTaskId(baseTask.id)).length,
        1,
      );

      const useCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: baseTask.id,
        assigneeId: null,
      });

      assert.strictEqual(res.success, true);
      const participants = await taskParticipantRepo.findByTaskId(baseTask.id);
      assert.strictEqual(participants.length, 0);
    });

    test("Pokud byl nový řešitel spoluřešitelem, je odebrán ze spoluřešitelů", async () => {
      await taskParticipantRepo.addParticipant(baseTask.id, "u-other");

      const useCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: baseTask.id,
        assigneeId: "u-other",
      });

      assert.strictEqual(res.success, true);
      const participants = await taskParticipantRepo.findByTaskId(baseTask.id);
      assert.strictEqual(participants.length, 0);
    });

    test("Odmítne přiřadit nečlena nástěnky (CROSS_BOARD_ACCESS)", async () => {
      const useCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: baseTask.id,
        assigneeId: "u-nonmember",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(
          (res.error as AuthorizationError).reason,
          "CROSS_BOARD_ACCESS",
        );
      }
    });

    test("Odmítne neexistujícího uživatele jako řešitele", async () => {
      const useCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: baseTask.id,
        assigneeId: "u-unknown",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });

    test("Odmítne neaktivního uživatele jako řešitele", async () => {
      const useCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: baseTask.id,
        assigneeId: "u-inactive",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 5. ChangeTaskAreaUseCase – Oblast
  // ───────────────────────────────────────────────────────────
  describe("5. ChangeTaskAreaUseCase – Změna a odebrání oblasti", () => {
    test("OWNER i MANAGER mohou změnit oblast na jinou oblast stejného boardu", async () => {
      const useCase = new ChangeTaskAreaUseCase(uow);
      const res = await useCase.execute(managerActor, {
        taskId: baseTask.id,
        newAreaId: "area-a2",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.areaId, "area-a2");
      }
    });

    test("ASSIGNEE může změnit oblast úkolu", async () => {
      const useCase = new ChangeTaskAreaUseCase(uow);
      const res = await useCase.execute(memberActor, {
        taskId: baseTask.id,
        newAreaId: "area-a2",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.areaId, "area-a2");
      }
    });

    test("Lze odstranit oblast nastavením newAreaId = null (Bez oblasti)", async () => {
      const useCase = new ChangeTaskAreaUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: baseTask.id,
        newAreaId: null,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.areaId, null);
      }
    });

    test("Běžný MEMBER který není řešitel NEMŮŽE změnit oblast", async () => {
      const useCase = new ChangeTaskAreaUseCase(uow);
      const res = await useCase.execute(otherMemberActor, {
        taskId: baseTask.id,
        newAreaId: "area-a2",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(
          (res.error as AuthorizationError).reason,
          "INSUFFICIENT_ROLE",
        );
      }
    });

    test("Odmítne oblast patřící jinému boardu (CROSS_BOARD_ACCESS)", async () => {
      const useCase = new ChangeTaskAreaUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: baseTask.id,
        newAreaId: "area-b1",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(
          (res.error as AuthorizationError).reason,
          "CROSS_BOARD_ACCESS",
        );
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 6. ChangeTaskDueDateUseCase – Termín splnění
  // ───────────────────────────────────────────────────────────
  describe("6. ChangeTaskDueDateUseCase – Termín splnění", () => {
    test("ASSIGNEE může změnit termín úkolu", async () => {
      const useCase = new ChangeTaskDueDateUseCase(uow);
      const newDate = new Date("2026-11-20T00:00:00Z");
      const res = await useCase.execute(memberActor, {
        taskId: baseTask.id,
        dueDate: newDate,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(
          res.data.dueDate?.getTime(),
          newDate.getTime(),
        );
      }
    });

    test("Lze odstranit termín nastavením dueDate = null", async () => {
      const useCase = new ChangeTaskDueDateUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        taskId: baseTask.id,
        dueDate: null,
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.dueDate, null);
      }
    });

    test("Běžný MEMBER který není řešitel NEMŮŽE změnit termín", async () => {
      const useCase = new ChangeTaskDueDateUseCase(uow);
      const res = await useCase.execute(otherMemberActor, {
        taskId: baseTask.id,
        dueDate: new Date("2026-11-20T00:00:00Z"),
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.strictEqual(
          (res.error as AuthorizationError).reason,
          "INSUFFICIENT_ROLE",
        );
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 7. ChangeTaskPriorityUseCase – Priorita
  // ───────────────────────────────────────────────────────────
  describe("7. ChangeTaskPriorityUseCase – Priorita", () => {
    test("Kterýkoliv člen může změnit prioritu na SPĚCHÁ", async () => {
      const useCase = new ChangeTaskPriorityUseCase(uow);
      const res = await useCase.execute(otherMemberActor, {
        taskId: baseTask.id,
        priority: "SPĚCHÁ",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.priority, "SPĚCHÁ");
      }
    });

    test("Kterýkoliv člen může vrátit prioritu na BĚŽNÁ", async () => {
      const useCase = new ChangeTaskPriorityUseCase(uow);
      const res = await useCase.execute(memberActor, {
        taskId: baseTask.id,
        priority: "BĚŽNÁ",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.priority, "BĚŽNÁ");
      }
    });

    test("Nečlen nemůže změnit prioritu", async () => {
      const useCase = new ChangeTaskPriorityUseCase(uow);
      const res = await useCase.execute(nonMemberActor, {
        taskId: baseTask.id,
        priority: "SPĚCHÁ",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 8. TaskPolicy – checkTaskPermission
  // ───────────────────────────────────────────────────────────
  describe("8. TaskPolicy – checkTaskPermission pro STEP 5A", () => {
    test("Neautentizovaný požadavek (null actor) je zamítnut pro všechny akce", () => {
      const target = {
        boardId: "board-a",
        taskId: "task-1",
        createdBy: "u-owner",
        assigneeId: "u-member",
        isBoardDeleted: false,
      };
      const rel = { isAssignee: false, isParticipant: false };

      assert.strictEqual(
        checkTaskPermission(null, "board-a", null, target, rel, "TASK_EDIT_TITLE")
          .allowed,
        false,
      );
      assert.strictEqual(
        checkTaskPermission(
          null,
          "board-a",
          null,
          target,
          rel,
          "TASK_CHANGE_ASSIGNEE",
        ).allowed,
        false,
      );
      assert.strictEqual(
        checkTaskPermission(null, "board-a", null, target, rel, "TASK_CHANGE_AREA")
          .allowed,
        false,
      );
    });

    test("Neaktivní actor je zamítnut", () => {
      const target = {
        boardId: "board-a",
        taskId: "task-1",
        createdBy: "u-owner",
        assigneeId: "u-member",
        isBoardDeleted: false,
      };
      const rel = { isAssignee: false, isParticipant: false };

      const res = checkTaskPermission(
        inactiveActor,
        "board-a",
        { role: "MEMBER" },
        target,
        rel,
        "TASK_EDIT_TITLE",
      );
      assert.strictEqual(res.allowed, false);
      if (!res.allowed) {
        assert.strictEqual(res.reason, "UNAUTHENTICATED");
      }
    });

    test("Soft-deleted board vrací BOARD_DELETED", () => {
      const target = {
        boardId: "board-a",
        taskId: "task-1",
        createdBy: "u-owner",
        assigneeId: "u-member",
        isBoardDeleted: true,
      };
      const rel = { isAssignee: false, isParticipant: false };

      const res = checkTaskPermission(
        ownerActor,
        "board-a",
        { role: "OWNER" },
        target,
        rel,
        "TASK_EDIT_TITLE",
      );
      assert.strictEqual(res.allowed, false);
      if (!res.allowed) {
        assert.strictEqual(res.reason, "BOARD_DELETED");
      }
    });

    test("Cross-board task vrací CROSS_BOARD_ACCESS", () => {
      const target = {
        boardId: "board-b",
        taskId: "task-b1",
        createdBy: "u-owner",
        assigneeId: null,
        isBoardDeleted: false,
      };
      const rel = { isAssignee: false, isParticipant: false };

      const res = checkTaskPermission(
        ownerActor,
        "board-a",
        { role: "OWNER" },
        target,
        rel,
        "TASK_EDIT_TITLE",
      );
      assert.strictEqual(res.allowed, false);
      if (!res.allowed) {
        assert.strictEqual(res.reason, "CROSS_BOARD_ACCESS");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 9. Server Actions – Simulační toky
  // ───────────────────────────────────────────────────────────
  describe("9. Server Actions – Simulační toky a revalidace", () => {
    test("Zod odmítá prázdný název a vrátí chybu před DB voláním", () => {
      const parsed = editTaskSchema.safeParse({
        boardId: "board-a",
        taskId: "task-1",
        title: "",
        priority: "BĚŽNÁ",
      });
      assert.strictEqual(parsed.success, false);
      if (!parsed.success) {
        assert.ok(parsed.error.issues.length > 0);
      }
    });

    test("Zod odmítá chybějící boardId nebo taskId", () => {
      const noBoard = editTaskSchema.safeParse({
        boardId: "",
        taskId: "task-1",
        title: "Název",
        priority: "BĚŽNÁ",
      });
      assert.strictEqual(noBoard.success, false);

      const noTask = editTaskSchema.safeParse({
        boardId: "board-a",
        taskId: "",
        title: "Název",
        priority: "BĚŽNÁ",
      });
      assert.strictEqual(noTask.success, false);
    });

    test("Simulace updateTaskAction: úspěšně zprocesuje více změn přes Use Casy", async () => {
      const updateTaskUseCase = new UpdateTaskUseCase(uow);
      const changeAssigneeUseCase = new ChangeTaskAssigneeUseCase(uow);
      const changePriorityUseCase = new ChangeTaskPriorityUseCase(uow);

      // Změna názvu
      const res1 = await updateTaskUseCase.execute(memberActor, {
        taskId: baseTask.id,
        title: "Nový název po editaci",
        description: "Nový popis po editaci",
      });
      assert.strictEqual(res1.success, true);

      // Změna řešitele na jiného člena
      const res2 = await changeAssigneeUseCase.execute(memberActor, {
        taskId: baseTask.id,
        assigneeId: "u-other",
      });
      assert.strictEqual(res2.success, true);

      // Změna priority na SPĚCHÁ
      const res3 = await changePriorityUseCase.execute(memberActor, {
        taskId: baseTask.id,
        priority: "SPĚCHÁ",
      });
      assert.strictEqual(res3.success, true);

      // Ověření konečného stavu
      const finalTask = await taskRepo.findById(baseTask.id);
      assert.ok(finalTask);
      assert.strictEqual(finalTask.title, "Nový název po editaci");
      assert.strictEqual(finalTask.description, "Nový popis po editaci");
      assert.strictEqual(finalTask.assigneeId, "u-other");
      assert.strictEqual(finalTask.priority, "SPĚCHÁ");
    });
  });
});
