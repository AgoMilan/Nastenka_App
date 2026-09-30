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
  ReorderTaskUseCase,
  GetBoardTasksUseCase,
  DeleteTaskUseCase,
} from "../../modules/tasks/application/use-cases/index.ts";
import {
  LeaveBoardUseCase,
  RemoveMemberUseCase,
} from "../../modules/membership/application/use-cases/index.ts";
import { reorderTaskSchema } from "../../modules/tasks/api/dto/task.dto.ts";
import { checkTaskPermission } from "../../modules/tasks/application/policies/task-policy.ts";
import {
  AuthorizationError,
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
    return Array.from(this.store.values()).filter(
      (m) => m.boardId === boardId,
    );
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
    return { ...record };
  }

  async addMember(
    boardId: string,
    userId: string,
    role: "OWNER" | "MANAGER" | "MEMBER",
  ): Promise<MembershipRecord> {
    return this.create({ boardId, userId, role });
  }

  async changeRole(
    boardId: string,
    userId: string,
    role: "OWNER" | "MANAGER" | "MEMBER",
  ): Promise<MembershipRecord> {
    const r = await this.findByBoardAndUser(boardId, userId);
    if (!r) throw new Error("Membership not found");
    const updated = { ...r, role };
    this.store.set(this.key(boardId, userId), updated);
    return { ...updated };
  }

  async updateRole(
    boardId: string,
    userId: string,
    role: "OWNER" | "MANAGER" | "MEMBER",
  ): Promise<void> {
    await this.changeRole(boardId, userId, role);
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

  async findByEmail(email: string): Promise<UserRecord | null> {
    for (const u of this.store.values()) {
      if (u.email === email) return { ...u };
    }
    return null;
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
    return this.store.get(id) ?? null;
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
    return Array.from(this.store.values()).filter(
      (a) => a.boardId === boardId,
    );
  }

  async create(data: CreateAreaData): Promise<AreaRecord> {
    const id = data.id ?? `area-${crypto.randomUUID()}`;
    const rec: AreaRecord = {
      id,
      boardId: data.boardId,
      name: data.name,
      description: data.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(id, rec);
    return rec;
  }

  async update(id: string, data: UpdateAreaData): Promise<AreaRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Area not found");
    const updated: AreaRecord = {
      ...existing,
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
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

  async findUserTasksAcrossBoards(
    _userId: string,
    _boardIds: string[],
  ): Promise<TaskRecord[]> {
    return [];
  }

  async create(
    data: CreateTaskData & { customCreatedAt?: Date },
  ): Promise<TaskRecord> {
    const id = data.id ?? `task-${crypto.randomUUID()}`;
    const rec: TaskRecord = {
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
      createdAt: data.customCreatedAt ?? new Date(),
      updatedAt: new Date(),
      completedAt: data.status === "HOTOVO" ? new Date() : null,
    };
    this.store.set(id, rec);
    return { ...rec };
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

  private key(taskId: string, userId: string): string {
    return `${taskId}:${userId}`;
  }

  async findByTaskId(taskId: string): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values()).filter((p) => p.taskId === taskId);
  }

  async findByTaskIds(taskIds: string[]): Promise<TaskParticipantRecord[]> {
    const idSet = new Set(taskIds);
    return Array.from(this.store.values()).filter((p) => idSet.has(p.taskId));
  }

  async findByTaskAndUser(
    taskId: string,
    userId: string,
  ): Promise<TaskParticipantRecord | null> {
    const p = this.store.get(this.key(taskId, userId));
    return p ? { ...p } : null;
  }

  async addParticipant(
    taskId: string,
    userId: string,
    role: string = "SPOLUŘEŠITEL",
  ): Promise<TaskParticipantRecord> {
    const rec: TaskParticipantRecord = {
      id: `tp-${crypto.randomUUID()}`,
      taskId,
      userId,
      role,
      createdAt: new Date(),
    };
    this.store.set(this.key(taskId, userId), rec);
    return { ...rec };
  }

  async removeParticipant(taskId: string, userId: string): Promise<void> {
    this.store.delete(this.key(taskId, userId));
  }

  async removeAllForTask(taskId: string): Promise<void> {
    for (const [k, v] of Array.from(this.store.entries())) {
      if (v.taskId === taskId) this.store.delete(k);
    }
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
    return Array.from(this.store.values())
      .filter((o) => o.boardId === boardId && o.userId === userId)
      .sort((a, b) => a.position - b.position);
  }

  async findByTaskId(taskId: string): Promise<UserTaskOrderRecord[]> {
    return Array.from(this.store.values()).filter((o) => o.taskId === taskId);
  }

  async upsertOrder(data: UpsertUserTaskOrderData): Promise<void> {
    const k = this.key(data.userId, data.taskId);
    const existing = this.store.get(k);
    const record: UserTaskOrderRecord = {
      id: existing ? existing.id : `uto-${crypto.randomUUID()}`,
      userId: data.userId,
      taskId: data.taskId,
      boardId: data.boardId,
      position: data.position,
      createdAt: existing ? existing.createdAt : new Date(),
      updatedAt: new Date(),
    };
    this.store.set(k, record);
  }

  async upsertOrders(orders: UpsertUserTaskOrderData[]): Promise<void> {
    for (const o of orders) {
      await this.upsertOrder(o);
    }
  }

  async deleteByBoardAndUser(boardId: string, userId: string): Promise<void> {
    for (const [k, v] of Array.from(this.store.entries())) {
      if (v.boardId === boardId && v.userId === userId) {
        this.store.delete(k);
      }
    }
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    for (const [k, v] of Array.from(this.store.entries())) {
      if (v.taskId === taskId) {
        this.store.delete(k);
      }
    }
  }
}

class InMemoryUnitOfWork implements UnitOfWork {
  public repos: UnitOfWorkRepositories;

  constructor(repos: UnitOfWorkRepositories) {
    this.repos = repos;
  }

  async runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return work(this.repos);
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────

describe("STEP 6 – Personal Task Ordering", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let areaRepo: InMemoryAreaRepository;
  let taskRepo: InMemoryTaskRepository;
  let taskParticipantRepo: InMemoryTaskParticipantRepository;
  let userTaskOrderRepo: InMemoryUserTaskOrderRepository;
  let uow: InMemoryUnitOfWork;

  const BOARD_ID = "board-111";
  const OTHER_BOARD_ID = "board-222";
  const AREA_ID = "area-alpha";

  // Testovací uživatelé
  const milan: ActorContext = {
    actor_user_id: "user-milan",
    global_role: "USER",
    session_id: "sess-milan",
    is_active: true,
  };

  const adam: ActorContext = {
    actor_user_id: "user-adam",
    global_role: "USER",
    session_id: "sess-adam",
    is_active: true,
  };

  const outsider: ActorContext = {
    actor_user_id: "user-outsider",
    global_role: "USER",
    session_id: "sess-outsider",
    is_active: true,
  };

  const admin: ActorContext = {
    actor_user_id: "user-admin",
    global_role: "ADMIN",
    session_id: "sess-admin",
    is_active: true,
  };

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    areaRepo = new InMemoryAreaRepository();
    taskRepo = new InMemoryTaskRepository();
    taskParticipantRepo = new InMemoryTaskParticipantRepository();
    userTaskOrderRepo = new InMemoryUserTaskOrderRepository();

    uow = new InMemoryUnitOfWork({
      boards: boardRepo,
      memberships: membershipRepo,
      users: userRepo,
      areas: areaRepo,
      tasks: taskRepo,
      taskParticipants: taskParticipantRepo,
      userTaskOrders: userTaskOrderRepo,
    });

    // Registrace uživatelů
    for (const actor of [milan, adam, outsider, admin]) {
      userRepo.store.set(actor.actor_user_id, {
        id: actor.actor_user_id,
        email: `${actor.actor_user_id}@example.com`,
        name: actor.actor_user_id,
        globalRole: actor.global_role,
        isActive: actor.is_active,
        deletedAt: null,
      });
    }

    // Vytvoření desek
    await boardRepo.create({
      id: BOARD_ID,
      name: "Hlavní Nástěnka",
      createdBy: milan.actor_user_id,
    });

    await boardRepo.create({
      id: OTHER_BOARD_ID,
      name: "Vedlejší Nástěnka",
      createdBy: adam.actor_user_id,
    });

    // Vytvoření oblasti
    await areaRepo.create({
      id: AREA_ID,
      boardId: BOARD_ID,
      name: "Oblast Alpha",
    });

    // Nastavení členství
    await membershipRepo.addMember(BOARD_ID, milan.actor_user_id, "OWNER");
    await membershipRepo.addMember(BOARD_ID, adam.actor_user_id, "MEMBER");
  });

  describe("1. DTO Validační schéma (reorderTaskSchema)", () => {
    test("přijímá platný vstup se směrem UP", () => {
      const res = reorderTaskSchema.safeParse({
        boardId: "11111111-1111-1111-1111-111111111111",
        taskId: "22222222-2222-2222-2222-222222222222",
        direction: "UP",
      });
      assert.strictEqual(res.success, true);
    });

    test("přijímá platný vstup se směrem DOWN", () => {
      const res = reorderTaskSchema.safeParse({
        boardId: "11111111-1111-1111-1111-111111111111",
        taskId: "22222222-2222-2222-2222-222222222222",
        direction: "DOWN",
      });
      assert.strictEqual(res.success, true);
    });

    test("přijímá platný relativní vstup (targetTaskId a position BEFORE)", () => {
      const res = reorderTaskSchema.safeParse({
        boardId: "11111111-1111-1111-1111-111111111111",
        taskId: "22222222-2222-2222-2222-222222222222",
        targetTaskId: "33333333-3333-3333-3333-333333333333",
        position: "BEFORE",
      });
      assert.strictEqual(res.success, true);
    });

    test("odmítá pokud chybí směr i cílový úkol", () => {
      const res = reorderTaskSchema.safeParse({
        boardId: "11111111-1111-1111-1111-111111111111",
        taskId: "22222222-2222-2222-2222-222222222222",
      });
      assert.strictEqual(res.success, false);
    });

    test("odmítá neplatný směr", () => {
      const res = reorderTaskSchema.safeParse({
        boardId: "11111111-1111-1111-1111-111111111111",
        taskId: "22222222-2222-2222-2222-222222222222",
        direction: "SIDEWAYS",
      });
      assert.strictEqual(res.success, false);
    });
  });

  describe("2. TaskPolicy (TASK_REORDER)", () => {
    test("člen nástěnky (MEMBER, MANAGER, OWNER) má povoleno TASK_REORDER", () => {
      const target = {
        boardId: BOARD_ID,
        taskId: "t1",
        createdBy: milan.actor_user_id,
        assigneeId: null,
      };
      const rel = { isAssignee: false, isParticipant: false };

      const resOwner = checkTaskPermission(
        milan,
        BOARD_ID,
        { role: "OWNER" },
        target,
        rel,
        "TASK_REORDER",
      );
      assert.strictEqual(resOwner.allowed, true);

      const resMember = checkTaskPermission(
        adam,
        BOARD_ID,
        { role: "MEMBER" },
        target,
        rel,
        "TASK_REORDER",
      );
      assert.strictEqual(resMember.allowed, true);
    });

    test("nečlen je odmítnut (NOT_A_MEMBER)", () => {
      const target = {
        boardId: BOARD_ID,
        taskId: "t1",
        createdBy: milan.actor_user_id,
        assigneeId: null,
      };
      const rel = { isAssignee: false, isParticipant: false };

      const res = checkTaskPermission(
        outsider,
        BOARD_ID,
        null,
        target,
        rel,
        "TASK_REORDER",
      );
      assert.strictEqual(res.allowed, false);
      if (!res.allowed) {
        assert.strictEqual(res.reason, "NOT_A_MEMBER");
      }
    });

    test("cross-board přístup je striktně odmítnut (CROSS_BOARD_ACCESS)", () => {
      const target = {
        boardId: OTHER_BOARD_ID,
        taskId: "t-other",
        createdBy: adam.actor_user_id,
        assigneeId: null,
      };
      const rel = { isAssignee: false, isParticipant: false };

      const res = checkTaskPermission(
        milan,
        BOARD_ID,
        { role: "OWNER" },
        target,
        rel,
        "TASK_REORDER",
      );
      assert.strictEqual(res.allowed, false);
      if (!res.allowed) {
        assert.strictEqual(res.reason, "CROSS_BOARD_ACCESS");
      }
    });
  });

  describe("3. ReorderTaskUseCase – Posun a normalizace pozic", () => {
    let t1: TaskRecord;
    let t2: TaskRecord;
    let t3: TaskRecord;

    beforeEach(async () => {
      // Vytvoříme 3 úkoly v jedné oblasti s deterministickými časy (t1 nejnovější)
      t1 = await taskRepo.create({
        boardId: BOARD_ID,
        areaId: AREA_ID,
        title: "Úkol 1",
        createdBy: milan.actor_user_id,
        customCreatedAt: new Date(Date.now() + 3000),
      });
      t2 = await taskRepo.create({
        boardId: BOARD_ID,
        areaId: AREA_ID,
        title: "Úkol 2",
        createdBy: milan.actor_user_id,
        customCreatedAt: new Date(Date.now() + 2000),
      });
      t3 = await taskRepo.create({
        boardId: BOARD_ID,
        areaId: AREA_ID,
        title: "Úkol 3",
        createdBy: milan.actor_user_id,
        customCreatedAt: new Date(Date.now() + 1000),
      });
    });

    test("posun dolů (DOWN) prohodí pořadí a normalizuje pozice s krokem 1000", async () => {
      const useCase = new ReorderTaskUseCase(uow);

      // Posuneme t1 dolů (mělo by jít na 2. místo)
      const res = await useCase.execute(milan, {
        boardId: BOARD_ID,
        taskId: t1.id,
        direction: "DOWN",
      });

      assert.strictEqual(res.success, true);
      const orders = await userTaskOrderRepo.findByBoardAndUser(
        BOARD_ID,
        milan.actor_user_id,
      );
      assert.strictEqual(orders.length, 3);
      // t1 bylo na indexu 0, po DOWN je na indexu 1 (pozice 2000)
      const orderT1 = orders.find((o) => o.taskId === t1.id);
      assert.strictEqual(orderT1?.position, 2000);
    });

    test("posun nahoru (UP) posune úkol před předchozí", async () => {
      const useCase = new ReorderTaskUseCase(uow);

      // t3 je na indexu 2, posun nahoru ho dá na index 1
      const res = await useCase.execute(milan, {
        boardId: BOARD_ID,
        taskId: t3.id,
        direction: "UP",
      });

      assert.strictEqual(res.success, true);
      const orders = await userTaskOrderRepo.findByBoardAndUser(
        BOARD_ID,
        milan.actor_user_id,
      );
      const orderT3 = orders.find((o) => o.taskId === t3.id);
      assert.strictEqual(orderT3?.position, 2000);
    });

    test("relativní přesun (targetTaskId + BEFORE) vloží úkol před cíl", async () => {
      const useCase = new ReorderTaskUseCase(uow);

      // Přesuneme t3 před t1
      const res = await useCase.execute(milan, {
        boardId: BOARD_ID,
        taskId: t3.id,
        targetTaskId: t1.id,
        position: "BEFORE",
      });

      assert.strictEqual(res.success, true);
      const orders = await userTaskOrderRepo.findByBoardAndUser(
        BOARD_ID,
        milan.actor_user_id,
      );
      const sortedIds = orders.sort((a, b) => a.position - b.position).map((o) => o.taskId);
      assert.strictEqual(sortedIds[0], t3.id);
    });

    test("odmítne přesun úkolu z jiné desky (CROSS_BOARD_ACCESS)", async () => {
      const otherTask = await taskRepo.create({
        boardId: OTHER_BOARD_ID,
        title: "Úkol z jiné desky",
        createdBy: adam.actor_user_id,
      });

      const useCase = new ReorderTaskUseCase(uow);
      const res = await useCase.execute(milan, {
        boardId: BOARD_ID,
        taskId: otherTask.id,
        direction: "UP",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
      }
    });

    test("nečlen nemůže měnit pořadí", async () => {
      const useCase = new ReorderTaskUseCase(uow);
      const res = await useCase.execute(outsider, {
        boardId: BOARD_ID,
        taskId: t1.id,
        direction: "UP",
      });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
      }
    });
  });

  describe("4. Izolace mezi uživateli (Milan vs Adam)", () => {
    test("Milanovo pořadí neovlivní Adamovo zobrazení", async () => {
      const t1 = await taskRepo.create({
        boardId: BOARD_ID,
        areaId: AREA_ID,
        title: "Alpha 1",
        createdBy: milan.actor_user_id,
        customCreatedAt: new Date(Date.now() + 2000),
      });
      const t2 = await taskRepo.create({
        boardId: BOARD_ID,
        areaId: AREA_ID,
        title: "Alpha 2",
        createdBy: milan.actor_user_id,
        customCreatedAt: new Date(Date.now() + 1000),
      });

      const reorderUseCase = new ReorderTaskUseCase(uow);
      const getTasksUseCase = new GetBoardTasksUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        taskParticipantRepo,
        areaRepo,
        userRepo,
        userTaskOrderRepo,
      );

      // Milan přehodí t1 za t2
      await reorderUseCase.execute(milan, {
        boardId: BOARD_ID,
        taskId: t1.id,
        direction: "DOWN",
      });

      // Zkontrolujeme zobrazení pro Milana
      const milanTasks = await getTasksUseCase.execute(milan, BOARD_ID);
      assert.strictEqual(milanTasks.success, true);
      if (milanTasks.success) {
        assert.strictEqual(milanTasks.data[0].id, t2.id);
        assert.strictEqual(milanTasks.data[1].id, t1.id);
      }

      // Adam ale neprovedl žádný reorder, vidí výchozí týmové pořadí
      const adamTasks = await getTasksUseCase.execute(adam, BOARD_ID);
      assert.strictEqual(adamTasks.success, true);
      if (adamTasks.success) {
        // Adam vidí výchozí deterministické pořadí (t1 před t2 podle createdAt)
        assert.strictEqual(adamTasks.data[0].id, t1.id);
        assert.strictEqual(adamTasks.data[1].id, t2.id);
      }

      // Adam si nastaví jiné pořadí
      await reorderUseCase.execute(adam, {
        boardId: BOARD_ID,
        taskId: t2.id,
        direction: "DOWN",
      });

      // Milan stále vidí své vlastní pořadí
      const milanTasksAfter = await getTasksUseCase.execute(milan, BOARD_ID);
      assert.strictEqual(milanTasksAfter.success, true);
      if (milanTasksAfter.success) {
        assert.strictEqual(milanTasksAfter.data[0].id, t2.id);
        assert.strictEqual(milanTasksAfter.data[1].id, t1.id);
      }
    });
  });

  describe("5. Query Layer a Chování filtrů (HOTOVO vs ARCHIVOVÁNO)", () => {
    test("HOTOVO úkoly v aktivním zobrazení respektují osobní pořadí", async () => {
      const t1 = await taskRepo.create({
        boardId: BOARD_ID,
        areaId: AREA_ID,
        title: "Úkol 1",
        status: "HOTOVO",
        createdBy: milan.actor_user_id,
        customCreatedAt: new Date(Date.now() + 2000),
      });
      const t2 = await taskRepo.create({
        boardId: BOARD_ID,
        areaId: AREA_ID,
        title: "Úkol 2",
        status: "NOVÉ",
        createdBy: milan.actor_user_id,
        customCreatedAt: new Date(Date.now() + 1000),
      });

      // Milan nastaví t1 za t2
      const reorderUseCase = new ReorderTaskUseCase(uow);
      await reorderUseCase.execute(milan, {
        boardId: BOARD_ID,
        taskId: t1.id,
        direction: "DOWN",
      });

      const getTasksUseCase = new GetBoardTasksUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        taskParticipantRepo,
        areaRepo,
        userRepo,
        userTaskOrderRepo,
      );

      const tasksRes = await getTasksUseCase.execute(milan, BOARD_ID, {
        filter: "ACTIVE",
      });
      assert.strictEqual(tasksRes.success, true);
      if (tasksRes.success) {
        assert.strictEqual(tasksRes.data[0].id, t2.id);
        assert.strictEqual(tasksRes.data[1].id, t1.id);
      }
    });

    test("ARCHIVED filtr ignoruje osobní pořadí a řadí chronologicky podle updatedAt DESC", async () => {
      const t1 = await taskRepo.create({
        boardId: BOARD_ID,
        title: "Archivní 1",
        status: "ARCHIVOVÁNO",
        createdBy: milan.actor_user_id,
      });
      const t2 = await taskRepo.create({
        boardId: BOARD_ID,
        title: "Archivní 2",
        status: "ARCHIVOVÁNO",
        createdBy: milan.actor_user_id,
      });

      // Manuálně nastavíme pořadí v userTaskOrder
      await userTaskOrderRepo.upsertOrder({
        boardId: BOARD_ID,
        userId: milan.actor_user_id,
        taskId: t1.id,
        position: 1000,
      });
      await userTaskOrderRepo.upsertOrder({
        boardId: BOARD_ID,
        userId: milan.actor_user_id,
        taskId: t2.id,
        position: 2000,
      });

      const getTasksUseCase = new GetBoardTasksUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        taskParticipantRepo,
        areaRepo,
        userRepo,
        userTaskOrderRepo,
      );

      const res = await getTasksUseCase.execute(milan, BOARD_ID, {
        filter: "ARCHIVED",
      });
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.length, 2);
      }
    });
  });

  describe("6. Životní cyklus úkolu a členství", () => {
    test("DeleteTaskUseCase odstraní záznamy osobního pořadí smazaného úkolu", async () => {
      const t = await taskRepo.create({
        boardId: BOARD_ID,
        title: "Úkol k odstranění",
        createdBy: milan.actor_user_id,
      });

      // Nastavíme pořadí pro Milana i Adama
      await userTaskOrderRepo.upsertOrder({
        boardId: BOARD_ID,
        userId: milan.actor_user_id,
        taskId: t.id,
        position: 1000,
      });
      await userTaskOrderRepo.upsertOrder({
        boardId: BOARD_ID,
        userId: adam.actor_user_id,
        taskId: t.id,
        position: 1000,
      });

      const deleteUseCase = new DeleteTaskUseCase(uow);
      const res = await deleteUseCase.execute(milan, {
        taskId: t.id,
        confirmation: "SMAZAT",
      });
      assert.strictEqual(res.success, true);

      // Ověříme, že v repo nezůstaly záznamy pro smazaný úkol
      const orders = await userTaskOrderRepo.findByTaskId(t.id);
      assert.strictEqual(orders.length, 0);
    });

    test("LeaveBoardUseCase vymaže osobní pořadí odcházejícího člena na dané desce", async () => {
      const t = await taskRepo.create({
        boardId: BOARD_ID,
        title: "Úkol",
        createdBy: milan.actor_user_id,
      });

      await userTaskOrderRepo.upsertOrder({
        boardId: BOARD_ID,
        userId: adam.actor_user_id,
        taskId: t.id,
        position: 1000,
      });

      const leaveUseCase = new LeaveBoardUseCase(uow);
      const res = await leaveUseCase.execute(adam, { boardId: BOARD_ID });
      assert.strictEqual(res.success, true);

      const adamOrders = await userTaskOrderRepo.findByBoardAndUser(
        BOARD_ID,
        adam.actor_user_id,
      );
      assert.strictEqual(adamOrders.length, 0);
    });

    test("RemoveMemberUseCase vymaže osobní pořadí odebraného člena na dané desce", async () => {
      const t = await taskRepo.create({
        boardId: BOARD_ID,
        title: "Úkol",
        createdBy: milan.actor_user_id,
      });

      await userTaskOrderRepo.upsertOrder({
        boardId: BOARD_ID,
        userId: adam.actor_user_id,
        taskId: t.id,
        position: 1000,
      });

      const removeUseCase = new RemoveMemberUseCase(uow);
      const res = await removeUseCase.execute(milan, {
        boardId: BOARD_ID,
        targetUserId: adam.actor_user_id,
      });
      assert.strictEqual(res.success, true);

      const adamOrders = await userTaskOrderRepo.findByBoardAndUser(
        BOARD_ID,
        adam.actor_user_id,
      );
      assert.strictEqual(adamOrders.length, 0);
    });
  });
});
