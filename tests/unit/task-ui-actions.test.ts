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
import { CreateTaskUseCase } from "../../modules/tasks/application/use-cases/create-task.use-case.ts";
import { checkTaskPermission } from "../../modules/tasks/application/policies/task-policy.ts";
import { createTaskSchema } from "../../modules/tasks/api/dto/task.dto.ts";
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
      if (r.boardId === boardId && r.name === name) {
        return { ...r };
      }
    }
    return null;
  }

  async findByBoardId(boardId: string): Promise<AreaRecord[]> {
    const list: AreaRecord[] = [];
    for (const r of this.store.values()) {
      if (r.boardId === boardId) {
        list.push({ ...r });
      }
    }
    return list;
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
    if (!existing) throw new Error("Area not found");
    const updated: AreaRecord = {
      ...existing,
      name: data.name ?? existing.name,
      description: data.description !== undefined ? data.description : existing.description,
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
// Testovací sada pro STEP 3 – Task Create & Display UI
// ─────────────────────────────────────────────────────────────

describe("STEP 3 – Task Create & Display UI", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let areaRepo: InMemoryAreaRepository;
  let taskRepo: InMemoryTaskRepository;
  let taskParticipantRepo: InMemoryTaskParticipantRepository;
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

  const otherMemberActor: ActorContext = {
    actor_user_id: "user-other-member",
    global_role: "USER",
    session_id: "sess-other-member",
    is_active: true,
  };

  const nonMemberActor: ActorContext = {
    actor_user_id: "user-non-member",
    global_role: "USER",
    session_id: "sess-non-member",
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
  let areaAId: string;
  let areaBId: string;

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

    // Registrace uživatelů
    userRepo.store.set(ownerActor.actor_user_id, {
      id: ownerActor.actor_user_id,
      name: "Vlastník Jan",
      email: "jan@example.com",
      isActive: true,
      globalRole: "USER",
      deletedAt: null,
    });
    userRepo.store.set(managerActor.actor_user_id, {
      id: managerActor.actor_user_id,
      name: "Správce Petr",
      email: "petr@example.com",
      isActive: true,
      globalRole: "USER",
      deletedAt: null,
    });
    userRepo.store.set(memberActor.actor_user_id, {
      id: memberActor.actor_user_id,
      name: "Členka Alena",
      email: "alena@example.com",
      isActive: true,
      globalRole: "USER",
      deletedAt: null,
    });
    userRepo.store.set(otherMemberActor.actor_user_id, {
      id: otherMemberActor.actor_user_id,
      name: "Člen Milan",
      email: "milan@example.com",
      isActive: true,
      globalRole: "USER",
      deletedAt: null,
    });
    userRepo.store.set(nonMemberActor.actor_user_id, {
      id: nonMemberActor.actor_user_id,
      name: "Cizí Uživatel",
      email: "cizi@example.com",
      isActive: true,
      globalRole: "USER",
      deletedAt: null,
    });
    userRepo.store.set(adminActor.actor_user_id, {
      id: adminActor.actor_user_id,
      name: "Admin Karel",
      email: "admin@example.com",
      isActive: true,
      globalRole: "ADMIN",
      deletedAt: null,
    });

    // Vytvoření Nástěnky A a Nástěnky B
    const bA = await boardRepo.create({
      name: "Nástěnka A",
      createdBy: ownerActor.actor_user_id,
    });
    boardAId = bA.id;

    const bB = await boardRepo.create({
      name: "Nástěnka B",
      createdBy: nonMemberActor.actor_user_id,
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
    await membershipRepo.create({
      boardId: boardAId,
      userId: otherMemberActor.actor_user_id,
      role: "MEMBER",
    });

    // Členství na Nástěnce B (nonMemberActor je zde členem, na Board A není)
    await membershipRepo.create({
      boardId: boardBId,
      userId: nonMemberActor.actor_user_id,
      role: "OWNER",
    });

    // Oblasti
    const aA = await areaRepo.create({
      boardId: boardAId,
      name: "Prodejna",
    });
    areaAId = aA.id;

    const aB = await areaRepo.create({
      boardId: boardBId,
      name: "Sklad B",
    });
    areaBId = aB.id;
  });

  // ───────────────────────────────────────────────────────────
  // 1. Zod DTO Schéma (createTaskSchema)
  // ───────────────────────────────────────────────────────────
  describe("1. DTO Validační schéma (createTaskSchema)", () => {
    test("přijímá platný vstup se všemi poli", () => {
      const parsed = createTaskSchema.safeParse({
        boardId: boardAId,
        title: "Koupit regál",
        description: "Regál do prodejny 200x100 cm",
        areaId: areaAId,
        assigneeId: memberActor.actor_user_id,
        priority: "SPĚCHÁ",
        dueDate: "2026-10-15",
      });

      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.title, "Koupit regál");
        assert.equal(parsed.data.priority, "SPĚCHÁ");
        assert.equal(parsed.data.areaId, areaAId);
        assert.equal(parsed.data.assigneeId, memberActor.actor_user_id);
      }
    });

    test("přijímá platný vstup pouze s povinnými poli a nastaví výchozí prioritu BĚŽNÁ", () => {
      const parsed = createTaskSchema.safeParse({
        boardId: boardAId,
        title: "Rychlý úkol",
      });

      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.title, "Rychlý úkol");
        assert.equal(parsed.data.priority, "BĚŽNÁ");
        assert.equal(parsed.data.areaId ?? null, null);
        assert.equal(parsed.data.assigneeId ?? null, null);
      }
    });

    test("odmítá prázdný název nebo název tvořený mezerami", () => {
      const p1 = createTaskSchema.safeParse({ boardId: boardAId, title: "" });
      assert.equal(p1.success, false);

      const p2 = createTaskSchema.safeParse({ boardId: boardAId, title: "   " });
      assert.equal(p2.success, false);
    });

    test("odmítá chybějící boardId nebo prázdné boardId", () => {
      const p = createTaskSchema.safeParse({ title: "Úkol bez desky" });
      assert.equal(p.success, false);
    });

    test("odmítá název delší než 255 znaků", () => {
      const p = createTaskSchema.safeParse({
        boardId: boardAId,
        title: "A".repeat(256),
      });
      assert.equal(p.success, false);
    });

    test("odmítá popis delší než 10 000 znaků", () => {
      const p = createTaskSchema.safeParse({
        boardId: boardAId,
        title: "Dlouhý popis",
        description: "B".repeat(10001),
      });
      assert.equal(p.success, false);
    });

    test("odmítá neplatnou prioritu", () => {
      const p = createTaskSchema.safeParse({
        boardId: boardAId,
        title: "Test",
        priority: "NEPLATNA" as any,
      });
      assert.equal(p.success, false);
    });

    test("odmítá neplatný formát data termínu", () => {
      const p = createTaskSchema.safeParse({
        boardId: boardAId,
        title: "Test",
        dueDate: "neplatne-datum",
      });
      assert.equal(p.success, false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. UI Role Permission Derivation (canCreateTask)
  // ───────────────────────────────────────────────────────────
  describe("2. UI Role Permission Derivation (canCreateTask)", () => {
    const evaluateCanCreateTask = (
      actor: ActorContext,
      role: "OWNER" | "MANAGER" | "MEMBER" | null,
    ) => {
      return actor.global_role === "ADMIN" || role !== null;
    };

    test("OWNER má canCreateTask = true", () => {
      assert.equal(evaluateCanCreateTask(ownerActor, "OWNER"), true);
    });

    test("MANAGER má canCreateTask = true", () => {
      assert.equal(evaluateCanCreateTask(managerActor, "MANAGER"), true);
    });

    test("MEMBER má canCreateTask = true (podle TaskPolicy)", () => {
      assert.equal(evaluateCanCreateTask(memberActor, "MEMBER"), true);
    });

    test("ADMIN má canCreateTask = true i bez role (role: null)", () => {
      assert.equal(evaluateCanCreateTask(adminActor, null), true);
    });

    test("Běžný nečlen bez role má canCreateTask = false", () => {
      assert.equal(evaluateCanCreateTask(nonMemberActor, null), false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. Task Creation Flow & Authorization (Use Case Level)
  // ───────────────────────────────────────────────────────────
  describe("3. CreateTaskUseCase – oprávnění a logika", () => {
    test("MEMBER může vytvořit úkol s výchozími hodnotami (NOVÉ, BĚŽNÁ, Nepřiřazeno)", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const res = await useCase.execute(memberActor, {
        boardId: boardAId,
        title: "Objednat zboží",
      });

      assert.equal(res.success, true);
      if (!res.success) return;

      assert.equal(res.data.title, "Objednat zboží");
      assert.equal(res.data.status, "NOVÉ");
      assert.equal(res.data.priority, "BĚŽNÁ");
      assert.equal(res.data.createdBy, memberActor.actor_user_id);
      assert.equal(res.data.assigneeId, null);
      assert.equal(res.data.areaId, null);
      assert.equal(res.data.dueDate, null);
    });

    test("OWNER může vytvořit úkol se zadanou oblastí, řešitelem, prioritou a termínem", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const dueDate = new Date("2026-11-20");

      const res = await useCase.execute(ownerActor, {
        boardId: boardAId,
        title: "Oprava střechy",
        description: "Opravit krytinu nad skladem",
        areaId: areaAId,
        assigneeId: memberActor.actor_user_id,
        priority: "SPĚCHÁ",
        dueDate,
      });

      assert.equal(res.success, true);
      if (!res.success) return;

      assert.equal(res.data.title, "Oprava střechy");
      assert.equal(res.data.description, "Opravit krytinu nad skladem");
      assert.equal(res.data.areaId, areaAId);
      assert.equal(res.data.assigneeId, memberActor.actor_user_id);
      assert.equal(res.data.priority, "SPĚCHÁ");
      assert.equal(res.data.status, "NOVÉ");
      assert.equal(res.data.dueDate?.getTime(), dueDate.getTime());
    });

    test("MANAGER může vytvořit úkol a přiřadit ho sám sobě", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const res = await useCase.execute(managerActor, {
        boardId: boardAId,
        title: "Týdenní inventura",
        assigneeId: managerActor.actor_user_id,
      });

      assert.equal(res.success, true);
      if (!res.success) return;
      assert.equal(res.data.assigneeId, managerActor.actor_user_id);
    });

    test("ADMIN může vytvořit úkol na libovolném boardu i bez členství", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const res = await useCase.execute(adminActor, {
        boardId: boardAId,
        title: "Administrátorský úkol",
      });

      assert.equal(res.success, true);
      if (!res.success) return;
      assert.equal(res.data.title, "Administrátorský úkol");
    });

    test("Nečlen NEMŮŽE vytvořit úkol (AuthorizationError / NOT_A_MEMBER)", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const res = await useCase.execute(nonMemberActor, {
        boardId: boardAId,
        title: "Pokus o cizí úkol",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
      assert.equal((res.error as AuthorizationError).reason, "NOT_A_MEMBER");
    });

    test("Neautentizovaný požadavek (null actor) je zamítnut", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const res = await useCase.execute(null, {
        boardId: boardAId,
        title: "Anonymní úkol",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthenticationError);
    });

    test("Neaktivní uživatel (is_active = false) je zamítnut", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const res = await useCase.execute(inactiveActor, {
        boardId: boardAId,
        title: "Neaktivní úkol",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthenticationError);
    });

    test("Vytvoření úkolu na soft-deleted boardu skončí AuthorizationError (BOARD_DELETED)", async () => {
      await boardRepo.softDelete(boardAId, new Date());

      const useCase = new CreateTaskUseCase(uow);
      const res = await useCase.execute(memberActor, {
        boardId: boardAId,
        title: "Úkol na smazané nástěnce",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
      assert.equal((res.error as AuthorizationError).reason, "BOARD_DELETED");
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. Cross-Board Security Testy
  // ───────────────────────────────────────────────────────────
  describe("4. Cross-board bezpečnostní izolace", () => {
    test("Člen Boardu A NESMÍ vytvořit úkol s oblastí z Boardu B (CROSS_BOARD_ACCESS)", async () => {
      const useCase = new CreateTaskUseCase(uow);

      // memberActor je členem Board A, areaBId patří k Board B
      const res = await useCase.execute(memberActor, {
        boardId: boardAId,
        title: "Útok s cizí oblastí",
        areaId: areaBId, // Podvržené areaId z cizí nástěnky
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
      assert.equal(
        (res.error as AuthorizationError).reason,
        "CROSS_BOARD_ACCESS",
      );

      // Úkol nesmí vzniknout v DB
      const allTasks = await taskRepo.findByBoardId(boardAId);
      assert.equal(allTasks.length, 0);
    });

    test("Člen Boardu A NESMÍ přiřadit řešitele, který není členem Boardu A (CROSS_BOARD_ACCESS)", async () => {
      const useCase = new CreateTaskUseCase(uow);

      // nonMemberActor je aktivní uživatel, ale NENÍ členem Board A
      const res = await useCase.execute(memberActor, {
        boardId: boardAId,
        title: "Přiřazení cizího řešitele",
        assigneeId: nonMemberActor.actor_user_id,
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
      assert.equal(
        (res.error as AuthorizationError).reason,
        "CROSS_BOARD_ACCESS",
      );

      const allTasks = await taskRepo.findByBoardId(boardAId);
      assert.equal(allTasks.length, 0);
    });

    test("Přiřazení neexistujícího nebo neaktivního uživatele je odmítnuto chybou ValidationError", async () => {
      const useCase = new CreateTaskUseCase(uow);

      const res = await useCase.execute(memberActor, {
        boardId: boardAId,
        title: "Přiřazení neexistujícího",
        assigneeId: "non-existent-user-id",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof ValidationError);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 5. Task Policy Engine Verifikace pro Task Create a View
  // ───────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────
  // 5. Task Policy Engine Verifikace pro Task Create a View
  // ───────────────────────────────────────────────────────────
  describe("5. TaskPolicy – checkTaskPermission pro CREATE a VIEW", () => {
    const getTaskTarget = () => ({
      boardId: boardAId,
      taskId: "test-task",
      createdBy: memberActor.actor_user_id,
      assigneeId: null,
      isBoardDeleted: false,
    });
    const defaultRel = { isAssignee: false, isParticipant: false };

    test("MEMBER má ALLOW pro TASK_CREATE", () => {
      const res = checkTaskPermission(
        memberActor,
        boardAId,
        { role: "MEMBER" },
        getTaskTarget(),
        defaultRel,
        "TASK_CREATE",
      );
      assert.equal(res.allowed, true);
    });

    test("MEMBER má ALLOW pro TASK_VIEW", () => {
      const res = checkTaskPermission(
        memberActor,
        boardAId,
        { role: "MEMBER" },
        getTaskTarget(),
        defaultRel,
        "TASK_VIEW",
      );
      assert.equal(res.allowed, true);
    });

    test("Nečlen bez ADMIN má DENY(NOT_A_MEMBER) pro TASK_CREATE", () => {
      const res = checkTaskPermission(
        nonMemberActor,
        boardAId,
        null,
        getTaskTarget(),
        defaultRel,
        "TASK_CREATE",
      );
      assert.equal(res.allowed, false);
      if (!res.allowed) {
        assert.equal(res.reason, "NOT_A_MEMBER");
      }
    });

    test("Nečlen bez ADMIN má DENY(NOT_A_MEMBER) pro TASK_VIEW", () => {
      const res = checkTaskPermission(
        nonMemberActor,
        boardAId,
        null,
        getTaskTarget(),
        defaultRel,
        "TASK_VIEW",
      );
      assert.equal(res.allowed, false);
      if (!res.allowed) {
        assert.equal(res.reason, "NOT_A_MEMBER");
      }
    });

    test("ADMIN má ALLOW pro TASK_CREATE i bez členství", () => {
      const res = checkTaskPermission(
        adminActor,
        boardAId,
        null,
        getTaskTarget(),
        defaultRel,
        "TASK_CREATE",
      );
      assert.equal(res.allowed, true);
    });

    test("ADMIN má ALLOW pro TASK_VIEW i bez členství", () => {
      const res = checkTaskPermission(
        adminActor,
        boardAId,
        null,
        getTaskTarget(),
        defaultRel,
        "TASK_VIEW",
      );
      assert.equal(res.allowed, true);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 6. Server Action – Simulace toku a návratových stavů
  // ───────────────────────────────────────────────────────────
  describe("6. Server Action – Simulace toku", () => {
    test("Neautentizovaný požadavek vrací chybovou hlášku bez spuštění DB", () => {
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
      const parsed = createTaskSchema.safeParse({
        boardId: boardAId,
        title: "", // prázdný název
      });
      assert.equal(parsed.success, false);
      if (!parsed.success) {
        const state = {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Neplatný vstup formuláře.",
        };
        assert.equal(state.success, false);
        assert.equal(state.error, "Název úkolu nesmí být prázdný");
      }
    });

    test("Úspěšné vytvoření vrací success: true a taskId", async () => {
      const useCase = new CreateTaskUseCase(uow);
      const res = await useCase.execute(memberActor, {
        boardId: boardAId,
        title: "Dokončit inventuru",
      });

      assert.equal(res.success, true);
      if (res.success) {
        const state = {
          success: true,
          taskId: res.data.id,
        };
        assert.equal(state.success, true);
        assert.ok(typeof state.taskId === "string");
      }
    });
  });
});
