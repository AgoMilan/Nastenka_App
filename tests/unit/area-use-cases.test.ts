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

  async create(data: any): Promise<MembershipRecord> {
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
    } catch (err) {
      this.areas.restore(areaSnap);
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────

describe("STEP 19 – Area Use Cases", () => {
  let boardsRepo: InMemoryBoardRepository;
  let membershipsRepo: InMemoryMembershipRepository;
  let usersRepo: InMemoryUserRepository;
  let areasRepo: InMemoryAreaRepository;
  let tasksRepo: InMemoryTaskRepository;
  let uow: InMemoryUnitOfWork;

  const boardId = "board-1";
  const otherBoardId = "board-2";

  const ownerUser: UserRecord = {
    id: "user-owner",
    name: "Owner",
    email: "owner@test.cz",
    globalRole: "USER",
    isActive: true,
    deletedAt: null,
  };
  const managerUser: UserRecord = {
    id: "user-manager",
    name: "Manager",
    email: "manager@test.cz",
    globalRole: "USER",
    isActive: true,
    deletedAt: null,
  };
  const memberUser: UserRecord = {
    id: "user-member",
    name: "Member",
    email: "member@test.cz",
    globalRole: "USER",
    isActive: true,
    deletedAt: null,
  };
  const adminUser: UserRecord = {
    id: "user-admin",
    name: "Admin",
    email: "admin@test.cz",
    globalRole: "ADMIN",
    isActive: true,
    deletedAt: null,
  };

  const ownerActor: ActorContext = {
    actor_user_id: ownerUser.id,
    global_role: "USER",
    session_id: "sess-owner",
    is_active: true,
  };
  const managerActor: ActorContext = {
    actor_user_id: managerUser.id,
    global_role: "USER",
    session_id: "sess-manager",
    is_active: true,
  };
  const memberActor: ActorContext = {
    actor_user_id: memberUser.id,
    global_role: "USER",
    session_id: "sess-member",
    is_active: true,
  };
  const adminActor: ActorContext = {
    actor_user_id: adminUser.id,
    global_role: "ADMIN",
    session_id: "sess-admin",
    is_active: true,
  };

  beforeEach(() => {
    boardsRepo = new InMemoryBoardRepository();
    membershipsRepo = new InMemoryMembershipRepository();
    usersRepo = new InMemoryUserRepository();
    areasRepo = new InMemoryAreaRepository();
    tasksRepo = new InMemoryTaskRepository();

    uow = new InMemoryUnitOfWork(
      boardsRepo,
      membershipsRepo,
      usersRepo,
      areasRepo,
      tasksRepo,
    );

    // Vložení uživatelů
    usersRepo.store.set(ownerUser.id, ownerUser);
    usersRepo.store.set(managerUser.id, managerUser);
    usersRepo.store.set(memberUser.id, memberUser);
    usersRepo.store.set(adminUser.id, adminUser);

    // Vložení nástěnky
    boardsRepo.store.set(boardId, {
      id: boardId,
      name: "Hlavní nástěnka",
      description: null,
      createdBy: ownerUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    // Vložení členství
    membershipsRepo.store.set("m-1", {
      id: "m-1",
      boardId,
      userId: ownerUser.id,
      role: "OWNER",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    membershipsRepo.store.set("m-2", {
      id: "m-2",
      boardId,
      userId: managerUser.id,
      role: "MANAGER",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    membershipsRepo.store.set("m-3", {
      id: "m-3",
      boardId,
      userId: memberUser.id,
      role: "MEMBER",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // ── 1. CreateAreaUseCase ────────────────────────────────────
  describe("1. CreateAreaUseCase", () => {
    test("neautentizovaný požadavek (null actor) vrací 401 AuthenticationError", async () => {
      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(null, {
        boardId,
        name: "Prodejna",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthenticationError);
      }
    });

    test("neaktivní uživatel (is_active: false) vrací 401 AuthenticationError", async () => {
      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(
        { ...ownerActor, is_active: false },
        { boardId, name: "Prodejna" },
      );
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthenticationError);
      }
    });

    test("neexistující nástěnka vrací 404 NotFoundError", async () => {
      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(ownerActor, {
        boardId: "neexistuje",
        name: "Prodejna",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });

    test("smazaná nástěnka (soft-delete) vrací 403 AuthorizationError (BOARD_DELETED)", async () => {
      boardsRepo.store.set(boardId, {
        ...boardsRepo.store.get(boardId)!,
        deletedAt: new Date(),
      });
      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(ownerActor, {
        boardId,
        name: "Prodejna",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal(res.error.reason, "BOARD_DELETED");
      }
    });

    test("běžný MEMBER nemá právo vytvořit oblast (INSUFFICIENT_ROLE)", async () => {
      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(memberActor, {
        boardId,
        name: "Prodejna",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("nečlen Nástěnky nemá právo vytvořit oblast (NOT_A_MEMBER)", async () => {
      const nonMemberActor: ActorContext = {
        actor_user_id: "user-cizi",
        global_role: "USER",
        session_id: "sess-cizi",
        is_active: true,
      };
      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(nonMemberActor, {
        boardId,
        name: "Prodejna",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal(res.error.reason, "NOT_A_MEMBER");
      }
    });

    test("OWNER úspěšně vytvoří oblast", async () => {
      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(ownerActor, {
        boardId,
        name: "Prodejna",
        description: "Hlavní prodejní plocha",
      });
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.name, "Prodejna");
        assert.equal(res.data.description, "Hlavní prodejní plocha");
        assert.equal(res.data.boardId, boardId);
      }
    });

    test("MANAGER úspěšně vytvoří oblast", async () => {
      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(managerActor, {
        boardId,
        name: "Sklad",
      });
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.name, "Sklad");
      }
    });

    test("ADMIN úspěšně vytvoří oblast i bez přímého členství", async () => {
      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(adminActor, {
        boardId,
        name: "Dílna",
      });
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.name, "Dílna");
      }
    });

    test("duplicitní název oblasti na stejné Nástěnce vrací 409 ConflictError", async () => {
      areasRepo.store.set("a-1", {
        id: "a-1",
        boardId,
        name: "Prodejna",
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(ownerActor, {
        boardId,
        name: "Prodejna",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ConflictError);
      }
    });

    test("prázdný název oblasti vrací 400 ValidationError", async () => {
      const uc = new CreateAreaUseCase(uow);
      const res = await uc.execute(ownerActor, {
        boardId,
        name: "   ",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });
  });

  // ── 2. UpdateAreaUseCase ────────────────────────────────────
  describe("2. UpdateAreaUseCase", () => {
    let areaId: string;

    beforeEach(async () => {
      const a = await areasRepo.create({
        boardId,
        name: "Původní název",
        description: "Původní popis",
      });
      areaId = a.id;
    });

    test("neautentizovaný požadavek vrací 401", async () => {
      const uc = new UpdateAreaUseCase(uow);
      const res = await uc.execute(null, {
        areaId,
        name: "Nový název",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthenticationError);
      }
    });

    test("neexistující oblast vrací 404 NotFoundError", async () => {
      const uc = new UpdateAreaUseCase(uow);
      const res = await uc.execute(ownerActor, {
        areaId: "neexistuje",
        name: "Nový název",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });

    test("běžný MEMBER nemá právo upravit oblast (INSUFFICIENT_ROLE)", async () => {
      const uc = new UpdateAreaUseCase(uow);
      const res = await uc.execute(memberActor, {
        areaId,
        name: "Nový název",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("OWNER úspěšně upraví název i popis", async () => {
      const uc = new UpdateAreaUseCase(uow);
      const res = await uc.execute(ownerActor, {
        areaId,
        name: "Upravený název",
        description: "Upravený popis",
      });
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.name, "Upravený název");
        assert.equal(res.data.description, "Upravený popis");
      }
    });

    test("změna názvu na existující název na stejné Nástěnce vrací 409 ConflictError", async () => {
      await areasRepo.create({
        boardId,
        name: "Jiná existující oblast",
      });

      const uc = new UpdateAreaUseCase(uow);
      const res = await uc.execute(managerActor, {
        areaId,
        name: "Jiná existující oblast",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ConflictError);
      }
    });
  });

  // ── 3. DeleteAreaUseCase ────────────────────────────────────
  describe("3. DeleteAreaUseCase", () => {
    let areaId: string;

    beforeEach(async () => {
      const a = await areasRepo.create({
        boardId,
        name: "Oblast ke smazání",
      });
      areaId = a.id;

      // Vložení úkolu do této oblasti pro ověření kaskády
      await tasksRepo.create({
        boardId,
        areaId: a.id,
        title: "Úkol v oblasti",
        createdBy: ownerUser.id,
      });
    });

    test("neautentizovaný požadavek vrací 401", async () => {
      const uc = new DeleteAreaUseCase(uow);
      const res = await uc.execute(null, {
        areaId,
        confirmation: "SMAZAT",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthenticationError);
      }
    });

    test("chybné potvrzení (než přesné 'SMAZAT') vrací 400 ValidationError", async () => {
      const uc = new DeleteAreaUseCase(uow);
      const res = await uc.execute(ownerActor, {
        areaId,
        confirmation: "smazat", // malá písmena
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });

    test("běžný MEMBER nemá právo smazat oblast (INSUFFICIENT_ROLE)", async () => {
      const uc = new DeleteAreaUseCase(uow);
      const res = await uc.execute(memberActor, {
        areaId,
        confirmation: "SMAZAT",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal(res.error.reason, "INSUFFICIENT_ROLE");
      }
    });

    test("OWNER úspěšně smaže oblast a kaskádově odstraní její úkoly", async () => {
      const uc = new DeleteAreaUseCase(uow);
      const res = await uc.execute(ownerActor, {
        areaId,
        confirmation: "SMAZAT",
      });
      assert.equal(res.success, true);

      // Ověření smazání oblasti
      const deletedArea = await areasRepo.findById(areaId);
      assert.equal(deletedArea, null);

      // Ověření kaskády na úkoly v této oblasti
      const remainingTasks = await tasksRepo.findByAreaId(areaId);
      assert.equal(remainingTasks.length, 0);
    });

    test("MANAGER úspěšně smaže oblast s přesným potvrzením 'SMAZAT'", async () => {
      const uc = new DeleteAreaUseCase(uow);
      const res = await uc.execute(managerActor, {
        areaId,
        confirmation: "SMAZAT",
      });
      assert.equal(res.success, true);
    });
  });
});
