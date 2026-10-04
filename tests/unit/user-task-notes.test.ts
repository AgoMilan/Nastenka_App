import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type {
  BoardRecord,
  BoardRepository,
  UserBoardRecord,
  MembershipRecord,
  MembershipRepository,
  UnitOfWork,
  UnitOfWorkRepositories,
  UserRecord,
  UserRepository,
} from "../../modules/boards/application/ports/index.ts";
import type {
  TaskPriority,
  TaskRecord,
  TaskRepository,
  TaskStatus,
  UserTaskNoteRecord,
  UserTaskNoteRepository,
  UpsertUserTaskNoteData,
} from "../../modules/tasks/application/ports/index.ts";
import {
  GetUserTaskNoteUseCase,
  UpsertUserTaskNoteUseCase,
  DeleteUserTaskNoteUseCase,
} from "../../modules/tasks/application/use-cases/index.ts";
import {
  getUserTaskNoteSchema,
  upsertUserTaskNoteSchema,
  deleteUserTaskNoteSchema,
} from "../../modules/tasks/api/dto/user-task-note.dto.ts";
import { checkTaskPermission } from "../../modules/tasks/application/policies/task-policy.ts";
import type {
  ActorTaskRelationship,
  TaskAuthorizationTarget,
} from "../../modules/tasks/application/policies/task-authorization.ts";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// In-Memory testovací repozitáře
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

  async findByCreatedBy(): Promise<BoardRecord[]> {
    return [];
  }

  async create(): Promise<BoardRecord> {
    throw new Error("Not implemented");
  }

  async update(): Promise<BoardRecord> {
    throw new Error("Not implemented");
  }

  async softDelete(): Promise<void> {}

  async findAll(): Promise<BoardRecord[]> {
    return Array.from(this.store.values());
  }

  async findActiveBoardsForUser(userId: string): Promise<UserBoardRecord[]> {
    return Array.from(this.store.values())
      .filter((b) => b.deletedAt === null)
      .map((b) => ({ ...b, role: "MEMBER" as const }));
  }

  async findActiveBoardsForAdmin(adminUserId: string): Promise<UserBoardRecord[]> {
    return Array.from(this.store.values())
      .filter((b) => b.deletedAt === null)
      .map((b) => ({ ...b, role: null }));
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

  async findMembershipsByBoard(boardId: string): Promise<MembershipRecord[]> {
    return Array.from(this.store.values()).filter((m) => m.boardId === boardId);
  }

  async create(data: {
    boardId: string;
    userId: string;
    role: "OWNER" | "MANAGER" | "MEMBER";
  }): Promise<MembershipRecord> {
    const id = `mem-${crypto.randomUUID()}`;
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

  async updateRole(
    boardId: string,
    userId: string,
    newRole: "OWNER" | "MANAGER" | "MEMBER",
  ): Promise<void> {
    const r = await this.findByBoardAndUser(boardId, userId);
    if (r) {
      this.store.set(this.key(boardId, userId), { ...r, role: newRole });
    }
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

  async findUserTasksAcrossBoards(
    userId: string,
    boardIds: string[],
  ): Promise<TaskRecord[]> {
    return Array.from(this.store.values()).filter(
      (t) => boardIds.includes(t.boardId) && (t.assigneeId === userId || t.createdBy === userId),
    );
  }

  async create(): Promise<TaskRecord> {
    throw new Error("Not implemented");
  }

  async update(id: string, data: Partial<TaskRecord>): Promise<TaskRecord> {
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

class InMemoryUserTaskNoteRepository implements UserTaskNoteRepository {
  public store = new Map<string, UserTaskNoteRecord>();

  private key(userId: string, taskId: string): string {
    return `${userId}:${taskId}`;
  }

  async findById(id: string): Promise<UserTaskNoteRecord | null> {
    const found = Array.from(this.store.values()).find((n) => n.id === id);
    return found ? { ...found } : null;
  }

  async findByUserAndTask(
    userId: string,
    taskId: string,
  ): Promise<UserTaskNoteRecord | null> {
    const found = this.store.get(this.key(userId, taskId));
    return found ? { ...found } : null;
  }

  async findByUserAndTaskIds(
    userId: string,
    taskIds: string[],
  ): Promise<Map<string, UserTaskNoteRecord>> {
    const map = new Map<string, UserTaskNoteRecord>();
    for (const taskId of taskIds) {
      const note = this.store.get(this.key(userId, taskId));
      if (note) {
        map.set(taskId, { ...note });
      }
    }
    return map;
  }

  async upsert(data: UpsertUserTaskNoteData): Promise<UserTaskNoteRecord> {
    const k = this.key(data.userId, data.taskId);
    const existing = this.store.get(k);
    const now = new Date();

    if (existing) {
      const updated: UserTaskNoteRecord = {
        ...existing,
        content: data.content,
        updatedAt: now,
      };
      this.store.set(k, updated);
      return { ...updated };
    }

    const newRecord: UserTaskNoteRecord = {
      id: `note-${crypto.randomUUID()}`,
      userId: data.userId,
      taskId: data.taskId,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(k, newRecord);
    return { ...newRecord };
  }

  async delete(userId: string, taskId: string): Promise<void> {
    this.store.delete(this.key(userId, taskId));
  }

  async deleteAllForTask(taskId: string): Promise<void> {
    for (const [k, note] of this.store.entries()) {
      if (note.taskId === taskId) {
        this.store.delete(k);
      }
    }
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [k, note] of this.store.entries()) {
      if (note.userId === userId) {
        this.store.delete(k);
      }
    }
  }
}

class InMemoryUnitOfWork implements UnitOfWork {
  private readonly repos: {
    boards: BoardRepository;
    memberships: MembershipRepository;
    users: UserRepository;
    tasks: TaskRepository;
    userTaskNotes: UserTaskNoteRepository;
  };

  constructor(repos: {
    boards: BoardRepository;
    memberships: MembershipRepository;
    users: UserRepository;
    tasks: TaskRepository;
    userTaskNotes: UserTaskNoteRepository;
  }) {
    this.repos = repos;
  }

  async runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return await work(this.repos);
  }
}

// ─────────────────────────────────────────────────────────────
// Testovací sada
// ─────────────────────────────────────────────────────────────

describe("Soukromé poznámky k úkolu (User Task Notes)", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let taskRepo: InMemoryTaskRepository;
  let noteRepo: InMemoryUserTaskNoteRepository;
  let uow: InMemoryUnitOfWork;

  const userAliceId = "user-alice-111";
  const userBobId = "user-bob-222";
  const userAdminId = "user-admin-999";
  const boardId = "board-test-123";
  const taskId = "task-test-456";

  const aliceActor: ActorContext = {
    actor_user_id: userAliceId,
    global_role: "USER",
    session_id: "sess-alice",
    is_active: true,
  };

  const bobActor: ActorContext = {
    actor_user_id: userBobId,
    global_role: "USER",
    session_id: "sess-bob",
    is_active: true,
  };

  const adminActor: ActorContext = {
    actor_user_id: userAdminId,
    global_role: "ADMIN",
    session_id: "sess-admin",
    is_active: true,
  };

  beforeEach(() => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    taskRepo = new InMemoryTaskRepository();
    noteRepo = new InMemoryUserTaskNoteRepository();
    uow = new InMemoryUnitOfWork({
      boards: boardRepo,
      memberships: membershipRepo,
      users: userRepo,
      tasks: taskRepo,
      userTaskNotes: noteRepo,
    });

    // Výchozí deska
    boardRepo.store.set(boardId, {
      id: boardId,
      name: "Projekt Nástěnka",
      description: "Testovací nástěnka",
      createdBy: userAliceId,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Uživatelé
    userRepo.store.set(userAliceId, {
      id: userAliceId,
      name: "Alice",
      email: "alice@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set(userBobId, {
      id: userBobId,
      name: "Bob",
      email: "bob@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set(userAdminId, {
      id: userAdminId,
      name: "Admin",
      email: "admin@test.cz",
      globalRole: "ADMIN",
      isActive: true,
      deletedAt: null,
    });

    // Členství
    membershipRepo.create({ boardId, userId: userAliceId, role: "OWNER" });
    membershipRepo.create({ boardId, userId: userBobId, role: "MEMBER" });

    // Úkol
    taskRepo.store.set(taskId, {
      id: taskId,
      boardId,
      areaId: null,
      title: "Implementovat soukromé poznámky",
      description: "Popis úkolu",
      status: "ROZPRACOVANÉ",
      priority: "SPĚCHÁ",
      dueDate: new Date("2026-10-15"),
      createdBy: userAliceId,
      assigneeId: userAliceId,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // ───────────────────────────────────────────────────────────
  // 1. Zod DTO Schémata
  // ───────────────────────────────────────────────────────────
  describe("1. DTO validace", () => {
    test("upsertUserTaskNoteSchema přijímá validní data", () => {
      const parsed = upsertUserTaskNoteSchema.safeParse({
        boardId,
        taskId,
        content: "Můj soukromý koncept",
      });
      assert.strictEqual(parsed.success, true);
    });

    test("upsertUserTaskNoteSchema odmítá prázdný nebo pouze mezerový obsah", () => {
      const empty = upsertUserTaskNoteSchema.safeParse({
        boardId,
        taskId,
        content: "",
      });
      assert.strictEqual(empty.success, false);

      const spaces = upsertUserTaskNoteSchema.safeParse({
        boardId,
        taskId,
        content: "   ",
      });
      assert.strictEqual(spaces.success, false);
    });

    test("upsertUserTaskNoteSchema odmítá obsah delší než 5000 znaků", () => {
      const tooLong = upsertUserTaskNoteSchema.safeParse({
        boardId,
        taskId,
        content: "x".repeat(5001),
      });
      assert.strictEqual(tooLong.success, false);
    });

    test("deleteUserTaskNoteSchema a getUserTaskNoteSchema vyžadují boardId a taskId", () => {
      assert.strictEqual(
        getUserTaskNoteSchema.safeParse({ boardId: "", taskId }).success,
        false,
      );
      assert.strictEqual(
        deleteUserTaskNoteSchema.safeParse({ boardId, taskId: "" }).success,
        false,
      );
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. TaskPolicy Autorizační Invarianty
  // ───────────────────────────────────────────────────────────
  describe("2. TaskPolicy autorizační pravidla", () => {
    const baseTarget: TaskAuthorizationTarget = {
      boardId,
      taskId,
      createdBy: userAliceId,
      assigneeId: userAliceId,
      status: "ROZPRACOVANÉ",
      isBoardDeleted: false,
    };
    const baseRel: ActorTaskRelationship = {
      isAssignee: true,
      isParticipant: false,
    };

    test("vlastník poznámky má přístup (VIEW, UPSERT, DELETE) k vlastní poznámce", () => {
      const targetWithAlice = { ...baseTarget, noteOwnerUserId: userAliceId };
      const view = checkTaskPermission(
        aliceActor,
        boardId,
        { role: "OWNER" },
        targetWithAlice,
        baseRel,
        "TASK_PRIVATE_NOTE_VIEW_OWN",
      );
      const upsert = checkTaskPermission(
        aliceActor,
        boardId,
        { role: "OWNER" },
        targetWithAlice,
        baseRel,
        "TASK_PRIVATE_NOTE_UPSERT_OWN",
      );
      const del = checkTaskPermission(
        aliceActor,
        boardId,
        { role: "OWNER" },
        targetWithAlice,
        baseRel,
        "TASK_PRIVATE_NOTE_DELETE_OWN",
      );

      assert.strictEqual(view.allowed, true);
      assert.strictEqual(upsert.allowed, true);
      assert.strictEqual(del.allowed, true);
    });

    test("druhý uživatel (Bob) NESMÍ číst, měnit ani mazat cizí poznámku (Alici)", () => {
      const targetWithAlice = { ...baseTarget, noteOwnerUserId: userAliceId };
      const bobRel: ActorTaskRelationship = {
        isAssignee: false,
        isParticipant: false,
      };

      const view = checkTaskPermission(
        bobActor,
        boardId,
        { role: "MEMBER" },
        targetWithAlice,
        bobRel,
        "TASK_PRIVATE_NOTE_VIEW_OWN",
      );
      const upsert = checkTaskPermission(
        bobActor,
        boardId,
        { role: "MEMBER" },
        targetWithAlice,
        bobRel,
        "TASK_PRIVATE_NOTE_UPSERT_OWN",
      );
      const del = checkTaskPermission(
        bobActor,
        boardId,
        { role: "MEMBER" },
        targetWithAlice,
        bobRel,
        "TASK_PRIVATE_NOTE_DELETE_OWN",
      );

      assert.strictEqual(view.allowed, false);
      assert.strictEqual(view.reason, "NOT_NOTE_OWNER");
      assert.strictEqual(upsert.allowed, false);
      assert.strictEqual(upsert.reason, "NOT_NOTE_OWNER");
      assert.strictEqual(del.allowed, false);
      assert.strictEqual(del.reason, "NOT_NOTE_OWNER");
    });

    test("ADMIN NESMÍ číst, měnit ani mazat cizí poznámku (žádný blanket permission)", () => {
      const targetWithAlice = { ...baseTarget, noteOwnerUserId: userAliceId };

      const view = checkTaskPermission(
        adminActor,
        boardId,
        null,
        targetWithAlice,
        baseRel,
        "TASK_PRIVATE_NOTE_VIEW_OWN",
      );
      const upsert = checkTaskPermission(
        adminActor,
        boardId,
        null,
        targetWithAlice,
        baseRel,
        "TASK_PRIVATE_NOTE_UPSERT_OWN",
      );
      const del = checkTaskPermission(
        adminActor,
        boardId,
        null,
        targetWithAlice,
        baseRel,
        "TASK_PRIVATE_NOTE_DELETE_OWN",
      );

      assert.strictEqual(view.allowed, false);
      assert.strictEqual(view.reason, "NOT_NOTE_OWNER");
      assert.strictEqual(upsert.allowed, false);
      assert.strictEqual(upsert.reason, "NOT_NOTE_OWNER");
      assert.strictEqual(del.allowed, false);
      assert.strictEqual(del.reason, "NOT_NOTE_OWNER");
    });

    test("archivovaný úkol (ARCHIVOVÁNO): VIEW je ALLOW, ale zápis i smazání končí TASK_ARCHIVED", () => {
      const archivedTarget: TaskAuthorizationTarget = {
        ...baseTarget,
        status: "ARCHIVOVÁNO",
        noteOwnerUserId: userAliceId,
      };

      const view = checkTaskPermission(
        aliceActor,
        boardId,
        { role: "OWNER" },
        archivedTarget,
        baseRel,
        "TASK_PRIVATE_NOTE_VIEW_OWN",
      );
      const upsert = checkTaskPermission(
        aliceActor,
        boardId,
        { role: "OWNER" },
        archivedTarget,
        baseRel,
        "TASK_PRIVATE_NOTE_UPSERT_OWN",
      );
      const del = checkTaskPermission(
        aliceActor,
        boardId,
        { role: "OWNER" },
        archivedTarget,
        baseRel,
        "TASK_PRIVATE_NOTE_DELETE_OWN",
      );

      assert.strictEqual(view.allowed, true);
      assert.strictEqual(upsert.allowed, false);
      assert.strictEqual(upsert.reason, "TASK_ARCHIVED");
      assert.strictEqual(del.allowed, false);
      assert.strictEqual(del.reason, "TASK_ARCHIVED");
    });

    test("dokončený úkol (HOTOVO) dovoluje čtení, úpravu i smazání poznámky", () => {
      const completedTarget: TaskAuthorizationTarget = {
        ...baseTarget,
        status: "HOTOVO",
        noteOwnerUserId: userAliceId,
      };

      const view = checkTaskPermission(
        aliceActor,
        boardId,
        { role: "OWNER" },
        completedTarget,
        baseRel,
        "TASK_PRIVATE_NOTE_VIEW_OWN",
      );
      const upsert = checkTaskPermission(
        aliceActor,
        boardId,
        { role: "OWNER" },
        completedTarget,
        baseRel,
        "TASK_PRIVATE_NOTE_UPSERT_OWN",
      );
      const del = checkTaskPermission(
        aliceActor,
        boardId,
        { role: "OWNER" },
        completedTarget,
        baseRel,
        "TASK_PRIVATE_NOTE_DELETE_OWN",
      );

      assert.strictEqual(view.allowed, true);
      assert.strictEqual(upsert.allowed, true);
      assert.strictEqual(del.allowed, true);
    });

    test("uživatel bez členství (který odešel z nástěnky) dostane NOT_A_MEMBER", () => {
      const nonMemberActor: ActorContext = {
        actor_user_id: "user-stranger-555",
        global_role: "USER",
        session_id: "sess-stranger",
        is_active: true,
      };

      const view = checkTaskPermission(
        nonMemberActor,
        boardId,
        null, // Žádné členství
        { ...baseTarget, noteOwnerUserId: "user-stranger-555" },
        baseRel,
        "TASK_PRIVATE_NOTE_VIEW_OWN",
      );

      assert.strictEqual(view.allowed, false);
      assert.strictEqual(view.reason, "NOT_A_MEMBER");
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. Use Cases (CRUD, autoritativní serverová identita, lifecycle)
  // ───────────────────────────────────────────────────────────
  describe("3. Use Cases", () => {
    test("uživatel vytvoří svou poznámku přes UpsertUserTaskNoteUseCase (1)", async () => {
      const useCase = new UpsertUserTaskNoteUseCase(uow);
      const res = await useCase.execute(aliceActor, {
        boardId,
        taskId,
        content: "Moje první soukromá poznámka",
      });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.userId, userAliceId);
        assert.strictEqual(res.data.taskId, taskId);
        assert.strictEqual(res.data.content, "Moje první soukromá poznámka");
      }
    });

    test("uživatel načte svou poznámku přes GetUserTaskNoteUseCase (2)", async () => {
      // Vytvoříme poznámku
      await noteRepo.upsert({
        userId: userAliceId,
        taskId,
        content: "Uložený text",
      });

      const useCase = new GetUserTaskNoteUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        noteRepo,
      );
      const res = await useCase.execute(aliceActor, { boardId, taskId });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.notStrictEqual(res.data, null);
        assert.strictEqual(res.data?.content, "Uložený text");
        assert.strictEqual(res.data?.userId, userAliceId);
      }
    });

    test("uživatel upraví svou existující poznámku (3) a UNIQUE constraint aktualizuje tentýž záznam (15)", async () => {
      const upsertUseCase = new UpsertUserTaskNoteUseCase(uow);
      // 1. Vytvoření
      const res1 = await upsertUseCase.execute(aliceActor, {
        boardId,
        taskId,
        content: "Původní znění",
      });
      assert.strictEqual(res1.success, true);

      // 2. Úprava
      const res2 = await upsertUseCase.execute(aliceActor, {
        boardId,
        taskId,
        content: "Aktualizované znění",
      });
      assert.strictEqual(res2.success, true);
      if (res2.success) {
        assert.strictEqual(res2.data.content, "Aktualizované znění");
      }

      // Ověření, že v repozitáři je přesně 1 záznam pro danou dvojici (user, task)
      assert.strictEqual(noteRepo.store.size, 1);
    });

    test("uživatel smaže svou poznámku přes DeleteUserTaskNoteUseCase (4)", async () => {
      await noteRepo.upsert({
        userId: userAliceId,
        taskId,
        content: "Poznámka ke smazání",
      });

      const deleteUseCase = new DeleteUserTaskNoteUseCase(uow);
      const res = await deleteUseCase.execute(aliceActor, { boardId, taskId });

      assert.strictEqual(res.success, true);

      // Kontrola, že je smazána
      const checkNote = await noteRepo.findByUserAndTask(userAliceId, taskId);
      assert.strictEqual(checkNote, null);
    });

    test("druhý uživatel (Bob) nemůže načíst cizí poznámku (5)", async () => {
      // Alice má poznámku
      await noteRepo.upsert({
        userId: userAliceId,
        taskId,
        content: "Alice tajná poznámka",
      });

      const getUseCase = new GetUserTaskNoteUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        noteRepo,
      );
      // Bob se dotáže na týž úkol – GetUserTaskNoteUseCase načítá výhradně pro Boba
      const res = await getUseCase.execute(bobActor, { boardId, taskId });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data, null); // Bob nemá žádnou poznámku
      }
    });

    test("druhý uživatel (Bob) nemůže přepsat cizí poznámku (6)", async () => {
      await noteRepo.upsert({
        userId: userAliceId,
        taskId,
        content: "Původní poznámka Alice",
      });

      const upsertUseCase = new UpsertUserTaskNoteUseCase(uow);
      // Bob provede upsert – uloží se PRO BOBA, nikoli pro Alici
      const res = await upsertUseCase.execute(bobActor, {
        boardId,
        taskId,
        content: "Bobova poznámka",
      });
      assert.strictEqual(res.success, true);

      // Poznámka Alice zůstává nedotčena!
      const aliceNote = await noteRepo.findByUserAndTask(userAliceId, taskId);
      assert.strictEqual(aliceNote?.content, "Původní poznámka Alice");
    });

    test("druhý uživatel (Bob) nemůže smazat cizí poznámku (7)", async () => {
      await noteRepo.upsert({
        userId: userAliceId,
        taskId,
        content: "Poznámka Alice",
      });

      const deleteUseCase = new DeleteUserTaskNoteUseCase(uow);
      // Bob volá delete – maže se pro Boba (kde žádná není), Alice zůstává
      const res = await deleteUseCase.execute(bobActor, { boardId, taskId });
      assert.strictEqual(res.success, true);

      const aliceNote = await noteRepo.findByUserAndTask(userAliceId, taskId);
      assert.notStrictEqual(aliceNote, null);
      assert.strictEqual(aliceNote?.content, "Poznámka Alice");
    });

    test("ADMIN nemůže číst ani měnit cizí soukromou poznámku (8, 9)", async () => {
      await noteRepo.upsert({
        userId: userAliceId,
        taskId,
        content: "Pouze pro oči Alice",
      });

      const getUseCase = new GetUserTaskNoteUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        noteRepo,
      );
      const res = await getUseCase.execute(adminActor, { boardId, taskId });

      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data, null); // Admin vidí pouze svou poznámku, ne Alice
      }

      const upsertUseCase = new UpsertUserTaskNoteUseCase(uow);
      await upsertUseCase.execute(adminActor, {
        boardId,
        taskId,
        content: "Adminova vlastní poznámka",
      });

      // Alice poznámka zůstala nedotčena
      const aliceNote = await noteRepo.findByUserAndTask(userAliceId, taskId);
      assert.strictEqual(aliceNote?.content, "Pouze pro oči Alice");
    });

    test("neautorizovaný uživatel nemůže poznámku načíst pouze pomocí známého taskId (10)", async () => {
      // Uživatel byl odebrán z boardu
      membershipRepo.store.delete(`${boardId}:${userBobId}`);

      const getUseCase = new GetUserTaskNoteUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        noteRepo,
      );
      const res = await getUseCase.execute(bobActor, { boardId, taskId });

      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
      }
    });

    test("server nepřebírá userId z klienta (11)", async () => {
      // Ani GetUserTaskNoteInput ani UpsertUserTaskNoteInput neobsahuje userId
      const upsertUseCase = new UpsertUserTaskNoteUseCase(uow);
      const res = await upsertUseCase.execute(aliceActor, {
        boardId,
        taskId,
        content: "Serverová identita z ActorContext",
      });
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.userId, aliceActor.actor_user_id);
      }
    });

    test("archivovaný úkol nepovolí zápis (12), ale povolí čtení vlastní existující poznámky", async () => {
      // Předem existující poznámka
      await noteRepo.upsert({
        userId: userAliceId,
        taskId,
        content: "Historická poznámka před archivací",
      });

      // Nastavíme úkol jako ARCHIVOVÁNO
      await taskRepo.update(taskId, { status: "ARCHIVOVÁNO" });

      // Pokus o zápis selže
      const upsertUseCase = new UpsertUserTaskNoteUseCase(uow);
      const upsertRes = await upsertUseCase.execute(aliceActor, {
        boardId,
        taskId,
        content: "Pokus o změnu po archivaci",
      });
      assert.strictEqual(upsertRes.success, false);
      if (!upsertRes.success) {
        assert.ok(upsertRes.error instanceof AuthorizationError);
      }

      // Pokus o smazání selže
      const deleteUseCase = new DeleteUserTaskNoteUseCase(uow);
      const delRes = await deleteUseCase.execute(aliceActor, { boardId, taskId });
      assert.strictEqual(delRes.success, false);
      if (!delRes.success) {
        assert.ok(delRes.error instanceof AuthorizationError);
      }

      // Čtení existující poznámky uspěje
      const getUseCase = new GetUserTaskNoteUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        noteRepo,
      );
      const getRes = await getUseCase.execute(aliceActor, { boardId, taskId });
      assert.strictEqual(getRes.success, true);
      if (getRes.success) {
        assert.strictEqual(getRes.data?.content, "Historická poznámka před archivací");
        assert.strictEqual(getRes.data?.isArchived, true);
      }
    });

    test("úkol ve stavu HOTOVO dovoluje zápis i čtení (13)", async () => {
      await taskRepo.update(taskId, { status: "HOTOVO" });

      const upsertUseCase = new UpsertUserTaskNoteUseCase(uow);
      const res = await upsertUseCase.execute(aliceActor, {
        boardId,
        taskId,
        content: "Poznámka po dokončení úkolu",
      });
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.data.content, "Poznámka po dokončení úkolu");
      }
    });

    test("smazání úkolu odstraní soukromé poznámky (kaskáda) (14)", async () => {
      await noteRepo.upsert({
        userId: userAliceId,
        taskId,
        content: "Poznámka Alice",
      });
      await noteRepo.upsert({
        userId: userBobId,
        taskId,
        content: "Poznámka Boba",
      });

      assert.strictEqual(noteRepo.store.size, 2);

      // Kaskádové smazání všech poznámek pro úkol
      await noteRepo.deleteAllForTask(taskId);

      assert.strictEqual(noteRepo.store.size, 0);
    });
  });
});
