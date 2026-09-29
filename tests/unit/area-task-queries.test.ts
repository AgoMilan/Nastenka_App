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
  UserBoardRecord,
  UserRecord,
  UserRepository,
} from "../../modules/boards/application/ports/index.ts";
import type {
  AreaRecord,
  AreaRepository,
  CreateAreaData,
  UpdateAreaData,
} from "../../modules/areas/application/ports/area-repository.port.ts";
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
  GetBoardAreasUseCase,
  type AreaView,
} from "../../modules/areas/application/use-cases/index.ts";
import {
  GetBoardMembersUseCase,
  type BoardMemberView,
} from "../../modules/boards/application/use-cases/index.ts";
import {
  GetBoardTasksUseCase,
  type BoardTaskView,
} from "../../modules/tasks/application/use-cases/index.ts";
import {
  createAreaSchema,
  updateAreaSchema,
  deleteAreaSchema,
} from "../../modules/areas/api/dto/area.dto.ts";
import {
  createTaskSchema,
  updateTaskSchema,
  changeTaskAssigneeSchema,
  changeTaskStatusSchema,
  changeTaskAreaSchema,
  changeTaskDueDateSchema,
  changeTaskPrioritySchema,
  deleteTaskSchema,
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

  async findActiveBoardsForUser(userId: string): Promise<UserBoardRecord[]> {
    return [];
  }

  async findActiveBoardsForAdmin(adminUserId: string): Promise<UserBoardRecord[]> {
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

  async findMembershipsByBoard(boardId: string): Promise<MembershipRecord[]> {
    return Array.from(this.store.values()).filter((m) => m.boardId === boardId);
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
}

class InMemoryAreaRepository implements AreaRepository {
  public store = new Map<string, AreaRecord>();

  async findById(id: string): Promise<AreaRecord | null> {
    const a = this.store.get(id);
    return a ? { ...a } : null;
  }

  async findByIdForUpdate(id: string): Promise<AreaRecord | null> {
    return this.findById(id);
  }

  async findByBoardAndName(
    boardId: string,
    name: string,
  ): Promise<AreaRecord | null> {
    for (const a of this.store.values()) {
      if (a.boardId === boardId && a.name.toLowerCase() === name.toLowerCase()) {
        return { ...a };
      }
    }
    return null;
  }

  async findByBoardId(boardId: string): Promise<AreaRecord[]> {
    return Array.from(this.store.values()).filter((a) => a.boardId === boardId);
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
    const a = this.store.get(id);
    if (!a) throw new Error("Area not found");
    const updated: AreaRecord = {
      ...a,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
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
    const t = this.store.get(id);
    if (!t) throw new Error("Task not found");
    const updated: TaskRecord = {
      ...t,
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
      ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
      ...(data.areaId !== undefined ? { areaId: data.areaId } : {}),
      ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
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
    const taskIdSet = new Set(taskIds);
    return Array.from(this.store.values()).filter((p) => taskIdSet.has(p.taskId));
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
    role: string = "SPOLUŘEŠITEL",
  ): Promise<TaskParticipantRecord> {
    const id = `part-${crypto.randomUUID()}`;
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

// ─────────────────────────────────────────────────────────────
// Testovací Suite
// ─────────────────────────────────────────────────────────────

describe("Area, Task & Members Query Use Cases + DTOs", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let areaRepo: InMemoryAreaRepository;
  let taskRepo: InMemoryTaskRepository;
  let participantRepo: InMemoryTaskParticipantRepository;

  // Aktéři
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

  const nonMemberActor: ActorContext = {
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

  let boardA: BoardRecord;
  let boardB: BoardRecord;

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    areaRepo = new InMemoryAreaRepository();
    taskRepo = new InMemoryTaskRepository();
    participantRepo = new InMemoryTaskParticipantRepository();

    // Vložení uživatelů
    userRepo.store.set("user-owner", {
      id: "user-owner",
      name: "Alice Vlastník",
      email: "alice@example.com",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set("user-manager", {
      id: "user-manager",
      name: "Bob Manažer",
      email: "bob@example.com",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set("user-member", {
      id: "user-member",
      name: "Cyril Člen",
      email: "cyril@example.com",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set("user-outsider", {
      id: "user-outsider",
      name: "David Cizí",
      email: "david@example.com",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set("user-admin", {
      id: "user-admin",
      name: "Eva Admin",
      email: "eva@example.com",
      globalRole: "ADMIN",
      isActive: true,
      deletedAt: null,
    });

    // Vytvoření Nástěnky A a členství
    boardA = await boardRepo.create({
      name: "Nástěnka Vývoj",
      description: "Hlavní vývojová nástěnka",
      createdBy: "user-owner",
    });
    await membershipRepo.create({
      boardId: boardA.id,
      userId: "user-owner",
      role: "OWNER",
    });
    await membershipRepo.create({
      boardId: boardA.id,
      userId: "user-manager",
      role: "MANAGER",
    });
    await membershipRepo.create({
      boardId: boardA.id,
      userId: "user-member",
      role: "MEMBER",
    });

    // Vytvoření Nástěnky B (oddělená)
    boardB = await boardRepo.create({
      name: "Nástěnka Marketing",
      createdBy: "user-outsider",
    });
    await membershipRepo.create({
      boardId: boardB.id,
      userId: "user-outsider",
      role: "OWNER",
    });
  });

  // ───────────────────────────────────────────────────────────
  // 1. GetBoardAreasUseCase
  // ───────────────────────────────────────────────────────────
  describe("1. GetBoardAreasUseCase", () => {
    let useCase: GetBoardAreasUseCase;

    beforeEach(async () => {
      useCase = new GetBoardAreasUseCase(boardRepo, membershipRepo, areaRepo);

      // Oblasti na Nástěnce A
      await areaRepo.create({ boardId: boardA.id, name: "Backend" });
      await areaRepo.create({ boardId: boardA.id, name: "Frontend" });
      await areaRepo.create({ boardId: boardA.id, name: "DevOps" });

      // Oblast na Nástěnce B
      await areaRepo.create({ boardId: boardB.id, name: "Kampaně" });
    });

    test("OWNER smí načíst seznam oblastí (seřazený abecedně)", async () => {
      const result = await useCase.execute(ownerActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.length, 3);
      assert.deepEqual(
        result.data.map((a) => a.name),
        ["Backend", "DevOps", "Frontend"],
      );
    });

    test("MANAGER smí načíst seznam oblastí", async () => {
      const result = await useCase.execute(managerActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;
      assert.equal(result.data.length, 3);
    });

    test("MEMBER smí načíst seznam oblastí", async () => {
      const result = await useCase.execute(memberActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;
      assert.equal(result.data.length, 3);
    });

    test("ADMIN bez přímého členství smí načíst oblasti", async () => {
      const result = await useCase.execute(adminActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;
      assert.equal(result.data.length, 3);
    });

    test("neautentizovaný volající je odmítnut chybou AuthenticationError", async () => {
      const resNull = await useCase.execute(null, boardA.id);
      assert.equal(resNull.success, false);
      assert.ok(resNull.error instanceof AuthenticationError);

      const resInactive = await useCase.execute(inactiveActor, boardA.id);
      assert.equal(resInactive.success, false);
      assert.ok(resInactive.error instanceof AuthenticationError);
    });

    test("nečlen je odmítnut chybou AuthorizationError (NOT_A_MEMBER)", async () => {
      const result = await useCase.execute(nonMemberActor, boardA.id);
      assert.equal(result.success, false);
      assert.ok(result.error instanceof AuthorizationError);
      assert.equal((result.error as AuthorizationError).reason, "NOT_A_MEMBER");
    });

    test("soft-deleted Board skončí NotFoundError", async () => {
      await boardRepo.softDelete(boardA.id, new Date());
      const result = await useCase.execute(ownerActor, boardA.id);
      assert.equal(result.success, false);
      assert.ok(result.error instanceof NotFoundError);
    });

    test("výsledek je přísně scoped na daný Board (neobsahuje oblasti z Boardu B)", async () => {
      const result = await useCase.execute(ownerActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;

      const names = result.data.map((a) => a.name);
      assert.ok(!names.includes("Kampaně"));
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. GetBoardMembersUseCase
  // ───────────────────────────────────────────────────────────
  describe("2. GetBoardMembersUseCase", () => {
    let useCase: GetBoardMembersUseCase;

    beforeEach(() => {
      useCase = new GetBoardMembersUseCase(boardRepo, membershipRepo, userRepo);
    });

    test("MEMBER smí načíst členy své Nástěnky pro formuláře úkolů", async () => {
      const result = await useCase.execute(memberActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.length, 3);
      // Seřazeno: OWNER > MANAGER > MEMBER
      assert.equal(result.data[0].role, "OWNER");
      assert.equal(result.data[0].name, "Alice Vlastník");
      assert.equal(result.data[1].role, "MANAGER");
      assert.equal(result.data[1].name, "Bob Manažer");
      assert.equal(result.data[2].role, "MEMBER");
      assert.equal(result.data[2].name, "Cyril Člen");
    });

    test("ADMIN smí načíst členy i bez přímého členství", async () => {
      const result = await useCase.execute(adminActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;
      assert.equal(result.data.length, 3);
    });

    test("nečlen je odmítnut chybou AuthorizationError (NOT_A_MEMBER)", async () => {
      const result = await useCase.execute(nonMemberActor, boardA.id);
      assert.equal(result.success, false);
      assert.ok(result.error instanceof AuthorizationError);
      assert.equal((result.error as AuthorizationError).reason, "NOT_A_MEMBER");
    });

    test("soft-deleted Board skončí NotFoundError", async () => {
      await boardRepo.softDelete(boardA.id, new Date());
      const result = await useCase.execute(ownerActor, boardA.id);
      assert.equal(result.success, false);
      assert.ok(result.error instanceof NotFoundError);
    });

    test("neaktivní nebo smazaný uživatel je ze seznamu členů vyřazen", async () => {
      // Přidáme neaktivního uživatele do Boardu A
      userRepo.store.set("user-deactivated", {
        id: "user-deactivated",
        name: "Deaktivovaný Uživatel",
        email: "deactivated@example.com",
        globalRole: "USER",
        isActive: false,
        deletedAt: null,
      });
      await membershipRepo.create({
        boardId: boardA.id,
        userId: "user-deactivated",
        role: "MEMBER",
      });

      const result = await useCase.execute(ownerActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;

      const userIds = result.data.map((m) => m.userId);
      assert.ok(!userIds.includes("user-deactivated"));
    });

    test("členové jiného Boardu se nevrátí", async () => {
      const result = await useCase.execute(ownerActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;

      const userIds = result.data.map((m) => m.userId);
      assert.ok(!userIds.includes("user-outsider"));
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. GetBoardTasksUseCase
  // ───────────────────────────────────────────────────────────
  describe("3. GetBoardTasksUseCase", () => {
    let useCase: GetBoardTasksUseCase;
    let areaBackend: AreaRecord;
    let task1: TaskRecord;
    let task2: TaskRecord;
    let taskArchived: TaskRecord;
    let taskDone: TaskRecord;
    let taskB: TaskRecord;

    beforeEach(async () => {
      useCase = new GetBoardTasksUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        participantRepo,
        areaRepo,
        userRepo,
      );

      // Vytvoření oblasti
      areaBackend = await areaRepo.create({
        boardId: boardA.id,
        name: "Backend",
      });

      // Úkol 1: Aktivní, BĚŽNÁ priorita, s oblastí, řešitelem a 1 spoluřešitelem
      task1 = await taskRepo.create({
        boardId: boardA.id,
        areaId: areaBackend.id,
        title: "Implementovat API",
        description: "REST endpointy",
        status: "ROZPRACOVANÉ",
        priority: "BĚŽNÁ",
        createdBy: "user-owner",
        assigneeId: "user-manager",
      });
      await participantRepo.addParticipant(task1.id, "user-member");

      // Úkol 2: SPĚCHÁ priorita, bez oblasti, bez řešitele
      task2 = await taskRepo.create({
        boardId: boardA.id,
        title: "Oprava bugu v produkci",
        status: "NOVÉ",
        priority: "SPĚCHÁ",
        createdBy: "user-member",
      });

      // Úkol 3: HOTOVO (dokončený, ale stále aktivní na tabuli)
      taskDone = await taskRepo.create({
        boardId: boardA.id,
        title: "Nasazení na staging",
        status: "HOTOVO",
        priority: "BĚŽNÁ",
        createdBy: "user-manager",
      });

      // Úkol 4: ARCHIVOVÁNO
      taskArchived = await taskRepo.create({
        boardId: boardA.id,
        title: "Starý dokončený sprint",
        status: "ARCHIVOVÁNO",
        priority: "BĚŽNÁ",
        createdBy: "user-owner",
      });

      // Úkol na cizím Boardu B
      taskB = await taskRepo.create({
        boardId: boardB.id,
        title: "Marketingový leták",
        status: "NOVÉ",
        createdBy: "user-outsider",
      });
    });

    test("MEMBER smí načíst aktivní úkoly (výchozí filter ACTIVE nezahrnuje ARCHIVOVÁNO)", async () => {
      const result = await useCase.execute(memberActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;

      // task1, task2, taskDone = 3 úkoly (taskArchived vyřazen)
      assert.equal(result.data.length, 3);
      const ids = result.data.map((t) => t.id);
      assert.ok(ids.includes(task1.id));
      assert.ok(ids.includes(task2.id));
      assert.ok(ids.includes(taskDone.id));
      assert.ok(!ids.includes(taskArchived.id));
    });

    test("HOTOVO není zaměněno s ARCHIVOVÁNO a je přítomno ve filtru ACTIVE", async () => {
      const result = await useCase.execute(ownerActor, boardA.id, {
        filter: "ACTIVE",
      });
      assert.equal(result.success, true);
      if (!result.success) return;

      const doneTask = result.data.find((t) => t.id === taskDone.id);
      assert.ok(doneTask);
      assert.equal(doneTask.status, "HOTOVO");
    });

    test("filter ARCHIVED vrátí pouze archivované úkoly", async () => {
      const result = await useCase.execute(ownerActor, boardA.id, {
        filter: "ARCHIVED",
      });
      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].id, taskArchived.id);
      assert.equal(result.data[0].status, "ARCHIVOVÁNO");
    });

    test("filter ALL vrátí všechny úkoly včetně archivovaných", async () => {
      const result = await useCase.execute(ownerActor, boardA.id, {
        filter: "ALL",
      });
      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.length, 4);
    });

    test("Assignee, Creator, Participants a AreaName jsou správně namapovány s uživatelskými jmény", async () => {
      const result = await useCase.execute(ownerActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;

      const t1 = result.data.find((t) => t.id === task1.id);
      assert.ok(t1);

      // Area
      assert.equal(t1.areaId, areaBackend.id);
      assert.equal(t1.areaName, "Backend");

      // Creator
      assert.equal(t1.createdBy.userId, "user-owner");
      assert.equal(t1.createdBy.name, "Alice Vlastník");

      // Assignee
      assert.ok(t1.assignee);
      assert.equal(t1.assignee.userId, "user-manager");
      assert.equal(t1.assignee.name, "Bob Manažer");

      // Participants
      assert.equal(t1.participants.length, 1);
      assert.equal(t1.participants[0].userId, "user-member");
      assert.equal(t1.participants[0].name, "Cyril Člen");
      assert.equal(t1.participants[0].role, "SPOLUŘEŠITEL");
    });

    test("deterministické řazení: úkoly s prioritou SPĚCHÁ jsou první", async () => {
      const result = await useCase.execute(ownerActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;

      // task2 má prioritu SPĚCHÁ, task1 a taskDone mají BĚŽNÁ
      assert.equal(result.data[0].id, task2.id);
      assert.equal(result.data[0].priority, "SPĚCHÁ");
    });

    test("cross-board izolace: úkoly z Boardu B se nikdy nevrátí v Boardu A", async () => {
      const result = await useCase.execute(ownerActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;

      const ids = result.data.map((t) => t.id);
      assert.ok(!ids.includes(taskB.id));
    });

    test("nečlen je odmítnut chybou AuthorizationError (NOT_A_MEMBER)", async () => {
      const result = await useCase.execute(nonMemberActor, boardA.id);
      assert.equal(result.success, false);
      assert.ok(result.error instanceof AuthorizationError);
      assert.equal((result.error as AuthorizationError).reason, "NOT_A_MEMBER");
    });

    test("soft-deleted Board skončí chybou NotFoundError", async () => {
      await boardRepo.softDelete(boardA.id, new Date());
      const result = await useCase.execute(ownerActor, boardA.id);
      assert.equal(result.success, false);
      assert.ok(result.error instanceof NotFoundError);
    });

    test("ADMIN smí načíst úkoly i bez přímého členství", async () => {
      const result = await useCase.execute(adminActor, boardA.id);
      assert.equal(result.success, true);
      if (!result.success) return;
      assert.equal(result.data.length, 3);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. Komplexní Cross-Board Izolace (Požadavek §17)
  // ───────────────────────────────────────────────────────────
  describe("4. Komplexní Cross-Board Izolace (§17)", () => {
    test("Actor A s přístupem na Board A nemůže přes query Boardu A získat žádná data Boardu B", async () => {
      const areasUseCase = new GetBoardAreasUseCase(
        boardRepo,
        membershipRepo,
        areaRepo,
      );
      const membersUseCase = new GetBoardMembersUseCase(
        boardRepo,
        membershipRepo,
        userRepo,
      );
      const tasksUseCase = new GetBoardTasksUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        participantRepo,
        areaRepo,
        userRepo,
      );

      // Data na Boardu B
      const areaB = await areaRepo.create({
        boardId: boardB.id,
        name: "Tajná oblast B",
      });
      const taskB = await taskRepo.create({
        boardId: boardB.id,
        title: "Tajný úkol B",
        createdBy: "user-outsider",
      });

      // 1. Oblasti Boardu A
      const areasRes = await areasUseCase.execute(ownerActor, boardA.id);
      assert.equal(areasRes.success, true);
      if (areasRes.success) {
        assert.ok(!areasRes.data.some((a) => a.id === areaB.id));
        assert.ok(!areasRes.data.some((a) => a.boardId === boardB.id));
      }

      // 2. Členové Boardu A
      const membersRes = await membersUseCase.execute(ownerActor, boardA.id);
      assert.equal(membersRes.success, true);
      if (membersRes.success) {
        assert.ok(!membersRes.data.some((m) => m.userId === "user-outsider"));
      }

      // 3. Úkoly Boardu A
      const tasksRes = await tasksUseCase.execute(ownerActor, boardA.id);
      assert.equal(tasksRes.success, true);
      if (tasksRes.success) {
        assert.ok(!tasksRes.data.some((t) => t.id === taskB.id));
        assert.ok(!tasksRes.data.some((t) => t.boardId === boardB.id));
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 5. Zod DTO Schémata (Požadavek §13–§15)
  // ───────────────────────────────────────────────────────────
  describe("5. Zod DTO Schémata", () => {
    describe("Area DTOs", () => {
      test("createAreaSchema validuje správný i chybný vstup", () => {
        // Platný
        const valid = createAreaSchema.safeParse({
          boardId: "board-123",
          name: "Design",
          description: "UI/UX práce",
        });
        assert.equal(valid.success, true);

        // Prázdný název
        const emptyName = createAreaSchema.safeParse({
          boardId: "board-123",
          name: "",
        });
        assert.equal(emptyName.success, false);

        // Whitespace-only název
        const wsName = createAreaSchema.safeParse({
          boardId: "board-123",
          name: "   ",
        });
        assert.equal(wsName.success, false);

        // Název > 255 znaků
        const longName = createAreaSchema.safeParse({
          boardId: "board-123",
          name: "A".repeat(256),
        });
        assert.equal(longName.success, false);

        // Chybějící boardId
        const missingBoard = createAreaSchema.safeParse({
          name: "Design",
        });
        assert.equal(missingBoard.success, false);
      });

      test("updateAreaSchema validuje povinné ID a volitelná pole", () => {
        const valid = updateAreaSchema.safeParse({
          areaId: "area-123",
          name: "Nový název",
        });
        assert.equal(valid.success, true);

        const missingId = updateAreaSchema.safeParse({
          name: "Nový název",
        });
        assert.equal(missingId.success, false);
      });

      test("deleteAreaSchema vyžaduje přesné potvrzení 'SMAZAT'", () => {
        const valid = deleteAreaSchema.safeParse({
          areaId: "area-123",
          confirmation: "SMAZAT",
        });
        assert.equal(valid.success, true);

        const invalid = deleteAreaSchema.safeParse({
          areaId: "area-123",
          confirmation: "smazat",
        });
        assert.equal(invalid.success, false);

        const invalidText = deleteAreaSchema.safeParse({
          areaId: "area-123",
          confirmation: "ANO",
        });
        assert.equal(invalidText.success, false);
      });
    });

    describe("Task DTOs", () => {
      test("createTaskSchema validuje správný vstup a české enumy", () => {
        const valid = createTaskSchema.safeParse({
          boardId: "board-123",
          title: "Vytvořit komponentu",
          description: "Detailní popis",
          priority: "SPĚCHÁ",
          dueDate: "2026-12-31T23:59:59.000Z",
        });
        assert.equal(valid.success, true);

        // Prázdný název
        const invalidTitle = createTaskSchema.safeParse({
          boardId: "board-123",
          title: "   ",
        });
        assert.equal(invalidTitle.success, false);

        // Neplatná priorita
        const invalidPriority = createTaskSchema.safeParse({
          boardId: "board-123",
          title: "Úkol",
          priority: "URGENT", // Nečeský enum
        });
        assert.equal(invalidPriority.success, false);
      });

      test("changeTaskStatusSchema akceptuje pouze české enumy", () => {
        const validStatuses = [
          "NOVÉ",
          "PŘEVZATÉ",
          "ROZPRACOVANÉ",
          "ČEKÁ SE",
          "HOTOVO",
          "ARCHIVOVÁNO",
        ];

        for (const st of validStatuses) {
          const res = changeTaskStatusSchema.safeParse({
            taskId: "task-1",
            status: st,
          });
          assert.equal(res.success, true, `Status ${st} should be valid`);
        }

        const invalid = changeTaskStatusSchema.safeParse({
          taskId: "task-1",
          status: "DONE",
        });
        assert.equal(invalid.success, false);
      });

      test("changeTaskPrioritySchema akceptuje pouze české enumy (BĚŽNÁ, SPĚCHÁ)", () => {
        assert.equal(
          changeTaskPrioritySchema.safeParse({
            taskId: "task-1",
            priority: "BĚŽNÁ",
          }).success,
          true,
        );
        assert.equal(
          changeTaskPrioritySchema.safeParse({
            taskId: "task-1",
            priority: "SPĚCHÁ",
          }).success,
          true,
        );
        assert.equal(
          changeTaskPrioritySchema.safeParse({
            taskId: "task-1",
            priority: "LOW",
          }).success,
          false,
        );
      });

      test("deleteTaskSchema vyžaduje přesné potvrzení textem 'SMAZAT'", () => {
        assert.equal(
          deleteTaskSchema.safeParse({
            taskId: "task-1",
            confirmation: "SMAZAT",
          }).success,
          true,
        );
        assert.equal(
          deleteTaskSchema.safeParse({
            taskId: "task-1",
            confirmation: "DELETE",
          }).success,
          false,
        );
      });
    });
  });
});
