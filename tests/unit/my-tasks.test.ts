import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type {
  BoardRecord,
  BoardRepository,
  CreateBoardData,
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
  UserTaskOrderRecord,
  UserTaskOrderRepository,
  UpsertUserTaskOrderData,
} from "../../modules/tasks/application/ports/index.ts";
import {
  GetMyTasksUseCase,
  type MyTaskView,
} from "../../modules/tasks/application/use-cases/index.ts";
import { AuthenticationError } from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// Testovací In-Memory Repozitáře
// ─────────────────────────────────────────────────────────────

class InMemoryBoardRepository implements BoardRepository {
  public store = new Map<string, BoardRecord>();
  public membershipRepo: InMemoryMembershipRepository | null = null;

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

  async findActiveBoardsForUser(userId: string): Promise<UserBoardRecord[]> {
    if (!this.membershipRepo) return [];
    const userMemberships = Array.from(this.membershipRepo.store.values()).filter(
      (m) => m.userId === userId,
    );
    const result: UserBoardRecord[] = [];
    for (const m of userMemberships) {
      const b = this.store.get(m.boardId);
      if (b && b.deletedAt === null) {
        result.push({
          id: b.id,
          name: b.name,
          description: b.description,
          role: m.role,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        });
      }
    }
    return result;
  }

  async findActiveBoardsForAdmin(adminUserId: string): Promise<UserBoardRecord[]> {
    const result: UserBoardRecord[] = [];
    for (const b of this.store.values()) {
      if (b.deletedAt === null) {
        const m = this.membershipRepo
          ? await this.membershipRepo.findByBoardAndUser(b.id, adminUserId)
          : null;
        result.push({
          id: b.id,
          name: b.name,
          description: b.description,
          role: m ? m.role : null,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        });
      }
    }
    return result;
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
    const r = this.store.get(this.key(boardId, userId));
    return r ? { ...r } : null;
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
    this.store.set(this.key(data.boardId, data.userId), record);
    return record;
  }

  async updateRole(
    boardId: string,
    userId: string,
    newRole: "OWNER" | "MANAGER" | "MEMBER",
  ): Promise<void> {
    const k = this.key(boardId, userId);
    const existing = this.store.get(k);
    if (!existing) throw new Error("Membership not found");
    const updated = { ...existing, role: newRole, updatedAt: new Date() };
    this.store.set(k, updated);
  }

  async delete(boardId: string, userId: string): Promise<void> {
    this.store.delete(this.key(boardId, userId));
  }
}

class InMemoryAreaRepository implements AreaRepository {
  public store = new Map<string, AreaRecord>();

  async findById(id: string): Promise<AreaRecord | null> {
    const r = this.store.get(id);
    return r ? { ...r } : null;
  }

  async findByBoardId(boardId: string): Promise<AreaRecord[]> {
    return Array.from(this.store.values()).filter((a) => a.boardId === boardId);
  }

  async findByBoardAndName(boardId: string, name: string): Promise<AreaRecord | null> {
    const match = Array.from(this.store.values()).find(
      (a) => a.boardId === boardId && a.name.toLowerCase() === name.toLowerCase(),
    );
    return match ? { ...match } : null;
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
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

class InMemoryUserRepository implements UserRepository {
  public store = new Map<string, UserRecord>();

  async findById(id: string): Promise<UserRecord | null> {
    const r = this.store.get(id);
    return r ? { ...r } : null;
  }

  async findByIds(ids: string[]): Promise<UserRecord[]> {
    return ids
      .map((id) => this.store.get(id))
      .filter((u): u is UserRecord => u !== undefined);
  }

  async findActiveUsers(): Promise<UserRecord[]> {
    return Array.from(this.store.values()).filter((u) => u.isActive && !u.deletedAt);
  }

  async create(user: UserRecord): Promise<UserRecord> {
    this.store.set(user.id, user);
    return user;
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
    const set = new Set(taskIds);
    return Array.from(this.store.values()).filter((p) => set.has(p.taskId));
  }

  async findByTaskAndUser(
    taskId: string,
    userId: string,
  ): Promise<TaskParticipantRecord | null> {
    const r = this.store.get(this.key(taskId, userId));
    return r ? { ...r } : null;
  }

  async addParticipant(
    taskId: string,
    userId: string,
    role = "SPOLUŘEŠITEL",
  ): Promise<TaskParticipantRecord> {
    const id = `part-${crypto.randomUUID()}`;
    const record: TaskParticipantRecord = {
      id,
      taskId,
      userId,
      role,
      createdAt: new Date(),
    };
    this.store.set(this.key(taskId, userId), record);
    return record;
  }

  async removeParticipant(taskId: string, userId: string): Promise<void> {
    this.store.delete(this.key(taskId, userId));
  }

  async removeAllForTask(taskId: string): Promise<void> {
    for (const [k, p] of this.store.entries()) {
      if (p.taskId === taskId) {
        this.store.delete(k);
      }
    }
  }
}

class InMemoryTaskRepository implements TaskRepository {
  public store = new Map<string, TaskRecord>();
  public participantRepo: InMemoryTaskParticipantRepository | null = null;

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

  async findUserTasksAcrossBoards(
    userId: string,
    boardIds: string[],
  ): Promise<TaskRecord[]> {
    if (boardIds.length === 0) return [];
    const boardSet = new Set(boardIds);

    // Najdi taskId, kde je uživatel participant
    const participatingTaskIds = new Set<string>();
    if (this.participantRepo) {
      for (const p of this.participantRepo.store.values()) {
        if (p.userId === userId) {
          participatingTaskIds.add(p.taskId);
        }
      }
    }

    return Array.from(this.store.values()).filter((t) => {
      if (!boardSet.has(t.boardId)) return false;
      const isAssignee = t.assigneeId === userId;
      const isPart = participatingTaskIds.has(t.id);
      return isAssignee || isPart;
    });
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
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

class InMemoryUserTaskOrderRepository implements UserTaskOrderRepository {
  public store = new Map<string, UserTaskOrderRecord>();

  private key(userId: string, taskId: string): string {
    return `${userId}:${taskId}`;
  }

  async findByBoardAndUser(
    boardId: string,
    userId: string,
  ): Promise<UserTaskOrderRecord[]> {
    return Array.from(this.store.values()).filter(
      (o) => o.boardId === boardId && o.userId === userId,
    );
  }

  async findByTaskId(taskId: string): Promise<UserTaskOrderRecord[]> {
    return Array.from(this.store.values()).filter((o) => o.taskId === taskId);
  }

  async upsertOrder(data: UpsertUserTaskOrderData): Promise<void> {
    const k = this.key(data.userId, data.taskId);
    const existing = this.store.get(k);
    if (existing) {
      this.store.set(k, {
        ...existing,
        position: data.position,
        updatedAt: new Date(),
      });
    } else {
      const id = `order-${crypto.randomUUID()}`;
      this.store.set(k, {
        id,
        userId: data.userId,
        taskId: data.taskId,
        boardId: data.boardId,
        position: data.position,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  async upsertOrders(orders: UpsertUserTaskOrderData[]): Promise<void> {
    for (const o of orders) {
      await this.upsertOrder(o);
    }
  }

  async deleteByBoardAndUser(boardId: string, userId: string): Promise<void> {
    for (const [k, v] of this.store.entries()) {
      if (v.boardId === boardId && v.userId === userId) {
        this.store.delete(k);
      }
    }
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    for (const [k, v] of this.store.entries()) {
      if (v.taskId === taskId) {
        this.store.delete(k);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite: GetMyTasksUseCase (STEP 7 – Moje úkoly)
// ─────────────────────────────────────────────────────────────

describe("STEP 7 – GetMyTasksUseCase (Osobní pracovní prostor „Moje úkoly“)", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let areaRepo: InMemoryAreaRepository;
  let userRepo: InMemoryUserRepository;
  let taskParticipantRepo: InMemoryTaskParticipantRepository;
  let taskRepo: InMemoryTaskRepository;
  let userTaskOrderRepo: InMemoryUserTaskOrderRepository;
  let useCase: GetMyTasksUseCase;

  const userMilan: UserRecord = {
    id: "user-milan",
    name: "Milan Šperka",
    email: "milan@test.local",
    globalRole: "USER",
    isActive: true,
    deletedAt: null,
  };

  const userAdam: UserRecord = {
    id: "user-adam",
    name: "Adam Kolega",
    email: "adam@test.local",
    globalRole: "USER",
    isActive: true,
    deletedAt: null,
  };

  const userAdmin: UserRecord = {
    id: "user-admin",
    name: "Admin Systému",
    email: "admin@test.local",
    globalRole: "ADMIN",
    isActive: true,
    deletedAt: null,
  };

  const actorMilan: ActorContext = {
    actor_user_id: userMilan.id,
    global_role: "USER",
    session_id: "session-milan",
    is_active: true,
  };

  const actorAdam: ActorContext = {
    actor_user_id: userAdam.id,
    global_role: "USER",
    session_id: "session-adam",
    is_active: true,
  };

  const actorAdmin: ActorContext = {
    actor_user_id: userAdmin.id,
    global_role: "ADMIN",
    session_id: "session-admin",
    is_active: true,
  };

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    boardRepo.membershipRepo = membershipRepo;
    areaRepo = new InMemoryAreaRepository();
    userRepo = new InMemoryUserRepository();
    taskParticipantRepo = new InMemoryTaskParticipantRepository();
    taskRepo = new InMemoryTaskRepository();
    taskRepo.participantRepo = taskParticipantRepo;
    userTaskOrderRepo = new InMemoryUserTaskOrderRepository();

    await userRepo.create(userMilan);
    await userRepo.create(userAdam);
    await userRepo.create(userAdmin);

    useCase = new GetMyTasksUseCase(
      boardRepo,
      taskRepo,
      taskParticipantRepo,
      areaRepo,
      userRepo,
      userTaskOrderRepo,
    );
  });

  test("1. ASSIGNEE: Uživatel vidí úkol, kde je přímo přiřazeným řešitelem", async () => {
    const board = await boardRepo.create({ name: "Projekt Alpha", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    const task = await taskRepo.create({
      boardId: board.id,
      title: "Úkol pro Milana",
      createdBy: userAdam.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].id, task.id);
    assert.strictEqual(res.data[0].userRole, "ASSIGNEE");
    assert.strictEqual(res.data[0].boardName, "Projekt Alpha");
  });

  test("2. PARTICIPANT: Uživatel vidí úkol, kde je zapsán jako spoluřešitel", async () => {
    const board = await boardRepo.create({ name: "Projekt Alpha", createdBy: userAdam.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });
    await membershipRepo.create({ boardId: board.id, userId: userAdam.id, role: "OWNER" });

    const task = await taskRepo.create({
      boardId: board.id,
      title: "Společný úkol",
      createdBy: userAdam.id,
      assigneeId: userAdam.id,
      status: "ROZPRACOVANÉ",
    });
    await taskParticipantRepo.addParticipant(task.id, userMilan.id);

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].id, task.id);
    assert.strictEqual(res.data[0].userRole, "PARTICIPANT");
    assert.strictEqual(res.data[0].assignee?.name, "Adam Kolega");
  });

  test("3. CREATED_BY bez řešitelského vztahu NENÍ zahrnut do Moje úkoly", async () => {
    const board = await boardRepo.create({ name: "Projekt Alpha", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "OWNER" });
    await membershipRepo.create({ boardId: board.id, userId: userAdam.id, role: "MEMBER" });

    // Milan úkol pouze zadal, ale řeší ho Adam a Milan není spoluřešitel
    await taskRepo.create({
      boardId: board.id,
      title: "Úkol zadaný Milanem pro Adama",
      createdBy: userMilan.id,
      assigneeId: userAdam.id,
      status: "ROZPRACOVANÉ",
    });

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 0, "Zadavatelský úkol bez řešitelské vazby nesmí být v Moje úkoly");
  });

  test("4. Nečlen NENÍ zahrnut (úkol z nástěnky, kde uživatel není členem, se nezobrazí)", async () => {
    const boardSecret = await boardRepo.create({ name: "Tajný Projekt", createdBy: userAdam.id });
    await membershipRepo.create({ boardId: boardSecret.id, userId: userAdam.id, role: "OWNER" });

    // Úkol by sice mohl mít v DB omylem assigneeId = userMilan, ale Milan není členem boardu
    await taskRepo.create({
      boardId: boardSecret.id,
      title: "Cizí úkol",
      createdBy: userAdam.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 0, "Nečlen nástěnky nesmí vidět žádný úkol");
  });

  test("5. Odebraný člen již úkoly nevidí", async () => {
    const board = await boardRepo.create({ name: "Projekt Beta", createdBy: userAdam.id });
    await membershipRepo.create({ boardId: board.id, userId: userAdam.id, role: "OWNER" });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    const task = await taskRepo.create({
      boardId: board.id,
      title: "Úkol před odebráním",
      createdBy: userAdam.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    // Před odebráním úkol vidí
    let res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;
    assert.strictEqual(res.data.length, 1);

    // Milan je odebrán z členství
    await membershipRepo.delete(board.id, userMilan.id);

    // Po odebrání úkol nevidí
    res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;
    assert.strictEqual(res.data.length, 0);
  });

  test("6. Soft-deleted board se v Moje úkoly nezobrazí", async () => {
    const board = await boardRepo.create({ name: "Smazaný Projekt", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "OWNER" });

    await taskRepo.create({
      boardId: board.id,
      title: "Úkol na smazané nástěnce",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    // Soft-delete nástěnky
    await boardRepo.softDelete(board.id, new Date());

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 0, "Úkoly ze soft-deleted nástěnky se nesmí zobrazit");
  });

  test("7. ADMIN vidí pouze vlastní relevantní úkoly (nevidí cizí úkoly jen z titulu ADMINa)", async () => {
    const board = await boardRepo.create({ name: "Firma", createdBy: userAdam.id });
    await membershipRepo.create({ boardId: board.id, userId: userAdam.id, role: "OWNER" });

    // Úkol pro Adama (admin ho neřeší)
    await taskRepo.create({
      boardId: board.id,
      title: "Adamova práce",
      createdBy: userAdam.id,
      assigneeId: userAdam.id,
      status: "ROZPRACOVANÉ",
    });

    // Úkol pro Admina
    const adminTask = await taskRepo.create({
      boardId: board.id,
      title: "Adminova práce",
      createdBy: userAdam.id,
      assigneeId: userAdmin.id,
      status: "ROZPRACOVANÉ",
    });

    const res = await useCase.execute(actorAdmin);
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].id, adminTask.id);
  });

  test("8. ACTIVE vrací výhradně NOVÉ, PŘEVZATÉ, ROZPRACOVANÉ, ČEKÁ SE (HOTOVO sem nepatří!)", async () => {
    const board = await boardRepo.create({ name: "Stavy Test", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    const statuses: TaskStatus[] = [
      "NOVÉ",
      "PŘEVZATÉ",
      "ROZPRACOVANÉ",
      "ČEKÁ SE",
      "HOTOVO",
      "ARCHIVOVÁNO",
    ];

    for (const s of statuses) {
      await taskRepo.create({
        boardId: board.id,
        title: `Úkol ve stavu ${s}`,
        createdBy: userMilan.id,
        assigneeId: userMilan.id,
        status: s,
      });
    }

    // Výchozí filtr je ACTIVE
    const res = await useCase.execute(actorMilan, { filter: "ACTIVE" });
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 4);
    const returnedStatuses = res.data.map((t) => t.status);
    assert.ok(returnedStatuses.includes("NOVÉ"));
    assert.ok(returnedStatuses.includes("PŘEVZATÉ"));
    assert.ok(returnedStatuses.includes("ROZPRACOVANÉ"));
    assert.ok(returnedStatuses.includes("ČEKÁ SE"));
    assert.ok(!returnedStatuses.includes("HOTOVO"), "HOTOVO nesmí být v ACTIVE!");
    assert.ok(!returnedStatuses.includes("ARCHIVOVÁNO"), "ARCHIVOVÁNO nesmí být v ACTIVE!");
  });

  test("9. COMPLETED vrací pouze úkoly ve stavu HOTOVO", async () => {
    const board = await boardRepo.create({ name: "Board", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    await taskRepo.create({
      boardId: board.id,
      title: "Hotový úkol",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "HOTOVO",
    });
    await taskRepo.create({
      boardId: board.id,
      title: "Rozpracovaný úkol",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    const res = await useCase.execute(actorMilan, { filter: "COMPLETED" });
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].status, "HOTOVO");
  });

  test("10. ARCHIVED vrací pouze úkoly ve stavu ARCHIVOVÁNO", async () => {
    const board = await boardRepo.create({ name: "Board", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    await taskRepo.create({
      boardId: board.id,
      title: "Archivní úkol",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ARCHIVOVÁNO",
    });
    await taskRepo.create({
      boardId: board.id,
      title: "Aktivní úkol",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    const res = await useCase.execute(actorMilan, { filter: "ARCHIVED" });
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].status, "ARCHIVOVÁNO");
  });

  test("11. ALL vrací všechny stavy", async () => {
    const board = await boardRepo.create({ name: "Board", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    await taskRepo.create({
      boardId: board.id,
      title: "Aktivní",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });
    await taskRepo.create({
      boardId: board.id,
      title: "Hotový",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "HOTOVO",
    });
    await taskRepo.create({
      boardId: board.id,
      title: "Archivovaný",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ARCHIVOVÁNO",
    });

    const res = await useCase.execute(actorMilan, { filter: "ALL" });
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 3);
  });

  test("12. roleFilter ASSIGNEE filtruje pouze úkoly, kde je řešitel", async () => {
    const board = await boardRepo.create({ name: "Board", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });
    await membershipRepo.create({ boardId: board.id, userId: userAdam.id, role: "MEMBER" });

    // Úkol jako assignee
    await taskRepo.create({
      boardId: board.id,
      title: "Můj jako assignee",
      createdBy: userAdam.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    // Úkol jako participant
    const taskPart = await taskRepo.create({
      boardId: board.id,
      title: "Můj jako participant",
      createdBy: userAdam.id,
      assigneeId: userAdam.id,
      status: "ROZPRACOVANÉ",
    });
    await taskParticipantRepo.addParticipant(taskPart.id, userMilan.id);

    const res = await useCase.execute(actorMilan, { roleFilter: "ASSIGNEE" });
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].userRole, "ASSIGNEE");
  });

  test("13. roleFilter PARTICIPANT filtruje pouze úkoly, kde je spoluřešitel", async () => {
    const board = await boardRepo.create({ name: "Board", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });
    await membershipRepo.create({ boardId: board.id, userId: userAdam.id, role: "MEMBER" });

    await taskRepo.create({
      boardId: board.id,
      title: "Můj jako assignee",
      createdBy: userAdam.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    const taskPart = await taskRepo.create({
      boardId: board.id,
      title: "Můj jako participant",
      createdBy: userAdam.id,
      assigneeId: userAdam.id,
      status: "ROZPRACOVANÉ",
    });
    await taskParticipantRepo.addParticipant(taskPart.id, userMilan.id);

    const res = await useCase.execute(actorMilan, { roleFilter: "PARTICIPANT" });
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].userRole, "PARTICIPANT");
  });

  test("14. ASSIGNEE má přednost před PARTICIPANT (když je uživatel obojí)", async () => {
    const board = await boardRepo.create({ name: "Board", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    // Milan je assignee a zároveň zůstal v participants
    const task = await taskRepo.create({
      boardId: board.id,
      title: "Obojí",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });
    await taskParticipantRepo.addParticipant(task.id, userMilan.id);

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].userRole, "ASSIGNEE", "ASSIGNEE musí mít přednost");
  });

  test("15. Více nástěnek: úkoly jsou správně seskupeny / seřazeny podle boardName", async () => {
    const boardZ = await boardRepo.create({ name: "Zebra Board", createdBy: userMilan.id });
    const boardA = await boardRepo.create({ name: "Alfa Board", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: boardZ.id, userId: userMilan.id, role: "MEMBER" });
    await membershipRepo.create({ boardId: boardA.id, userId: userMilan.id, role: "MEMBER" });

    await taskRepo.create({
      boardId: boardZ.id,
      title: "Úkol na Zebra",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });
    await taskRepo.create({
      boardId: boardA.id,
      title: "Úkol na Alfa",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;

    assert.strictEqual(res.data.length, 2);
    assert.strictEqual(res.data[0].boardName, "Alfa Board");
    assert.strictEqual(res.data[1].boardName, "Zebra Board");
  });

  test("16. Správný boardName je obohacen pro každý úkol", async () => {
    const board = await boardRepo.create({ name: "Marketingový Tým", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    await taskRepo.create({
      boardId: board.id,
      title: "Kampaň",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;
    assert.strictEqual(res.data[0].boardName, "Marketingový Tým");
  });

  test("17. Správný areaName je obohacen pro úkoly v oblasti i bez oblasti", async () => {
    const board = await boardRepo.create({ name: "Vývoj", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    const area = await areaRepo.create({ boardId: board.id, name: "Backend" });

    await taskRepo.create({
      boardId: board.id,
      areaId: area.id,
      title: "API endpoint",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });
    await taskRepo.create({
      boardId: board.id,
      areaId: null,
      title: "Obecná porada",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;
    assert.strictEqual(res.data.length, 2);
    const withArea = res.data.find((t: MyTaskView) => t.title === "API endpoint");
    const withoutArea = res.data.find((t: MyTaskView) => t.title === "Obecná porada");

    assert.strictEqual(withArea?.areaName, "Backend");
    assert.strictEqual(withoutArea?.areaName, null);
  });

  test("18. Zachování osobního pořadí uvnitř konkrétní nástěnky", async () => {
    const board = await boardRepo.create({ name: "Board", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    const task1 = await taskRepo.create({
      boardId: board.id,
      title: "Úkol 1",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });
    const task2 = await taskRepo.create({
      boardId: board.id,
      title: "Úkol 2",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    // Milan si nastaví Úkol 2 na 1000 a Úkol 1 na 2000
    await userTaskOrderRepo.upsertOrder({
      userId: userMilan.id,
      taskId: task2.id,
      boardId: board.id,
      position: 1000,
    });
    await userTaskOrderRepo.upsertOrder({
      userId: userMilan.id,
      taskId: task1.id,
      boardId: board.id,
      position: 2000,
    });

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;
    assert.strictEqual(res.data[0].id, task2.id);
    assert.strictEqual(res.data[1].id, task1.id);
  });

  test("19. Deterministický fallback pro nepozicované úkoly (SPĚCHÁ před BĚŽNÁ, termín, createdAt, ID)", async () => {
    const board = await boardRepo.create({ name: "Board", createdBy: userMilan.id });
    await membershipRepo.create({ boardId: board.id, userId: userMilan.id, role: "MEMBER" });

    const normal = await taskRepo.create({
      boardId: board.id,
      title: "Běžný",
      priority: "BĚŽNÁ",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });
    const urgent = await taskRepo.create({
      boardId: board.id,
      title: "Spěchající",
      priority: "SPĚCHÁ",
      createdBy: userMilan.id,
      assigneeId: userMilan.id,
      status: "ROZPRACOVANÉ",
    });

    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    if (!res.success) return;
    assert.strictEqual(res.data[0].id, urgent.id, "SPĚCHÁ musí být před BĚŽNÁ");
    assert.strictEqual(res.data[1].id, normal.id);
  });

  test("20. Neautentizovaný nebo neaktivní actor vrací AuthenticationError", async () => {
    const resNull = await useCase.execute(null);
    assert.strictEqual(resNull.success, false);
    assert.ok(resNull.error instanceof AuthenticationError);

    const inactiveActor: ActorContext = {
      actor_user_id: userMilan.id,
      global_role: "USER",
      session_id: "inactive-sess",
      is_active: false,
    };
    const resInactive = await useCase.execute(inactiveActor);
    assert.strictEqual(resInactive.success, false);
    assert.ok(resInactive.error instanceof AuthenticationError);
  });

  test("21. Prázdný seznam autorizovaných nástěnek vrací prázdný seznam [] bez chyb", async () => {
    // Milan nemá žádné členství
    const res = await useCase.execute(actorMilan);
    assert.strictEqual(res.success, true);
    assert.deepStrictEqual(res.data, []);
  });
});
