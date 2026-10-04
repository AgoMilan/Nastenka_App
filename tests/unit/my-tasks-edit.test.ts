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
  AreaRecord,
  AreaRepository,
} from "../../modules/areas/application/ports/area-repository.port.ts";
import type {
  CreateTaskCommentData,
  TaskCommentRecord,
  TaskCommentRepository,
  TaskParticipantRecord,
  TaskParticipantRepository,
  TaskRecord,
  TaskRepository,
  UserTaskNoteRecord,
  UserTaskNoteRepository,
  UpsertUserTaskNoteData,
} from "../../modules/tasks/application/ports/index.ts";
import {
  GetMyTasksUseCase,
  UpdateTaskUseCase,
  ChangeTaskAssigneeUseCase,
  ChangeTaskAreaUseCase,
  ChangeTaskDueDateUseCase,
  ChangeTaskPriorityUseCase,
  AddTaskCommentUseCase,
  GetTaskCommentsUseCase,
  UpsertUserTaskNoteUseCase,
  GetUserTaskNoteUseCase,
} from "../../modules/tasks/application/use-cases/index.ts";
import { checkTaskPermission } from "../../modules/tasks/application/policies/task-policy.ts";
import type {
  ActorTaskRelationship,
  TaskAuthorizationTarget,
} from "../../modules/tasks/application/policies/task-authorization.ts";
import { AuthorizationError } from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// Testovací In-Memory Repozitáře
// ─────────────────────────────────────────────────────────────

class InMemoryBoardRepository implements BoardRepository {
  public store = new Map<string, BoardRecord>();

  async findById(id: string): Promise<BoardRecord | null> {
    const b = this.store.get(id);
    return b ? { ...b } : null;
  }
  async findByIdForUpdate(id: string): Promise<BoardRecord | null> {
    return this.findById(id);
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
    const m = this.store.get(this.key(boardId, userId));
    return m ? { ...m } : null;
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

class InMemoryAreaRepository implements AreaRepository {
  public store = new Map<string, AreaRecord>();

  async findById(id: string): Promise<AreaRecord | null> {
    const a = this.store.get(id);
    return a ? { ...a } : null;
  }

  async findByBoardId(boardId: string): Promise<AreaRecord[]> {
    return Array.from(this.store.values()).filter((a) => a.boardId === boardId);
  }

  async findByNameAndBoard(name: string, boardId: string): Promise<AreaRecord | null> {
    return this.findByBoardAndName(boardId, name);
  }

  async findByBoardAndName(boardId: string, name: string): Promise<AreaRecord | null> {
    return (
      Array.from(this.store.values()).find(
        (a) => a.name === name && a.boardId === boardId,
      ) ?? null
    );
  }

  async create(): Promise<AreaRecord> {
    throw new Error("Not implemented");
  }

  async update(): Promise<AreaRecord> {
    throw new Error("Not implemented");
  }

  async delete(): Promise<void> {}
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
      (t) =>
        boardIds.includes(t.boardId) &&
        (t.assigneeId === userId || t.createdBy === userId),
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

class InMemoryTaskParticipantRepository implements TaskParticipantRepository {
  public store = new Map<string, TaskParticipantRecord>();

  private key(taskId: string, userId: string): string {
    return `${taskId}:${userId}`;
  }

  async findByTaskId(taskId: string): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values()).filter((p) => p.taskId === taskId);
  }

  async findByTaskIds(taskIds: string[]): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values()).filter((p) =>
      taskIds.includes(p.taskId),
    );
  }

  async findByTaskAndUser(
    taskId: string,
    userId: string,
  ): Promise<TaskParticipantRecord | null> {
    const r = this.store.get(this.key(taskId, userId));
    return r ? { ...r } : null;
  }

  async findByUserId(userId: string): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values()).filter((p) => p.userId === userId);
  }

  async addParticipant(
    taskId: string,
    userId: string,
    role: string = "CONTRIBUTOR",
  ): Promise<TaskParticipantRecord> {
    const id = `part-${crypto.randomUUID()}`;
    const rec = { id, taskId, userId, role, createdAt: new Date() };
    this.store.set(this.key(taskId, userId), rec);
    return rec;
  }

  async removeParticipant(taskId: string, userId: string): Promise<void> {
    this.store.delete(this.key(taskId, userId));
  }

  async removeAllForTask(taskId: string): Promise<void> {
    for (const [k, v] of this.store.entries()) {
      if (v.taskId === taskId) this.store.delete(k);
    }
  }

  async create(data: { taskId: string; userId: string; role: string }): Promise<TaskParticipantRecord> {
    return this.addParticipant(data.taskId, data.userId, data.role);
  }

  async delete(taskId: string, userId: string): Promise<void> {
    return this.removeParticipant(taskId, userId);
  }

  async deleteAllForTask(taskId: string): Promise<void> {
    return this.removeAllForTask(taskId);
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [k, v] of this.store.entries()) {
      if (v.userId === userId) this.store.delete(k);
    }
  }
}

class InMemoryTaskCommentRepository implements TaskCommentRepository {
  public store = new Map<string, TaskCommentRecord>();

  async findById(id: string): Promise<TaskCommentRecord | null> {
    return this.store.get(id) ?? null;
  }

  async findByTaskId(taskId: string): Promise<TaskCommentRecord[]> {
    return Array.from(this.store.values()).filter((c) => c.taskId === taskId);
  }

  async countByTaskId(taskId: string): Promise<number> {
    return (await this.findByTaskId(taskId)).length;
  }

  async countByTaskIds(taskIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const taskId of taskIds) {
      map.set(taskId, (await this.findByTaskId(taskId)).length);
    }
    return map;
  }

  async create(data: CreateTaskCommentData): Promise<TaskCommentRecord> {
    const id = `comm-${crypto.randomUUID()}`;
    const rec: TaskCommentRecord = {
      id,
      taskId: data.taskId,
      authorId: data.authorId,
      content: data.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(id, rec);
    return rec;
  }

  async update(id: string, data: { content: string }): Promise<TaskCommentRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Comment not found");
    const updated = { ...existing, content: data.content, updatedAt: new Date() };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async deleteAllForTask(taskId: string): Promise<void> {
    for (const [k, c] of this.store.entries()) {
      if (c.taskId === taskId) this.store.delete(k);
    }
  }
}

class InMemoryUserTaskNoteRepository implements UserTaskNoteRepository {
  public store = new Map<string, UserTaskNoteRecord>();

  private key(userId: string, taskId: string): string {
    return `${userId}:${taskId}`;
  }

  async findById(id: string): Promise<UserTaskNoteRecord | null> {
    return Array.from(this.store.values()).find((n) => n.id === id) ?? null;
  }

  async findByUserAndTask(userId: string, taskId: string): Promise<UserTaskNoteRecord | null> {
    return this.store.get(this.key(userId, taskId)) ?? null;
  }

  async findByUserAndTaskIds(
    userId: string,
    taskIds: string[],
  ): Promise<Map<string, UserTaskNoteRecord>> {
    const map = new Map<string, UserTaskNoteRecord>();
    for (const tId of taskIds) {
      const n = this.store.get(this.key(userId, tId));
      if (n) map.set(tId, { ...n });
    }
    return map;
  }

  async upsert(data: UpsertUserTaskNoteData): Promise<UserTaskNoteRecord> {
    const k = this.key(data.userId, data.taskId);
    const existing = this.store.get(k);
    const now = new Date();
    if (existing) {
      const u = { ...existing, content: data.content, updatedAt: now };
      this.store.set(k, u);
      return { ...u };
    }
    const n: UserTaskNoteRecord = {
      id: `note-${crypto.randomUUID()}`,
      userId: data.userId,
      taskId: data.taskId,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(k, n);
    return { ...n };
  }

  async delete(userId: string, taskId: string): Promise<void> {
    this.store.delete(this.key(userId, taskId));
  }

  async deleteAllForTask(taskId: string): Promise<void> {
    for (const [k, n] of this.store.entries()) {
      if (n.taskId === taskId) this.store.delete(k);
    }
  }

  async deleteAllForUser(userId: string): Promise<void> {
    for (const [k, n] of this.store.entries()) {
      if (n.userId === userId) this.store.delete(k);
    }
  }
}

class InMemoryUnitOfWork implements UnitOfWork {
  private readonly repos: UnitOfWorkRepositories;

  constructor(repos: UnitOfWorkRepositories) {
    this.repos = repos;
  }

  async runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return await work(this.repos);
  }
}

// ─────────────────────────────────────────────────────────────
// Testy My Tasks Edit & Policy Invarianty
// ─────────────────────────────────────────────────────────────

describe("My Tasks – Editace úkolů, oprávnění a oddělení od soukromých poznámek", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let areaRepo: InMemoryAreaRepository;
  let taskRepo: InMemoryTaskRepository;
  let participantRepo: InMemoryTaskParticipantRepository;
  let commentRepo: InMemoryTaskCommentRepository;
  let noteRepo: InMemoryUserTaskNoteRepository;
  let uow: InMemoryUnitOfWork;

  const boardId = "board-alpha";
  const area1Id = "area-frontend";
  const area2Id = "area-backend";
  const taskId = "task-alpha-1";

  const userAliceId = "user-alice";
  const userBobId = "user-bob";
  const userCharlieId = "user-charlie";
  const userAdminId = "user-admin";

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

  const charlieActor: ActorContext = {
    actor_user_id: userCharlieId,
    global_role: "USER",
    session_id: "sess-charlie",
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
    areaRepo = new InMemoryAreaRepository();
    taskRepo = new InMemoryTaskRepository();
    participantRepo = new InMemoryTaskParticipantRepository();
    commentRepo = new InMemoryTaskCommentRepository();
    noteRepo = new InMemoryUserTaskNoteRepository();

    uow = new InMemoryUnitOfWork({
      boards: boardRepo,
      memberships: membershipRepo,
      users: userRepo,
      areas: areaRepo,
      tasks: taskRepo,
      taskParticipants: participantRepo,
      taskComments: commentRepo,
      userTaskNotes: noteRepo,
    });

    boardRepo.store.set(boardId, {
      id: boardId,
      name: "Hlavní Nástěnka",
      description: null,
      createdBy: userAliceId,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    userRepo.store.set(userAliceId, {
      id: userAliceId,
      name: "Alice Owner",
      email: "alice@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set(userBobId, {
      id: userBobId,
      name: "Bob Assignee",
      email: "bob@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set(userCharlieId, {
      id: userCharlieId,
      name: "Charlie Member",
      email: "charlie@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set(userAdminId, {
      id: userAdminId,
      name: "Sys Admin",
      email: "admin@test.cz",
      globalRole: "ADMIN",
      isActive: true,
      deletedAt: null,
    });

    membershipRepo.create({ boardId, userId: userAliceId, role: "OWNER" });
    membershipRepo.create({ boardId, userId: userBobId, role: "MEMBER" });
    membershipRepo.create({ boardId, userId: userCharlieId, role: "MEMBER" });

    areaRepo.store.set(area1Id, {
      id: area1Id,
      boardId,
      name: "Frontend",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    areaRepo.store.set(area2Id, {
      id: area2Id,
      boardId,
      name: "Backend",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    taskRepo.store.set(taskId, {
      id: taskId,
      boardId,
      areaId: area1Id,
      title: "Testovací úkol pro My Tasks",
      description: "Původní popis úkolu",
      status: "ROZPRACOVANÉ",
      priority: "BĚŽNÁ",
      dueDate: new Date("2026-11-01"),
      createdBy: userAliceId,
      assigneeId: userBobId, // Bob je řešitelem
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  // ───────────────────────────────────────────────────────────
  // 16. Editace z My Tasks používá existující TaskPolicy
  // ───────────────────────────────────────────────────────────
  test("16. Editace z My Tasks: řešitel (Bob) může změnit název, popis a prioritu přes UpdateTaskUseCase", async () => {
    const updateTaskUseCase = new UpdateTaskUseCase(uow);
    const res = await updateTaskUseCase.execute(bobActor, {
      taskId,
      title: "Nový název Boba",
      description: "Nový popis Boba",
    });

    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.title, "Nový název Boba");
      assert.strictEqual(res.data.description, "Nový popis Boba");
    }

    const changePriorityUseCase = new ChangeTaskPriorityUseCase(uow);
    const pRes = await changePriorityUseCase.execute(bobActor, {
      taskId,
      priority: "SPĚCHÁ",
    });
    assert.strictEqual(pRes.success, true);
  });

  // ───────────────────────────────────────────────────────────
  // 17. Uživatel nemůže přes My Tasks obejít field-level oprávnění
  // ───────────────────────────────────────────────────────────
  test("17. Field-level oprávnění: řadový člen bez vazby (Charlie) NEMŮŽE změnit oblast ani termín", async () => {
    const changeAreaUseCase = new ChangeTaskAreaUseCase(uow);
    const areaRes = await changeAreaUseCase.execute(charlieActor, {
      taskId,
      newAreaId: area2Id,
    });

    assert.strictEqual(areaRes.success, false);
    if (!areaRes.success) {
      assert.ok(areaRes.error instanceof AuthorizationError);
      assert.strictEqual(areaRes.error.reason, "INSUFFICIENT_ROLE");
    }

    const changeDueDateUseCase = new ChangeTaskDueDateUseCase(uow);
    const dateRes = await changeDueDateUseCase.execute(charlieActor, {
      taskId,
      dueDate: new Date("2026-12-01"),
    });

    assert.strictEqual(dateRes.success, false);
    if (!dateRes.success) {
      assert.ok(dateRes.error instanceof AuthorizationError);
      assert.strictEqual(dateRes.error.reason, "INSUFFICIENT_ROLE");
    }
  });

  test("17b. Řešitel (Bob) a Vlastník (Alice) MOHOU změnit oblast i termín", async () => {
    const changeAreaUseCase = new ChangeTaskAreaUseCase(uow);
    const areaRes = await changeAreaUseCase.execute(bobActor, {
      taskId,
      newAreaId: area2Id,
    });
    assert.strictEqual(areaRes.success, true);

    const changeDueDateUseCase = new ChangeTaskDueDateUseCase(uow);
    const dateRes = await changeDueDateUseCase.execute(aliceActor, {
      taskId,
      dueDate: new Date("2026-12-31"),
    });
    assert.strictEqual(dateRes.success, true);
  });

  // ───────────────────────────────────────────────────────────
  // 18. Změna assignee respektuje existující pravidla
  // ───────────────────────────────────────────────────────────
  test("18. Změna řešitele: lze přiřadit člena, nelze přiřadit nečlena (CROSS_BOARD_ACCESS)", async () => {
    const changeAssigneeUseCase = new ChangeTaskAssigneeUseCase(uow);

    // Přiřazení člena Charlieho
    const okRes = await changeAssigneeUseCase.execute(bobActor, {
      taskId,
      assigneeId: userCharlieId,
    });
    assert.strictEqual(okRes.success, true);

    // Pokus o přiřazení nečlena
    const failRes = await changeAssigneeUseCase.execute(bobActor, {
      taskId,
      assigneeId: "stranger-non-member",
    });
    assert.strictEqual(failRes.success, false);
  });

  test("18b. Zrušení řešitele (assignee = null) uvolní i všechny spoluřešitele", async () => {
    // Přidáme Charlieho jako spoluřešitele
    await participantRepo.create({
      taskId,
      userId: userCharlieId,
      role: "CONTRIBUTOR",
    });
    assert.strictEqual((await participantRepo.findByTaskId(taskId)).length, 1);

    const changeAssigneeUseCase = new ChangeTaskAssigneeUseCase(uow);
    const res = await changeAssigneeUseCase.execute(aliceActor, {
      taskId,
      assigneeId: null,
    });
    assert.strictEqual(res.success, true);

    // Úkol nemá řešitele a nemá žádné spoluřešitele
    const task = await taskRepo.findById(taskId);
    assert.strictEqual(task?.assigneeId, null);
    const parts = await participantRepo.findByTaskId(taskId);
    assert.strictEqual(parts.length, 0);
  });

  // ───────────────────────────────────────────────────────────
  // 19. ADMIN nepřidává nové blanket oprávnění
  // ───────────────────────────────────────────────────────────
  test("19. ADMIN má oprávnění editovat úkol podle TaskPolicy, ale NEMÁ přístup k cizí soukromé poznámce", async () => {
    // 1. ADMIN může upravit název úkolu
    const updateTaskUseCase = new UpdateTaskUseCase(uow);
    const editRes = await updateTaskUseCase.execute(adminActor, {
      taskId,
      title: "Název upravený Adminem",
    });
    assert.strictEqual(editRes.success, true);

    // 2. Bob si uloží soukromou poznámku
    const noteUseCase = new UpsertUserTaskNoteUseCase(uow);
    await noteUseCase.execute(bobActor, {
      boardId,
      taskId,
      content: "Bobova tajná poznámka",
    });

    // 3. ADMIN se pokusí načíst poznámku k úkolu – získá výhradně SVOU poznámku (která neexistuje = null)
    const getNoteUseCase = new GetUserTaskNoteUseCase(
      boardRepo,
      membershipRepo,
      taskRepo,
      noteRepo,
    );
    const adminNoteRes = await getNoteUseCase.execute(adminActor, {
      boardId,
      taskId,
    });
    assert.strictEqual(adminNoteRes.success, true);
    if (adminNoteRes.success) {
      assert.strictEqual(adminNoteRes.data, null);
    }

    // 4. Přímé ověření v TaskPolicy: ADMIN pro cizí noteOwnerUserId dostane NOT_NOTE_OWNER
    const targetWithBob: TaskAuthorizationTarget = {
      boardId,
      taskId,
      createdBy: userAliceId,
      assigneeId: userBobId,
      noteOwnerUserId: userBobId,
    };
    const rel: ActorTaskRelationship = {
      isAssignee: false,
      isParticipant: false,
    };

    const policyRes = checkTaskPermission(
      adminActor,
      boardId,
      null,
      targetWithBob,
      rel,
      "TASK_PRIVATE_NOTE_VIEW_OWN",
    );
    assert.strictEqual(policyRes.allowed, false);
    assert.strictEqual(policyRes.reason, "NOT_NOTE_OWNER");
  });

  // ───────────────────────────────────────────────────────────
  // 20. Soukromá poznámka neovlivní týmové komentáře
  // ───────────────────────────────────────────────────────────
  test("20. Soukromá poznámka a týmové komentáře jsou striktně nezávislé entity", async () => {
    // 1. Přidáme týmový komentář
    const addCommentUseCase = new AddTaskCommentUseCase(uow);
    const commRes = await addCommentUseCase.execute(bobActor, {
      boardId,
      taskId,
      content: "Veřejný komentář pro celý tým",
    });
    assert.strictEqual(commRes.success, true);

    // 2. Bob přidá svou soukromou poznámku
    const upsertNoteUseCase = new UpsertUserTaskNoteUseCase(uow);
    const noteRes = await upsertNoteUseCase.execute(bobActor, {
      boardId,
      taskId,
      content: "Soukromá poznámka Boba",
    });
    assert.strictEqual(noteRes.success, true);

    // 3. Počet týmových komentářů je stále 1
    assert.strictEqual(await commentRepo.countByTaskId(taskId), 1);

    // 4. Alice načte týmové komentáře – vidí komentář Boba
    const getCommentsUseCase = new GetTaskCommentsUseCase(
      boardRepo,
      membershipRepo,
      taskRepo,
      commentRepo,
      userRepo,
      participantRepo,
    );
    const aliceCommentsRes = await getCommentsUseCase.execute(aliceActor, {
      boardId,
      taskId,
    });
    assert.strictEqual(aliceCommentsRes.success, true);
    if (aliceCommentsRes.success) {
      assert.strictEqual(aliceCommentsRes.data.length, 1);
      assert.strictEqual(
        aliceCommentsRes.data[0].content,
        "Veřejný komentář pro celý tým",
      );
    }

    // 5. Alice načte soukromé poznámky – Bobovu poznámku NEVIDÍ (vrátí null)
    const getNoteUseCase = new GetUserTaskNoteUseCase(
      boardRepo,
      membershipRepo,
      taskRepo,
      noteRepo,
    );
    const aliceNoteRes = await getNoteUseCase.execute(aliceActor, {
      boardId,
      taskId,
    });
    assert.strictEqual(aliceNoteRes.success, true);
    if (aliceNoteRes.success) {
      assert.strictEqual(aliceNoteRes.data, null);
    }
  });

  // ───────────────────────────────────────────────────────────
  // 21. GetMyTasksUseCase batch načtení hasPrivateNote
  // ───────────────────────────────────────────────────────────
  test("21. GetMyTasksUseCase správně a dávkově nastavuje hasPrivateNote", async () => {
    // Vytvoříme druhý úkol, kde je také Bob řešitelem
    const taskId2 = "task-alpha-2";
    taskRepo.store.set(taskId2, {
      id: taskId2,
      boardId,
      areaId: null,
      title: "Druhý úkol bez poznámky",
      description: null,
      status: "ROZPRACOVANÉ",
      priority: "BĚŽNÁ",
      dueDate: null,
      createdBy: userAliceId,
      assigneeId: userBobId,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Bob má soukromou poznámku POUZE k taskId (prvnímu úkolu)
    await noteRepo.upsert({
      userId: userBobId,
      taskId,
      content: "Poznámka k úkolu 1",
    });

    const getMyTasksUseCase = new GetMyTasksUseCase(
      boardRepo,
      taskRepo,
      participantRepo,
      areaRepo,
      userRepo,
      undefined,
      commentRepo,
      noteRepo,
    );

    const res = await getMyTasksUseCase.execute(bobActor, { filter: "ACTIVE" });
    assert.strictEqual(res.success, true);
    if (res.success) {
      const task1View = res.data.find((t) => t.id === taskId);
      const task2View = res.data.find((t) => t.id === taskId2);

      assert.strictEqual(task1View?.hasPrivateNote, true);
      assert.strictEqual(task2View?.hasPrivateNote, false);
    }
  });
});
