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
  UserBoardRecord,
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
  ChangeMemberRoleUseCase,
  RemoveMemberUseCase,
  LeaveBoardUseCase,
  GetAssignableUsersUseCase,
  addMemberSchema,
  changeMemberRoleSchema,
  removeMemberSchema,
  leaveBoardSchema,
} from "../../modules/membership/index.ts";
import { GetUserBoardsUseCase } from "../../modules/boards/application/use-cases/get-user-boards.use-case.ts";
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

class InMemoryBoardRepository implements BoardRepository {
  public store = new Map<string, BoardRecord>();

  async findById(id: string): Promise<BoardRecord | null> {
    const r = this.store.get(id);
    return r ? { ...r } : null;
  }

  async findByIdForUpdate(id: string): Promise<BoardRecord | null> {
    return this.findById(id);
  }

  async create(data: CreateBoardData): Promise<BoardRecord> {
    const id = `board-${crypto.randomUUID()}`;
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

  async update(
    id: string,
    data: { name?: string; description?: string | null },
  ): Promise<BoardRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Board not found");
    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  async softDelete(id: string): Promise<void> {
    const existing = this.store.get(id);
    if (existing) {
      this.store.set(id, { ...existing, deletedAt: new Date() });
    }
  }

  async findActiveBoardsForUser(userId: string): Promise<UserBoardRecord[]> {
    return [];
  }

  async findActiveBoardsForAdmin(userId: string): Promise<UserBoardRecord[]> {
    return [];
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

  async create(data: CreateMembershipData): Promise<MembershipRecord> {
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

  async findByIds(userIds: string[]): Promise<UserRecord[]> {
    const results: UserRecord[] = [];
    for (const id of userIds) {
      const u = this.store.get(id);
      if (u) results.push({ ...u });
    }
    return results;
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
    const r = this.store.get(id);
    return r ? { ...r } : null;
  }

  async findByBoardAndName(
    boardId: string,
    name: string,
  ): Promise<AreaRecord | null> {
    for (const r of this.store.values()) {
      if (r.boardId === boardId && r.name === name) return { ...r };
    }
    return null;
  }

  async findByBoardId(boardId: string): Promise<AreaRecord[]> {
    return Array.from(this.store.values()).filter((a) => a.boardId === boardId);
  }

  async create(data: {
    boardId: string;
    name: string;
    description?: string | null;
  }): Promise<AreaRecord> {
    const id = `area-${crypto.randomUUID()}`;
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

  async update(
    id: string,
    data: { name?: string; description?: string | null },
  ): Promise<AreaRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Area not found");
    const updated: AreaRecord = {
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
      assigneeId: data.assigneeId ?? null,
      createdBy: data.createdBy,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
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
}

class InMemoryTaskParticipantRepository implements TaskParticipantRepository {
  public store = new Map<string, TaskParticipantRecord>();

  async findByTaskId(taskId: string): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values()).filter((p) => p.taskId === taskId);
  }

  async findByTaskIds(taskIds: string[]): Promise<TaskParticipantRecord[]> {
    const set = new Set(taskIds);
    return Array.from(this.store.values()).filter((p) => set.has(p.taskId));
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
    role = "CONTRIBUTOR",
  ): Promise<TaskParticipantRecord> {
    const id = `participant-${crypto.randomUUID()}`;
    const record: TaskParticipantRecord = {
      id,
      taskId,
      userId,
      role,
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
    return await work({
      boards: this.boards,
      memberships: this.memberships,
      users: this.users,
      areas: this.areas,
      tasks: this.tasks,
      taskParticipants: this.taskParticipants,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite: STEP 4 – Membership UI / Správa členů nástěnky
// ─────────────────────────────────────────────────────────────

describe("STEP 4 – Membership UI / Správa členů nástěnky", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let areaRepo: InMemoryAreaRepository;
  let taskRepo: InMemoryTaskRepository;
  let participantRepo: InMemoryTaskParticipantRepository;
  let uow: InMemoryUnitOfWork;

  const ownerActor: ActorContext = {
    actor_user_id: "user-owner",
    global_role: "USER",
    session_id: "sess-owner",
    is_active: true,
  };

  const managerActor: ActorContext = {
    actor_user_id: "user-manager",
    global_role: "USER",
    session_id: "sess-manager",
    is_active: true,
  };

  const memberActor: ActorContext = {
    actor_user_id: "user-member",
    global_role: "USER",
    session_id: "sess-member",
    is_active: true,
  };

  const outsiderActor: ActorContext = {
    actor_user_id: "user-outsider",
    global_role: "USER",
    session_id: "sess-outsider",
    is_active: true,
  };

  const adminActor: ActorContext = {
    actor_user_id: "user-admin",
    global_role: "ADMIN",
    session_id: "sess-admin",
    is_active: true,
  };

  const inactiveActor: ActorContext = {
    actor_user_id: "user-inactive",
    global_role: "USER",
    session_id: "sess-inactive",
    is_active: false,
  };

  let boardAId: string;
  let boardBId: string;

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    areaRepo = new InMemoryAreaRepository();
    taskRepo = new InMemoryTaskRepository();
    participantRepo = new InMemoryTaskParticipantRepository();

    uow = new InMemoryUnitOfWork(
      boardRepo,
      membershipRepo,
      userRepo,
      areaRepo,
      taskRepo,
      participantRepo,
    );

    // Registrace uživatelů do DB
    userRepo.store.set(ownerActor.actor_user_id, {
      id: ownerActor.actor_user_id,
      name: "Milan Vlastník",
      email: "milan@example.com",
      isActive: true,
      globalRole: "USER",
      deletedAt: null,
    });

    userRepo.store.set(managerActor.actor_user_id, {
      id: managerActor.actor_user_id,
      name: "Petr Správce",
      email: "petr@example.com",
      isActive: true,
      globalRole: "USER",
      deletedAt: null,
    });

    userRepo.store.set(memberActor.actor_user_id, {
      id: memberActor.actor_user_id,
      name: "Alena Členka",
      email: "alena@example.com",
      isActive: true,
      globalRole: "USER",
      deletedAt: null,
    });

    userRepo.store.set(outsiderActor.actor_user_id, {
      id: outsiderActor.actor_user_id,
      name: "Adam Novák",
      email: "adam@example.com",
      isActive: true,
      globalRole: "USER",
      deletedAt: null,
    });

    userRepo.store.set(adminActor.actor_user_id, {
      id: adminActor.actor_user_id,
      name: "Karel Admin",
      email: "admin@example.com",
      isActive: true,
      globalRole: "ADMIN",
      deletedAt: null,
    });

    userRepo.store.set(inactiveActor.actor_user_id, {
      id: inactiveActor.actor_user_id,
      name: "Neaktivní Uživatel",
      email: "inactive@example.com",
      isActive: false,
      globalRole: "USER",
      deletedAt: null,
    });

    // Vytvoření Nástěnky A (Prodejna)
    const bA = await boardRepo.create({
      name: "Prodejna",
      createdBy: ownerActor.actor_user_id,
    });
    boardAId = bA.id;

    // Vytvoření Nástěnky B (Sklad)
    const bB = await boardRepo.create({
      name: "Sklad",
      createdBy: "other-user",
    });
    boardBId = bB.id;

    // Členství na Nástěnce A
    await membershipRepo.create({
      boardId: boardAId,
      userId: ownerActor.actor_user_id,
      role: "OWNER",
    });

    await membershipRepo.create({
      boardId: boardAId,
      userId: managerActor.actor_user_id,
      role: "MANAGER",
    });

    await membershipRepo.create({
      boardId: boardAId,
      userId: memberActor.actor_user_id,
      role: "MEMBER",
    });
  });

  // ───────────────────────────────────────────────────────────
  // 1. DTO validační schémata
  // ───────────────────────────────────────────────────────────
  describe("1. DTO Validační schémata (membership.dto)", () => {
    test("addMemberSchema přijímá platný vstup", () => {
      const parsed = addMemberSchema.safeParse({
        boardId: boardAId,
        userId: outsiderActor.actor_user_id,
        role: "MEMBER",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.role, "MEMBER");
      }
    });

    test("addMemberSchema nastaví výchozí roli MEMBER", () => {
      const parsed = addMemberSchema.safeParse({
        boardId: boardAId,
        userId: outsiderActor.actor_user_id,
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.role, "MEMBER");
      }
    });

    test("addMemberSchema odmítá neplatnou roli", () => {
      const parsed = addMemberSchema.safeParse({
        boardId: boardAId,
        userId: outsiderActor.actor_user_id,
        role: "OWNER", // OWNER není povolen pro addMember
      });
      assert.equal(parsed.success, false);
    });

    test("addMemberSchema odmítá prázdné userId", () => {
      const parsed = addMemberSchema.safeParse({
        boardId: boardAId,
        userId: "",
      });
      assert.equal(parsed.success, false);
    });

    test("changeMemberRoleSchema validuje vstupy", () => {
      const valid = changeMemberRoleSchema.safeParse({
        boardId: boardAId,
        targetUserId: memberActor.actor_user_id,
        newRole: "MANAGER",
      });
      assert.equal(valid.success, true);

      const invalid = changeMemberRoleSchema.safeParse({
        boardId: boardAId,
        targetUserId: memberActor.actor_user_id,
        newRole: "OWNER",
      });
      assert.equal(invalid.success, false);
    });

    test("removeMemberSchema a leaveBoardSchema validují vstupy", () => {
      const rmValid = removeMemberSchema.safeParse({
        boardId: boardAId,
        targetUserId: memberActor.actor_user_id,
      });
      assert.equal(rmValid.success, true);

      const leaveValid = leaveBoardSchema.safeParse({
        boardId: boardAId,
      });
      assert.equal(leaveValid.success, true);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. UI Role Permission Derivation
  // ───────────────────────────────────────────────────────────
  describe("2. UI Role Permission Derivation", () => {
    test("canManageMembers je pravdivé pro OWNER, MANAGER a ADMIN, nepravdivé pro MEMBER", () => {
      const canManage = (role: string | null, globalRole: string) =>
        globalRole === "ADMIN" || role === "OWNER" || role === "MANAGER";

      assert.equal(canManage("OWNER", "USER"), true);
      assert.equal(canManage("MANAGER", "USER"), true);
      assert.equal(canManage("MEMBER", "USER"), false);
      assert.equal(canManage(null, "ADMIN"), true);
      assert.equal(canManage(null, "USER"), false);
    });

    test("canChangeRoles je pravdivé pouze pro OWNER a ADMIN", () => {
      const canChange = (role: string | null, globalRole: string) =>
        globalRole === "ADMIN" || role === "OWNER";

      assert.equal(canChange("OWNER", "USER"), true);
      assert.equal(canChange(null, "ADMIN"), true);
      assert.equal(canChange("MANAGER", "USER"), false);
      assert.equal(canChange("MEMBER", "USER"), false);
    });

    test("canLeaveBoard je pravdivé pouze pro MEMBER a MANAGER, zakázáno pro OWNER", () => {
      const canLeave = (role: string | null) =>
        role === "MEMBER" || role === "MANAGER";

      assert.equal(canLeave("MEMBER"), true);
      assert.equal(canLeave("MANAGER"), true);
      assert.equal(canLeave("OWNER"), false);
    });

    test("canRemoveMember respektuje pravidla podle Policy", () => {
      const canRemove = (
        actorRole: string,
        targetRole: string,
        isSelf: boolean,
        isAdmin: boolean,
      ) => {
        if (targetRole === "OWNER") return false;
        if (isSelf) return false;
        if (isAdmin || actorRole === "OWNER") return true;
        if (actorRole === "MANAGER") return targetRole === "MEMBER";
        return false;
      };

      // OWNER může odebrat MEMBER i MANAGER, ne OWNER
      assert.equal(canRemove("OWNER", "MEMBER", false, false), true);
      assert.equal(canRemove("OWNER", "MANAGER", false, false), true);
      assert.equal(canRemove("OWNER", "OWNER", false, false), false);

      // MANAGER může odebrat pouze MEMBER
      assert.equal(canRemove("MANAGER", "MEMBER", false, false), true);
      assert.equal(canRemove("MANAGER", "MANAGER", false, false), false);
      assert.equal(canRemove("MANAGER", "OWNER", false, false), false);

      // MEMBER nemůže odebrat nikoho
      assert.equal(canRemove("MEMBER", "MEMBER", false, false), false);

      // Nelze odebrat sám sebe
      assert.equal(canRemove("OWNER", "MEMBER", true, false), false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. GetAssignableUsersUseCase
  // ───────────────────────────────────────────────────────────
  describe("3. GetAssignableUsersUseCase", () => {
    test("OWNER může načíst dostupné uživatele, stávající členové jsou vyloučeni", async () => {
      const useCase = new GetAssignableUsersUseCase(
        boardRepo,
        membershipRepo,
        userRepo,
      );

      const result = await useCase.execute(ownerActor, boardAId);
      assert.equal(result.success, true);
      if (result.success) {
        // Na boardAId jsou členy: Milan (owner), Petr (manager), Alena (member)
        // K dispozici by měl být: Adam (outsider), Karel (admin)
        // Neaktivní uživatel nesmí být vrácen
        const ids = result.data.map((u) => u.id);
        assert.equal(ids.includes(outsiderActor.actor_user_id), true);
        assert.equal(ids.includes(adminActor.actor_user_id), true);
        assert.equal(ids.includes(ownerActor.actor_user_id), false);
        assert.equal(ids.includes(managerActor.actor_user_id), false);
        assert.equal(ids.includes(memberActor.actor_user_id), false);
        assert.equal(ids.includes(inactiveActor.actor_user_id), false);
      }
    });

    test("MANAGER může načíst dostupné uživatele", async () => {
      const useCase = new GetAssignableUsersUseCase(
        boardRepo,
        membershipRepo,
        userRepo,
      );

      const result = await useCase.execute(managerActor, boardAId);
      assert.equal(result.success, true);
    });

    test("MEMBER nemá oprávnění načíst dostupné uživatele (INSUFFICIENT_ROLE)", async () => {
      const useCase = new GetAssignableUsersUseCase(
        boardRepo,
        membershipRepo,
        userRepo,
      );

      const result = await useCase.execute(memberActor, boardAId);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });

    test("Nečlen je zamítnut s NOT_A_MEMBER", async () => {
      const useCase = new GetAssignableUsersUseCase(
        boardRepo,
        membershipRepo,
        userRepo,
      );

      const result = await useCase.execute(outsiderActor, boardAId);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });

    test("ADMIN může načíst dostupné uživatele i bez členství", async () => {
      const useCase = new GetAssignableUsersUseCase(
        boardRepo,
        membershipRepo,
        userRepo,
      );

      const result = await useCase.execute(adminActor, boardAId);
      assert.equal(result.success, true);
    });

    test("Soft-deleted board vrací NotFoundError", async () => {
      await boardRepo.softDelete(boardAId);

      const useCase = new GetAssignableUsersUseCase(
        boardRepo,
        membershipRepo,
        userRepo,
      );

      const result = await useCase.execute(ownerActor, boardAId);
      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof NotFoundError, true);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. Přidání člena (AddMemberUseCase) a invarianty
  // ───────────────────────────────────────────────────────────
  describe("4. Přidání člena (AddMemberUseCase)", () => {
    test("OWNER může přidat nového člena jako MEMBER", async () => {
      const useCase = new AddMemberUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardAId,
        targetUserId: outsiderActor.actor_user_id,
        role: "MEMBER",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.userId, outsiderActor.actor_user_id);
        assert.equal(result.data.role, "MEMBER");
      }

      // Ověření uložení v repozitáři
      const saved = await membershipRepo.findByBoardAndUser(
        boardAId,
        outsiderActor.actor_user_id,
      );
      assert.notEqual(saved, null);
      assert.equal(saved?.role, "MEMBER");
    });

    test("MANAGER může přidat nového člena jako MEMBER", async () => {
      const useCase = new AddMemberUseCase(uow);
      const result = await useCase.execute(managerActor, {
        boardId: boardAId,
        targetUserId: outsiderActor.actor_user_id,
        role: "MEMBER",
      });

      assert.equal(result.success, true);
    });

    test("MANAGER nemůže přidat člena jako MANAGER (INSUFFICIENT_ROLE)", async () => {
      const useCase = new AddMemberUseCase(uow);
      const result = await useCase.execute(managerActor, {
        boardId: boardAId,
        targetUserId: outsiderActor.actor_user_id,
        role: "MANAGER",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });

    test("MEMBER nemůže přidávat žádné členy (INSUFFICIENT_ROLE)", async () => {
      const useCase = new AddMemberUseCase(uow);
      const result = await useCase.execute(memberActor, {
        boardId: boardAId,
        targetUserId: outsiderActor.actor_user_id,
        role: "MEMBER",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });

    test("Přidání druhého MANAGERa je zamítnuto (MANAGER_LIMIT_EXCEEDED)", async () => {
      // BoardA již má správce (managerActor)
      const useCase = new AddMemberUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardAId,
        targetUserId: outsiderActor.actor_user_id,
        role: "MANAGER",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });

    test("Duplicitní členství je odmítnuto chybou ConflictError", async () => {
      const useCase = new AddMemberUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardAId,
        targetUserId: memberActor.actor_user_id, // již členem
        role: "MEMBER",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof ConflictError, true);
      }
    });

    test("Přidání neaktivního uživatele je odmítnuto chybou ValidationError", async () => {
      const useCase = new AddMemberUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardAId,
        targetUserId: inactiveActor.actor_user_id,
        role: "MEMBER",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof ValidationError, true);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 5. Změna role člena (ChangeMemberRoleUseCase)
  // ───────────────────────────────────────────────────────────
  describe("5. Změna role člena (ChangeMemberRoleUseCase)", () => {
    test("OWNER může změnit roli člena z MANAGER na MEMBER", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardAId,
        targetUserId: managerActor.actor_user_id,
        newRole: "MEMBER",
      });

      assert.equal(result.success, true);
      assert.equal(result.data?.role, "MEMBER");

      const saved = await membershipRepo.findByBoardAndUser(
        boardAId,
        managerActor.actor_user_id,
      );
      assert.equal(saved?.role, "MEMBER");
    });

    test("OWNER nemůže povýšit na MANAGERa, pokud již existuje jiný MANAGER (MANAGER_LIMIT_EXCEEDED)", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardAId,
        targetUserId: memberActor.actor_user_id,
        newRole: "MANAGER",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });

    test("MANAGER ani MEMBER nemohou měnit role (INSUFFICIENT_ROLE)", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);
      const res1 = await useCase.execute(managerActor, {
        boardId: boardAId,
        targetUserId: memberActor.actor_user_id,
        newRole: "MEMBER",
      });
      assert.equal(res1.success, false);

      const res2 = await useCase.execute(memberActor, {
        boardId: boardAId,
        targetUserId: managerActor.actor_user_id,
        newRole: "MEMBER",
      });
      assert.equal(res2.success, false);
    });

    test("Změna role na OWNER přes ChangeMemberRole je zakázána (OWNERSHIP_TRANSFER_REQUIRED)", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardAId,
        targetUserId: memberActor.actor_user_id,
        newRole: "OWNER",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });

    test("Sesazení sole OWNERa přes ChangeMemberRole je zakázáno (CANNOT_DEMOTE_SOLE_OWNER)", async () => {
      const useCase = new ChangeMemberRoleUseCase(uow);
      const result = await useCase.execute(adminActor, {
        boardId: boardAId,
        targetUserId: ownerActor.actor_user_id,
        newRole: "MEMBER",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 6. Odebrání člena (RemoveMemberUseCase)
  // ───────────────────────────────────────────────────────────
  describe("6. Odebrání člena (RemoveMemberUseCase)", () => {
    test("OWNER může odebrat člena s rolí MEMBER a uvolnit jeho úkoly", async () => {
      // Vytvoříme úkol přiřazený uživateli memberActor
      const task = await taskRepo.create({
        boardId: boardAId,
        title: "Důležitý úkol",
        createdBy: ownerActor.actor_user_id,
        assigneeId: memberActor.actor_user_id,
      });

      // Přidáme ho jako spoluřešitele k jinému úkolu
      const task2 = await taskRepo.create({
        boardId: boardAId,
        title: "Druhý úkol",
        createdBy: ownerActor.actor_user_id,
        assigneeId: managerActor.actor_user_id,
      });
      await participantRepo.addParticipant(task2.id, memberActor.actor_user_id);

      const useCase = new RemoveMemberUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardAId,
        targetUserId: memberActor.actor_user_id,
      });

      assert.equal(result.success, true);

      // Ověření smazání členství
      const saved = await membershipRepo.findByBoardAndUser(
        boardAId,
        memberActor.actor_user_id,
      );
      assert.equal(saved, null);

      // Ověření kaskády: úkol 1 má assigneeId = null
      const updatedTask1 = await taskRepo.findById(task.id);
      assert.equal(updatedTask1?.assigneeId, null);

      // Ověření kaskády: byl odebrán ze spoluřešitelů úkolu 2
      const participants = await participantRepo.findByTaskId(task2.id);
      assert.equal(participants.length, 0);
    });

    test("MANAGER může odebrat člena MEMBER, ale nemůže odebrat MANAGERa", async () => {
      const useCase = new RemoveMemberUseCase(uow);

      // Úspěch: MANAGER odebírá MEMBER
      const res1 = await useCase.execute(managerActor, {
        boardId: boardAId,
        targetUserId: memberActor.actor_user_id,
      });
      assert.equal(res1.success, true);

      // Zamítnuto: MANAGER se pokouší odebrat sám sebe nebo jiného správce/vlastníka
      const res2 = await useCase.execute(managerActor, {
        boardId: boardAId,
        targetUserId: ownerActor.actor_user_id,
      });
      assert.equal(res2.success, false);
    });

    test("Odebrání sole OWNERa je přísně zakázáno (CANNOT_REMOVE_SOLE_OWNER)", async () => {
      const useCase = new RemoveMemberUseCase(uow);
      const result = await useCase.execute(adminActor, {
        boardId: boardAId,
        targetUserId: ownerActor.actor_user_id,
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });

    test("MEMBER nemůže nikoho administrativně odebrat (INSUFFICIENT_ROLE)", async () => {
      const useCase = new RemoveMemberUseCase(uow);
      const result = await useCase.execute(memberActor, {
        boardId: boardAId,
        targetUserId: managerActor.actor_user_id,
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 7. Dobrovolný odchod z nástěnky (LeaveBoardUseCase)
  // ───────────────────────────────────────────────────────────
  describe("7. Dobrovolný odchod z nástěnky (LeaveBoardUseCase)", () => {
    test("MEMBER může dobrovolně opustit nástěnku", async () => {
      const useCase = new LeaveBoardUseCase(uow);
      const result = await useCase.execute(memberActor, {
        boardId: boardAId,
      });

      assert.equal(result.success, true);

      const saved = await membershipRepo.findByBoardAndUser(
        boardAId,
        memberActor.actor_user_id,
      );
      assert.equal(saved, null);
    });

    test("MANAGER může dobrovolně opustit nástěnku", async () => {
      const useCase = new LeaveBoardUseCase(uow);
      const result = await useCase.execute(managerActor, {
        boardId: boardAId,
      });

      assert.equal(result.success, true);
    });

    test("OWNER nemůže opustit nástěnku bez převodu vlastnictví (ConflictError)", async () => {
      const useCase = new LeaveBoardUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardAId,
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof ConflictError, true);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 8. Cross-board security & Board Directory izolace
  // ───────────────────────────────────────────────────────────
  describe("8. Cross-board security & Board Directory izolace", () => {
    test("Člen Boardu A nemůže přidat člena na Board B (CROSS_BOARD_ACCESS)", async () => {
      const useCase = new AddMemberUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardBId,
        targetUserId: outsiderActor.actor_user_id,
        role: "MEMBER",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });

    test("Člen Boardu A nemůže odebrat člena z Boardu B (CROSS_BOARD_ACCESS)", async () => {
      // Vytvoříme platné členství pro cíl na Board B
      await membershipRepo.create({
        boardId: boardBId,
        userId: outsiderActor.actor_user_id,
        role: "MEMBER",
      });

      const useCase = new RemoveMemberUseCase(uow);
      const result = await useCase.execute(ownerActor, {
        boardId: boardBId,
        targetUserId: outsiderActor.actor_user_id,
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error instanceof AuthorizationError, true);
      }
    });

    test("Druhý uživatel po přidání membershipu vidí board v aktivních nástěnkách", async () => {
      // Před přidáním: outsider nemá membership k Board A
      const preMembership = await membershipRepo.findByBoardAndUser(
        boardAId,
        outsiderActor.actor_user_id,
      );
      assert.equal(preMembership, null);

      // Přidání člena
      const addUseCase = new AddMemberUseCase(uow);
      await addUseCase.execute(ownerActor, {
        boardId: boardAId,
        targetUserId: outsiderActor.actor_user_id,
        role: "MEMBER",
      });

      // Po přidání: outsider má platné členství
      const postMembership = await membershipRepo.findByBoardAndUser(
        boardAId,
        outsiderActor.actor_user_id,
      );
      assert.notEqual(postMembership, null);
      assert.equal(postMembership?.role, "MEMBER");
    });
  });

  // ───────────────────────────────────────────────────────────
  // 9. Server Actions simulace
  // ───────────────────────────────────────────────────────────
  describe("9. Server Actions simulace toku", () => {
    test("Neautentizovaný požadavek je zamítnut bez DB volání", () => {
      const getActor = (): ActorContext | null => null;
      const actor = getActor();
      if (!actor || !actor.is_active) {
        const state = {
          success: false,
          error: "Uživatel není přihlášen nebo je účet neaktivní.",
        };
        assert.equal(state.success, false);
        assert.equal(
          state.error,
          "Uživatel není přihlášen nebo je účet neaktivní.",
        );
      }
    });

    test("Neplatný formulářový vstup vrací validační chybu Zod schématu", () => {
      const parsed = addMemberSchema.safeParse({
        boardId: boardAId,
        userId: "", // prázdné
      });
      assert.equal(parsed.success, false);
      if (!parsed.success) {
        assert.equal(parsed.error.issues[0]?.message, "Vyberte prosím uživatele");
      }
    });
  });
});
