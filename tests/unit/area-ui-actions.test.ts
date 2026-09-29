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
} from "../../modules/tasks/application/ports/index.ts";
import {
  CreateAreaUseCase,
  UpdateAreaUseCase,
  DeleteAreaUseCase,
} from "../../modules/areas/application/use-cases/index.ts";
import {
  createAreaSchema,
  updateAreaSchema,
  deleteAreaSchema,
} from "../../modules/areas/api/dto/area.dto.ts";
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// In-Memory Repositories for UI & Server Actions Testing
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

  async findActiveBoardsForUser() {
    return [];
  }

  async findActiveBoardsForAdmin() {
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
    if (!existing) {
      throw new Error(`Task not found: ${id}`);
    }
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

class InMemoryUnitOfWork implements UnitOfWork {
  public readonly boards: InMemoryBoardRepository;
  public readonly memberships: InMemoryMembershipRepository;
  public readonly users: InMemoryUserRepository;
  public readonly areas: InMemoryAreaRepository;
  public readonly tasks: InMemoryTaskRepository;

  constructor(
    boards: InMemoryBoardRepository,
    memberships: InMemoryMembershipRepository,
    users: InMemoryUserRepository,
    areas: InMemoryAreaRepository,
    tasks: InMemoryTaskRepository,
  ) {
    this.boards = boards;
    this.memberships = memberships;
    this.users = users;
    this.areas = areas;
    this.tasks = tasks;
  }

  async runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    const areaSnap = this.areas.clone();
    try {
      return await work({
        boards: this.boards,
        memberships: this.memberships,
        users: this.users,
        areas: this.areas,
        tasks: this.tasks,
      });
    } catch (e) {
      this.areas.restore(areaSnap);
      throw e;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Tests: STEP 2 – Area UI & Server Actions
// ─────────────────────────────────────────────────────────────

describe("STEP 2 – Area UI & Server Actions", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let areaRepo: InMemoryAreaRepository;
  let taskRepo: InMemoryTaskRepository;
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

  const nonMemberActor: ActorContext = {
    actor_user_id: "user-stranger",
    global_role: "USER",
    session_id: "sess-stranger",
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

  let testBoardId: string;
  let otherBoardId: string;

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    areaRepo = new InMemoryAreaRepository();
    taskRepo = new InMemoryTaskRepository();
    uow = new InMemoryUnitOfWork(
      boardRepo,
      membershipRepo,
      userRepo,
      areaRepo,
      taskRepo,
    );

    // Vytvoření testovacích boardů a členství
    const b1 = await boardRepo.create({
      name: "Hlavní Nástěnka",
      createdBy: ownerActor.actor_user_id,
    });
    testBoardId = b1.id;

    const b2 = await boardRepo.create({
      name: "Druhá Nástěnka",
      createdBy: "other-user",
    });
    otherBoardId = b2.id;

    await membershipRepo.create({
      boardId: testBoardId,
      userId: ownerActor.actor_user_id,
      role: "OWNER",
    });
    await membershipRepo.create({
      boardId: testBoardId,
      userId: managerActor.actor_user_id,
      role: "MANAGER",
    });
    await membershipRepo.create({
      boardId: testBoardId,
      userId: memberActor.actor_user_id,
      role: "MEMBER",
    });
  });

  // ───────────────────────────────────────────────────────────
  // 1. DTO & Zod Schemas Validation
  // ───────────────────────────────────────────────────────────
  describe("1. DTO Validační schémata pro formuláře", () => {
    describe("createAreaSchema", () => {
      test("přijímá platný vstup s názvem a popisem", () => {
        const parsed = createAreaSchema.safeParse({
          boardId: "board-1",
          name: "Vývoj",
          description: "Vývoj softwaru",
        });
        assert.equal(parsed.success, true);
        if (parsed.success) {
          assert.equal(parsed.data.name, "Vývoj");
          assert.equal(parsed.data.description, "Vývoj softwaru");
        }
      });

      test("přijímá platný vstup bez volitelného popisu", () => {
        const parsed = createAreaSchema.safeParse({
          boardId: "board-1",
          name: "Marketing",
        });
        assert.equal(parsed.success, true);
      });

      test("odmítá prázdný název nebo název tvořený jen mezerami", () => {
        const p1 = createAreaSchema.safeParse({ boardId: "b-1", name: "" });
        assert.equal(p1.success, false);

        const p2 = createAreaSchema.safeParse({ boardId: "b-1", name: "   " });
        assert.equal(p2.success, false);
      });

      test("odmítá chybějící boardId nebo prázdné boardId", () => {
        const p1 = createAreaSchema.safeParse({ name: "Vývoj" });
        assert.equal(p1.success, false);

        const p2 = createAreaSchema.safeParse({ boardId: "   ", name: "Vývoj" });
        assert.equal(p2.success, false);
      });

      test("odmítá název delší než 255 znaků", () => {
        const parsed = createAreaSchema.safeParse({
          boardId: "board-1",
          name: "A".repeat(256),
        });
        assert.equal(parsed.success, false);
      });

      test("odmítá popis delší než 1000 znaků", () => {
        const parsed = createAreaSchema.safeParse({
          boardId: "board-1",
          name: "Vývoj",
          description: "B".repeat(1001),
        });
        assert.equal(parsed.success, false);
      });
    });

    describe("updateAreaSchema", () => {
      test("přijímá platný vstup pro úpravu názvu i popisu", () => {
        const parsed = updateAreaSchema.safeParse({
          areaId: "area-1",
          name: "Nový název",
          description: "Nový popis",
        });
        assert.equal(parsed.success, true);
      });

      test("odmítá prázdné areaId", () => {
        const parsed = updateAreaSchema.safeParse({
          areaId: "   ",
          name: "Nový název",
        });
        assert.equal(parsed.success, false);
      });

      test("odmítá prázdný název pokud je uveden", () => {
        const parsed = updateAreaSchema.safeParse({
          areaId: "area-1",
          name: "   ",
        });
        assert.equal(parsed.success, false);
      });

      test("odmítá název delší než 255 znaků a popis delší než 1000 znaků", () => {
        const p1 = updateAreaSchema.safeParse({
          areaId: "area-1",
          name: "X".repeat(256),
        });
        assert.equal(p1.success, false);

        const p2 = updateAreaSchema.safeParse({
          areaId: "area-1",
          description: "Y".repeat(1001),
        });
        assert.equal(p2.success, false);
      });
    });

    describe("deleteAreaSchema", () => {
      test("přijímá přesné potvrzení 'SMAZAT'", () => {
        const parsed = deleteAreaSchema.safeParse({
          areaId: "area-1",
          confirmation: "SMAZAT",
        });
        assert.equal(parsed.success, true);
      });

      test("odmítá jakékoli jiné potvrzení (např. 'smazat', 'ANO', 'delete', '')", () => {
        const p1 = deleteAreaSchema.safeParse({
          areaId: "area-1",
          confirmation: "smazat",
        });
        assert.equal(p1.success, false);

        const p2 = deleteAreaSchema.safeParse({
          areaId: "area-1",
          confirmation: "ANO",
        });
        assert.equal(p2.success, false);

        const p3 = deleteAreaSchema.safeParse({
          areaId: "area-1",
          confirmation: "",
        });
        assert.equal(p3.success, false);
      });

      test("odmítá prázdné areaId", () => {
        const parsed = deleteAreaSchema.safeParse({
          areaId: "  ",
          confirmation: "SMAZAT",
        });
        assert.equal(parsed.success, false);
      });
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. UI Role Permission Derivation Rule
  // ───────────────────────────────────────────────────────────
  describe("2. UI Role Permission Derivation (canManageAreas)", () => {
    const evaluateCanManage = (
      actor: ActorContext,
      role: "OWNER" | "MANAGER" | "MEMBER" | null,
    ) => {
      return (
        actor.global_role === "ADMIN" || role === "OWNER" || role === "MANAGER"
      );
    };

    test("OWNER má canManage = true", () => {
      assert.equal(evaluateCanManage(ownerActor, "OWNER"), true);
    });

    test("MANAGER má canManage = true", () => {
      assert.equal(evaluateCanManage(managerActor, "MANAGER"), true);
    });

    test("ADMIN má canManage = true i bez role (role: null)", () => {
      assert.equal(evaluateCanManage(adminActor, null), true);
    });

    test("MEMBER má canManage = false", () => {
      assert.equal(evaluateCanManage(memberActor, "MEMBER"), false);
    });

    test("Běžný uživatel bez role má canManage = false", () => {
      assert.equal(evaluateCanManage(nonMemberActor, null), false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. Create Area Action / Use Case Flow
  // ───────────────────────────────────────────────────────────
  describe("3. CreateArea – oprávnění a logika", () => {
    test("OWNER může vytvořit oblast", async () => {
      const useCase = new CreateAreaUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        boardId: testBoardId,
        name: "Backend",
        description: "API a databáze",
      });

      assert.equal(res.success, true);
      if (!res.success) return;
      assert.equal(res.data.name, "Backend");
      assert.equal(res.data.boardId, testBoardId);
    });

    test("MANAGER může vytvořit oblast", async () => {
      const useCase = new CreateAreaUseCase(uow);
      const res = await useCase.execute(managerActor, {
        boardId: testBoardId,
        name: "Frontend",
      });

      assert.equal(res.success, true);
      if (!res.success) return;
      assert.equal(res.data.name, "Frontend");
    });

    test("ADMIN může vytvořit oblast i bez členství na boardu", async () => {
      const useCase = new CreateAreaUseCase(uow);
      const res = await useCase.execute(adminActor, {
        boardId: otherBoardId,
        name: "DevOps",
      });

      assert.equal(res.success, true);
      if (!res.success) return;
      assert.equal(res.data.name, "DevOps");
    });

    test("MEMBER NEMŮŽE vytvořit oblast (AuthorizationError / INSUFFICIENT_ROLE)", async () => {
      const useCase = new CreateAreaUseCase(uow);
      const res = await useCase.execute(memberActor, {
        boardId: testBoardId,
        name: "Nepovolená oblast",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
      assert.equal(
        (res.error as AuthorizationError).reason,
        "INSUFFICIENT_ROLE",
      );
    });

    test("Nečlen NEMŮŽE vytvořit oblast (AuthorizationError / NOT_A_MEMBER)", async () => {
      const useCase = new CreateAreaUseCase(uow);
      const res = await useCase.execute(nonMemberActor, {
        boardId: testBoardId,
        name: "Cizí oblast",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
      assert.equal((res.error as AuthorizationError).reason, "NOT_A_MEMBER");
    });

    test("Duplicitní název oblasti na stejném boardu je zamítnut (ConflictError)", async () => {
      const useCase = new CreateAreaUseCase(uow);
      const r1 = await useCase.execute(ownerActor, {
        boardId: testBoardId,
        name: "Design",
      });
      assert.equal(r1.success, true);

      const r2 = await useCase.execute(ownerActor, {
        boardId: testBoardId,
        name: "Design",
      });
      assert.equal(r2.success, false);
      assert.ok(r2.error instanceof ConflictError);
    });

    test("Stejný název oblasti na RŮZNÝCH boardech je povolen", async () => {
      const useCase = new CreateAreaUseCase(uow);
      const r1 = await useCase.execute(ownerActor, {
        boardId: testBoardId,
        name: "Sdílené jméno",
      });
      assert.equal(r1.success, true);

      const r2 = await useCase.execute(adminActor, {
        boardId: otherBoardId,
        name: "Sdílené jméno",
      });
      assert.equal(r2.success, true);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. Update Area Action / Use Case Flow
  // ───────────────────────────────────────────────────────────
  describe("4. UpdateArea – oprávnění a logika", () => {
    let existingAreaId: string;

    beforeEach(async () => {
      const area = await areaRepo.create({
        boardId: testBoardId,
        name: "Původní název",
        description: "Původní popis",
      });
      existingAreaId = area.id;
    });

    test("OWNER může upravit oblast", async () => {
      const useCase = new UpdateAreaUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        areaId: existingAreaId,
        name: "Změněný název",
        description: "Nový popis",
      });

      assert.equal(res.success, true);
      if (!res.success) return;
      assert.equal(res.data.name, "Změněný název");
      assert.equal(res.data.description, "Nový popis");
    });

    test("MANAGER může upravit oblast", async () => {
      const useCase = new UpdateAreaUseCase(uow);
      const res = await useCase.execute(managerActor, {
        areaId: existingAreaId,
        name: "Manažerská úprava",
      });

      assert.equal(res.success, true);
      if (!res.success) return;
      assert.equal(res.data.name, "Manažerská úprava");
    });

    test("MEMBER NEMŮŽE upravit oblast (AuthorizationError / INSUFFICIENT_ROLE)", async () => {
      const useCase = new UpdateAreaUseCase(uow);
      const res = await useCase.execute(memberActor, {
        areaId: existingAreaId,
        name: "Pokus o změnu",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
      assert.equal(
        (res.error as AuthorizationError).reason,
        "INSUFFICIENT_ROLE",
      );
    });

    test("Úprava na název, který již existuje na témže boardu, skončí ConflictError", async () => {
      await areaRepo.create({
        boardId: testBoardId,
        name: "Konfliktní název",
      });

      const useCase = new UpdateAreaUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        areaId: existingAreaId,
        name: "Konfliktní název",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof ConflictError);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 5. Delete Area Action / Use Case Flow
  // ───────────────────────────────────────────────────────────
  describe("5. DeleteArea – oprávnění, potvrzení a kaskádové smazání", () => {
    let areaToDeleteId: string;

    beforeEach(async () => {
      const area = await areaRepo.create({
        boardId: testBoardId,
        name: "Oblast ke smazání",
      });
      areaToDeleteId = area.id;

      // Vytvoříme úkol v této oblasti
      await taskRepo.create({
        boardId: testBoardId,
        areaId: areaToDeleteId,
        title: "Úkol v mazané oblasti",
        createdBy: ownerActor.actor_user_id,
      });
    });

    test("OWNER může smazat oblast s přesným potvrzením 'SMAZAT'", async () => {
      const useCase = new DeleteAreaUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        areaId: areaToDeleteId,
        confirmation: "SMAZAT",
      });

      assert.equal(res.success, true);

      // Ověření, že oblast byla odstraněna
      const deleted = await areaRepo.findById(areaToDeleteId);
      assert.equal(deleted, null);

      // Ověření kaskádového smazání úkolů
      const remainingTasks = await taskRepo.findByAreaId(areaToDeleteId);
      assert.equal(remainingTasks.length, 0);
    });

    test("MANAGER může smazat oblast s potvrzením 'SMAZAT'", async () => {
      const useCase = new DeleteAreaUseCase(uow);
      const res = await useCase.execute(managerActor, {
        areaId: areaToDeleteId,
        confirmation: "SMAZAT",
      });

      assert.equal(res.success, true);
    });

    test("MEMBER NEMŮŽE smazat oblast ani s 'SMAZAT' (INSUFFICIENT_ROLE)", async () => {
      const useCase = new DeleteAreaUseCase(uow);
      const res = await useCase.execute(memberActor, {
        areaId: areaToDeleteId,
        confirmation: "SMAZAT",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
      assert.equal(
        (res.error as AuthorizationError).reason,
        "INSUFFICIENT_ROLE",
      );

      // Oblast nesmí být smazána
      const area = await areaRepo.findById(areaToDeleteId);
      assert.ok(area !== null);
    });

    test("Chybné potvrzení (ne 'SMAZAT') je odmítnuto chybou ValidationError", async () => {
      const useCase = new DeleteAreaUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        areaId: areaToDeleteId,
        confirmation: "smazat" as any,
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof ValidationError);

      // Oblast zůstává
      const area = await areaRepo.findById(areaToDeleteId);
      assert.ok(area !== null);
    });

    test("Smazání neexistující oblasti vrátí NotFoundError", async () => {
      const useCase = new DeleteAreaUseCase(uow);
      const res = await useCase.execute(ownerActor, {
        areaId: "non-existent-area",
        confirmation: "SMAZAT",
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof NotFoundError);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 6. Autentizace a neaktivní účty
  // ───────────────────────────────────────────────────────────
  describe("6. Autentizační stráže", () => {
    test("Neautentizovaný požadavek (null actor) je zamítnut", async () => {
      const createUseCase = new CreateAreaUseCase(uow);
      const resCreate = await createUseCase.execute(null, {
        boardId: testBoardId,
        name: "Test",
      });
      assert.equal(resCreate.success, false);
      assert.ok(resCreate.error instanceof AuthenticationError);
    });

    test("Neaktivní uživatel (is_active = false) je zamítnut", async () => {
      const createUseCase = new CreateAreaUseCase(uow);
      const res = await createUseCase.execute(inactiveActor, {
        boardId: testBoardId,
        name: "Test",
      });
      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthenticationError);
    });
  });
});
