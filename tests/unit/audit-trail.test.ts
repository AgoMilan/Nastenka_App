import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
import type { Result } from "../../shared/types/result.ts";
import type { ActorContext } from "../../infrastructure/auth/actor-context.ts";
import type {
  BoardRecord,
  BoardRepository,
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
} from "../../modules/areas/application/ports/index.ts";
import type {
  TaskRecord,
  TaskRepository,
  TaskParticipantRecord,
  TaskParticipantRepository,
  TaskCommentRecord,
  TaskCommentRepository,
  UserTaskOrderRepository,
  UserTaskNoteRecord,
  UserTaskNoteRepository,
  UpsertUserTaskNoteData,
} from "../../modules/tasks/application/ports/index.ts";
import type {
  AuditLogRecord,
  AuditLogRepository,
  AuditQueryOptions,
  CreateAuditLogData,
} from "../../modules/audit/application/ports/audit-log-repository.port.ts";
import {
  CreateBoardUseCase,
  UpdateBoardUseCase,
  TransferOwnershipUseCase,
  SoftDeleteBoardUseCase,
} from "../../modules/boards/application/use-cases/index.ts";
import {
  AddMemberUseCase,
  RemoveMemberUseCase,
  LeaveBoardUseCase,
  ChangeMemberRoleUseCase,
} from "../../modules/membership/application/use-cases/index.ts";
import {
  CreateAreaUseCase,
  UpdateAreaUseCase,
  DeleteAreaUseCase,
} from "../../modules/areas/application/use-cases/index.ts";
import {
  CreateTaskUseCase,
  UpdateTaskUseCase,
  ChangeTaskStatusUseCase,
  ChangeTaskPriorityUseCase,
  ChangeTaskDueDateUseCase,
  ChangeTaskAreaUseCase,
  ChangeTaskAssigneeUseCase,
  TakeOverTaskUseCase,
  JoinTaskAsParticipantUseCase,
  LeaveTaskAsParticipantUseCase,
  RemoveTaskParticipantUseCase,
  ArchiveTaskUseCase,
  DeleteTaskUseCase,
  AddTaskCommentUseCase,
  UpdateTaskCommentUseCase,
  DeleteTaskCommentUseCase,
  GetUserTaskNoteUseCase,
  UpsertUserTaskNoteUseCase,
  DeleteUserTaskNoteUseCase,
} from "../../modules/tasks/application/use-cases/index.ts";

// ─────────────────────────────────────────────────────────────
// Test In-Memory Repositories with Rollback Support
// ─────────────────────────────────────────────────────────────

class InMemoryAuditLogRepository implements AuditLogRepository {
  public store: AuditLogRecord[] = [];
  public shouldFailOnLog = false;

  async log(data: CreateAuditLogData): Promise<AuditLogRecord> {
    if (this.shouldFailOnLog) {
      throw new Error("Simulated AuditLog database failure");
    }
    const record: AuditLogRecord = {
      id: `audit-${this.store.length + 1}`,
      actorUserId: data.actorUserId,
      timestamp: data.timestamp ?? new Date(),
      boardId: data.boardId,
      operation: data.operation,
      targetId: data.targetId,
      previousState: (data.previousState as Record<string, unknown> | null) ?? null,
      newState: (data.newState as Record<string, unknown> | null) ?? null,
      metadata: (data.metadata as Record<string, unknown> | null) ?? null,
    };
    this.store.push(record);
    return record;
  }

  async findByBoardId(boardId: string, options?: AuditQueryOptions): Promise<AuditLogRecord[]> {
    const list = this.store
      .filter((r) => r.boardId === boardId)
      .slice()
      .reverse();
    return options?.limit ? list.slice(0, options.limit) : list;
  }

  async findByTaskId(boardId: string, taskId: string, options?: AuditQueryOptions): Promise<AuditLogRecord[]> {
    const list = this.store
      .filter(
        (r) =>
          r.boardId === boardId &&
          (r.targetId === taskId ||
            r.newState?.taskId === taskId ||
            r.previousState?.taskId === taskId),
      )
      .slice()
      .reverse();
    return options?.limit ? list.slice(0, options.limit) : list;
  }

  clone(): AuditLogRecord[] {
    return [...this.store];
  }

  restore(snap: AuditLogRecord[]): void {
    this.store = [...snap];
  }
}

class InMemoryBoardRepository implements BoardRepository {
  public store = new Map<string, BoardRecord>();

  async findById(id: string): Promise<BoardRecord | null> {
    const r = this.store.get(id);
    return r ? { ...r } : null;
  }

  async findByIdForUpdate(id: string): Promise<BoardRecord | null> {
    return this.findById(id);
  }

  async create(data: { name: string; description?: string | null; createdBy: string }): Promise<BoardRecord> {
    const id = `board-${this.store.size + 1}`;
    const r: BoardRecord = {
      id,
      name: data.name,
      description: data.description ?? null,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    this.store.set(id, r);
    return { ...r };
  }

  async update(boardId: string, data: { name?: string; description?: string | null }): Promise<BoardRecord> {
    const existing = this.store.get(boardId);
    if (!existing) throw new Error("Board not found");
    const updated: BoardRecord = {
      ...existing,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      updatedAt: new Date(),
    };
    this.store.set(boardId, updated);
    return { ...updated };
  }

  async softDelete(boardId: string, deletedAt: Date): Promise<void> {
    const r = this.store.get(boardId);
    if (r) {
      this.store.set(boardId, { ...r, deletedAt });
    }
  }

  async findActiveBoardsForUser(): Promise<any[]> { return []; }
  async findActiveBoardsForAdmin(): Promise<any[]> { return []; }

  clone(): Map<string, BoardRecord> {
    return new Map(this.store);
  }
  restore(snap: Map<string, BoardRecord>): void {
    this.store = new Map(snap);
  }
}

class InMemoryMembershipRepository implements MembershipRepository {
  public store = new Map<string, MembershipRecord>();

  async findByBoardAndUser(boardId: string, userId: string): Promise<MembershipRecord | null> {
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

  async create(data: { boardId: string; userId: string; role: "OWNER" | "MANAGER" | "MEMBER" }): Promise<MembershipRecord> {
    const id = `mem-${this.store.size + 1}`;
    const r: MembershipRecord = {
      id,
      boardId: data.boardId,
      userId: data.userId,
      role: data.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(id, r);
    return { ...r };
  }

  async updateRole(boardId: string, userId: string, newRole: "OWNER" | "MANAGER" | "MEMBER"): Promise<void> {
    for (const [id, r] of this.store.entries()) {
      if (r.boardId === boardId && r.userId === userId) {
        const updated: MembershipRecord = { ...r, role: newRole, updatedAt: new Date() };
        this.store.set(id, updated);
        return;
      }
    }
    throw new Error("Membership not found");
  }

  async delete(boardId: string, userId: string): Promise<void> {
    for (const [id, r] of this.store.entries()) {
      if (r.boardId === boardId && r.userId === userId) {
        this.store.delete(id);
        return;
      }
    }
  }

  async countOwnersByBoard(boardId: string): Promise<number> {
    return Array.from(this.store.values()).filter((m) => m.boardId === boardId && m.role === "OWNER").length;
  }

  clone(): Map<string, MembershipRecord> {
    return new Map(this.store);
  }
  restore(snap: Map<string, MembershipRecord>): void {
    this.store = new Map(snap);
  }
}

class InMemoryUserRepository implements UserRepository {
  public store = new Map<string, UserRecord>();

  async findById(userId: string): Promise<UserRecord | null> {
    const u = this.store.get(userId);
    return u ? { ...u } : null;
  }
  async findByIds(userIds: string[]): Promise<UserRecord[]> {
    return userIds.map((id) => this.store.get(id)!).filter(Boolean);
  }
  async findActiveUsers(): Promise<UserRecord[]> {
    return Array.from(this.store.values()).filter((u) => u.isActive && u.deletedAt === null);
  }

  clone(): Map<string, UserRecord> {
    return new Map(this.store);
  }
  restore(snap: Map<string, UserRecord>): void {
    this.store = new Map(snap);
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
  async findByBoardAndName(boardId: string, name: string): Promise<AreaRecord | null> {
    for (const a of this.store.values()) {
      if (a.boardId === boardId && a.name.toLowerCase() === name.toLowerCase()) {
        return { ...a };
      }
    }
    return null;
  }
  async create(data: { boardId: string; name: string; description?: string | null }): Promise<AreaRecord> {
    const id = `area-${this.store.size + 1}`;
    const r: AreaRecord = {
      id,
      boardId: data.boardId,
      name: data.name,
      description: data.description ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(id, r);
    return { ...r };
  }
  async update(id: string, data: { name?: string; description?: string | null }): Promise<AreaRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Area not found");
    const updated: AreaRecord = {
      ...existing,
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

  clone(): Map<string, AreaRecord> {
    return new Map(this.store);
  }
  restore(snap: Map<string, AreaRecord>): void {
    this.store = new Map(snap);
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
  async findUserTasksAcrossBoards(): Promise<TaskRecord[]> { return []; }
  async create(data: any): Promise<TaskRecord> {
    const id = `task-${this.store.size + 1}`;
    const r: TaskRecord = {
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
    this.store.set(id, r);
    return { ...r };
  }
  async update(id: string, data: any): Promise<TaskRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Task not found");
    const updated: TaskRecord = { ...existing, ...data, updatedAt: new Date() };
    this.store.set(id, updated);
    return { ...updated };
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  clone(): Map<string, TaskRecord> {
    return new Map(this.store);
  }
  restore(snap: Map<string, TaskRecord>): void {
    this.store = new Map(snap);
  }
}

class InMemoryTaskParticipantRepository implements TaskParticipantRepository {
  public store = new Map<string, TaskParticipantRecord>();

  async findByTaskId(taskId: string): Promise<TaskParticipantRecord[]> {
    return Array.from(this.store.values()).filter((p) => p.taskId === taskId);
  }
  async findByTaskIds(): Promise<TaskParticipantRecord[]> { return []; }
  async findByTaskAndUser(taskId: string, userId: string): Promise<TaskParticipantRecord | null> {
    for (const p of this.store.values()) {
      if (p.taskId === taskId && p.userId === userId) return { ...p };
    }
    return null;
  }
  async addParticipant(taskId: string, userId: string, role = "SPOLUŘEŠITEL"): Promise<TaskParticipantRecord> {
    const id = `part-${this.store.size + 1}`;
    const r: TaskParticipantRecord = { id, taskId, userId, role, createdAt: new Date() };
    this.store.set(id, r);
    return { ...r };
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
      if (p.taskId === taskId) this.store.delete(id);
    }
  }

  clone(): Map<string, TaskParticipantRecord> {
    return new Map(this.store);
  }
  restore(snap: Map<string, TaskParticipantRecord>): void {
    this.store = new Map(snap);
  }
}

class InMemoryTaskCommentRepository implements TaskCommentRepository {
  public store = new Map<string, TaskCommentRecord>();

  async findById(id: string): Promise<TaskCommentRecord | null> {
    const c = this.store.get(id);
    return c ? { ...c } : null;
  }
  async findByTaskId(taskId: string): Promise<TaskCommentRecord[]> {
    return Array.from(this.store.values()).filter((c) => c.taskId === taskId);
  }
  async countByTaskId(taskId: string): Promise<number> {
    return Array.from(this.store.values()).filter((c) => c.taskId === taskId).length;
  }
  async countByTaskIds(): Promise<Map<string, number>> { return new Map(); }
  async create(data: { taskId: string; authorId: string; content: string }): Promise<TaskCommentRecord> {
    const id = `comm-${this.store.size + 1}`;
    const r: TaskCommentRecord = {
      id,
      taskId: data.taskId,
      authorId: data.authorId,
      content: data.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(id, r);
    return { ...r };
  }
  async update(id: string, data: { content: string }): Promise<TaskCommentRecord> {
    const existing = this.store.get(id);
    if (!existing) throw new Error("Comment not found");
    const updated: TaskCommentRecord = { ...existing, content: data.content, updatedAt: new Date() };
    this.store.set(id, updated);
    return { ...updated };
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
  async deleteAllForTask(taskId: string): Promise<void> {
    for (const [id, c] of this.store.entries()) {
      if (c.taskId === taskId) this.store.delete(id);
    }
  }

  clone(): Map<string, TaskCommentRecord> {
    return new Map(this.store);
  }
  restore(snap: Map<string, TaskCommentRecord>): void {
    this.store = new Map(snap);
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

  async findByUserAndTask(userId: string, taskId: string): Promise<UserTaskNoteRecord | null> {
    const found = this.store.get(this.key(userId, taskId));
    return found ? { ...found } : null;
  }

  async findByUserAndTaskIds(userId: string, taskIds: string[]): Promise<Map<string, UserTaskNoteRecord>> {
    const map = new Map<string, UserTaskNoteRecord>();
    for (const taskId of taskIds) {
      const note = this.store.get(this.key(userId, taskId));
      if (note) map.set(taskId, { ...note });
    }
    return map;
  }

  async upsert(data: UpsertUserTaskNoteData): Promise<UserTaskNoteRecord> {
    const existing = await this.findByUserAndTask(data.userId, data.taskId);
    if (existing) {
      const updated: UserTaskNoteRecord = { ...existing, content: data.content, updatedAt: new Date() };
      this.store.set(this.key(data.userId, data.taskId), updated);
      return { ...updated };
    }
    const id = `note-${this.store.size + 1}`;
    const record: UserTaskNoteRecord = {
      id,
      userId: data.userId,
      taskId: data.taskId,
      content: data.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(this.key(data.userId, data.taskId), record);
    return { ...record };
  }

  async delete(userId: string, taskId: string): Promise<void> {
    this.store.delete(this.key(userId, taskId));
  }
  async deleteAllForTask(taskId: string): Promise<void> {
    for (const [key, n] of this.store.entries()) {
      if (n.taskId === taskId) this.store.delete(key);
    }
  }
  async deleteAllForUser(userId: string): Promise<void> {
    for (const [key, n] of this.store.entries()) {
      if (n.userId === userId) this.store.delete(key);
    }
  }

  clone(): Map<string, UserTaskNoteRecord> {
    return new Map(this.store);
  }
  restore(snap: Map<string, UserTaskNoteRecord>): void {
    this.store = new Map(snap);
  }
}

class InMemoryUserTaskOrderRepository implements UserTaskOrderRepository {
  public store = new Map<string, any>();
  async findByBoardAndUser(boardId: string, userId: string): Promise<any[]> {
    return Array.from(this.store.values()).filter((o) => o.boardId === boardId && o.userId === userId);
  }
  async findByTaskId(taskId: string): Promise<any[]> {
    return Array.from(this.store.values()).filter((o) => o.taskId === taskId);
  }
  async upsertOrder(): Promise<void> {}
  async upsertOrders(): Promise<void> {}
  async deleteByBoardAndUser(): Promise<void> {}
  async deleteByTaskId(): Promise<void> {}
  clone(): Map<string, any> { return new Map(this.store); }
  restore(snap: Map<string, any>): void { this.store = new Map(snap); }
}

class InMemoryUnitOfWork implements UnitOfWork {
  public readonly boards: InMemoryBoardRepository;
  public readonly memberships: InMemoryMembershipRepository;
  public readonly users: InMemoryUserRepository;
  public readonly areas: InMemoryAreaRepository;
  public readonly tasks: InMemoryTaskRepository;
  public readonly taskParticipants: InMemoryTaskParticipantRepository;
  public readonly taskComments: InMemoryTaskCommentRepository;
  public readonly userTaskOrders: InMemoryUserTaskOrderRepository;
  public readonly userTaskNotes: InMemoryUserTaskNoteRepository;
  public readonly auditLogs: InMemoryAuditLogRepository;

  constructor(
    boards: InMemoryBoardRepository,
    memberships: InMemoryMembershipRepository,
    users: InMemoryUserRepository,
    areas: InMemoryAreaRepository,
    tasks: InMemoryTaskRepository,
    taskParticipants: InMemoryTaskParticipantRepository,
    taskComments: InMemoryTaskCommentRepository,
    userTaskOrders: InMemoryUserTaskOrderRepository,
    userTaskNotes: InMemoryUserTaskNoteRepository,
    auditLogs: InMemoryAuditLogRepository,
  ) {
    this.boards = boards;
    this.memberships = memberships;
    this.users = users;
    this.areas = areas;
    this.tasks = tasks;
    this.taskParticipants = taskParticipants;
    this.taskComments = taskComments;
    this.userTaskOrders = userTaskOrders;
    this.userTaskNotes = userTaskNotes;
    this.auditLogs = auditLogs;
  }

  async runInTransaction<T>(work: (repos: UnitOfWorkRepositories) => Promise<T>): Promise<T> {
    const snapBoards = this.boards.clone();
    const snapMemberships = this.memberships.clone();
    const snapUsers = this.users.clone();
    const snapAreas = this.areas.clone();
    const snapTasks = this.tasks.clone();
    const snapParticipants = this.taskParticipants.clone();
    const snapComments = this.taskComments.clone();
    const snapOrders = this.userTaskOrders.clone();
    const snapNotes = this.userTaskNotes.clone();
    const snapAudit = this.auditLogs.clone();

    try {
      const repos: UnitOfWorkRepositories = {
        boards: this.boards,
        memberships: this.memberships,
        users: this.users,
        areas: this.areas,
        tasks: this.tasks,
        taskParticipants: this.taskParticipants,
        taskComments: this.taskComments,
        userTaskOrders: this.userTaskOrders,
        userTaskNotes: this.userTaskNotes,
        auditLogs: this.auditLogs,
      };
      return await work(repos);
    } catch (err) {
      this.boards.restore(snapBoards);
      this.memberships.restore(snapMemberships);
      this.users.restore(snapUsers);
      this.areas.restore(snapAreas);
      this.tasks.restore(snapTasks);
      this.taskParticipants.restore(snapParticipants);
      this.taskComments.restore(snapComments);
      this.userTaskOrders.restore(snapOrders);
      this.userTaskNotes.restore(snapNotes);
      this.auditLogs.restore(snapAudit);
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Tests Suite
// ─────────────────────────────────────────────────────────────

describe("STEP 9B – Audit Trail Complete Verification", () => {
  let boardsRepo: InMemoryBoardRepository;
  let membershipsRepo: InMemoryMembershipRepository;
  let usersRepo: InMemoryUserRepository;
  let areasRepo: InMemoryAreaRepository;
  let tasksRepo: InMemoryTaskRepository;
  let participantsRepo: InMemoryTaskParticipantRepository;
  let commentsRepo: InMemoryTaskCommentRepository;
  let ordersRepo: InMemoryUserTaskOrderRepository;
  let notesRepo: InMemoryUserTaskNoteRepository;
  let auditRepo: InMemoryAuditLogRepository;
  let uow: InMemoryUnitOfWork;

  function assertSuccess<T, E>(
    result: Result<T, E>,
  ): asserts result is { readonly success: true; readonly data: T } {
    assert.ok(
      result.success,
      (result as { error?: Error }).error?.message ?? "Expected success",
    );
  }

  const adminActor: ActorContext = {
    actor_user_id: "user-admin",
    global_role: "ADMIN",
    session_id: "test-session-admin",
    is_active: true,
  };

  const aliceActor: ActorContext = {
    actor_user_id: "user-alice",
    global_role: "USER",
    session_id: "test-session-alice",
    is_active: true,
  };

  const bobActor: ActorContext = {
    actor_user_id: "user-bob",
    global_role: "USER",
    session_id: "test-session-bob",
    is_active: true,
  };

  beforeEach(() => {
    boardsRepo = new InMemoryBoardRepository();
    membershipsRepo = new InMemoryMembershipRepository();
    usersRepo = new InMemoryUserRepository();
    areasRepo = new InMemoryAreaRepository();
    tasksRepo = new InMemoryTaskRepository();
    participantsRepo = new InMemoryTaskParticipantRepository();
    commentsRepo = new InMemoryTaskCommentRepository();
    ordersRepo = new InMemoryUserTaskOrderRepository();
    notesRepo = new InMemoryUserTaskNoteRepository();
    auditRepo = new InMemoryAuditLogRepository();

    uow = new InMemoryUnitOfWork(
      boardsRepo,
      membershipsRepo,
      usersRepo,
      areasRepo,
      tasksRepo,
      participantsRepo,
      commentsRepo,
      ordersRepo,
      notesRepo,
      auditRepo,
    );

    // Register active users
    usersRepo.store.set("user-admin", {
      id: "user-admin",
      email: "admin@test.local",
      name: "Admin",
      globalRole: "ADMIN",
      isActive: true,
      deletedAt: null,
    });

    usersRepo.store.set("user-alice", {
      id: "user-alice",
      email: "alice@test.local",
      name: "Alice",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });

    usersRepo.store.set("user-bob", {
      id: "user-bob",
      email: "bob@test.local",
      name: "Bob",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
  });

  describe("1. Board Domain (4 Events)", () => {
    test("BOARD_CREATED: audit log is written with new state and metadata", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const res = await useCase.execute(aliceActor, {
        name: "Projekt Alpha",
        description: "Popis projektu",
      });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "BOARD_CREATED");
      assert.equal(log.actorUserId, "user-alice");
      assert.equal(log.boardId, res.data.board.id);
      assert.equal(log.targetId, res.data.board.id);
      assert.equal(log.previousState, null);
      assert.deepEqual(log.newState, {
        name: "Projekt Alpha",
        description: "Popis projektu",
      });
      assert.deepEqual(log.metadata, {
        ownerUserId: "user-alice",
      });
    });

    test("BOARD_UPDATED: audit log is written when name or description changes", async () => {
      const createRes = await new CreateBoardUseCase(uow).execute(aliceActor, {
        name: "Old Name",
        description: "Old Desc",
      });
      assertSuccess(createRes);
      const boardId = createRes.data.board.id;
      auditRepo.store = []; // reset

      const updateUseCase = new UpdateBoardUseCase(uow);
      const updateRes = await updateUseCase.execute(aliceActor, {
        boardId,
        name: "New Name",
        description: "New Desc",
      });

      assert.equal(updateRes.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "BOARD_UPDATED");
      assert.equal(log.targetId, boardId);
      assert.deepEqual(log.previousState, { name: "Old Name", description: "Old Desc" });
      assert.deepEqual(log.newState, { name: "New Name", description: "New Desc" });

      // No-op verification
      auditRepo.store = [];
      const noOpRes = await updateUseCase.execute(aliceActor, {
        boardId,
        name: "New Name",
        description: "New Desc",
      });
      assert.equal(noOpRes.success, true);
      assert.equal(auditRepo.store.length, 0, "No audit log should be written on no-op update");
    });

    test("BOARD_OWNER_TRANSFERRED: produces only BOARD_OWNER_TRANSFERRED without MEMBER_ROLE_CHANGED", async () => {
      const createRes = await new CreateBoardUseCase(uow).execute(aliceActor, { name: "Board" });
      assertSuccess(createRes);
      const boardId = createRes.data.board.id;

      // Add Bob as Member
      await new AddMemberUseCase(uow).execute(aliceActor, { boardId, targetUserId: "user-bob", role: "MEMBER" });
      auditRepo.store = []; // reset

      const transferUseCase = new TransferOwnershipUseCase(uow);
      const res = await transferUseCase.execute(aliceActor, { boardId, targetUserId: "user-bob" });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1, "Must produce exactly 1 event");
      const log = auditRepo.store[0];
      assert.equal(log.operation, "BOARD_OWNER_TRANSFERRED");
      assert.deepEqual(log.previousState, { ownerUserId: "user-alice" });
      assert.deepEqual(log.newState, { ownerUserId: "user-bob" });
    });

    test("BOARD_DELETED: audit log is written with soft delete timestamp", async () => {
      const createRes = await new CreateBoardUseCase(uow).execute(aliceActor, { name: "Board" });
      assertSuccess(createRes);
      const boardId = createRes.data.board.id;
      auditRepo.store = [];

      const deleteUseCase = new SoftDeleteBoardUseCase(uow);
      const res = await deleteUseCase.execute(aliceActor, { boardId });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "BOARD_DELETED");
      assert.equal(log.targetId, boardId);
      assert.deepEqual(log.previousState, { deletedAt: null });
      assert.ok(log.newState && typeof (log.newState as any).deletedAt === "string");
    });
  });

  describe("2. Membership Domain (4 Events)", () => {
    let boardId: string;

    beforeEach(async () => {
      const res = await new CreateBoardUseCase(uow).execute(aliceActor, { name: "Team Board" });
      assertSuccess(res);
      boardId = res.data.board.id;
      auditRepo.store = [];
    });

    test("MEMBER_ADDED: audit log records target user and role", async () => {
      const useCase = new AddMemberUseCase(uow);
      const res = await useCase.execute(aliceActor, {
        boardId,
        targetUserId: "user-bob",
        role: "MEMBER",
      });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "MEMBER_ADDED");
      assert.equal(log.targetId, "user-bob");
      assert.equal(log.previousState, null);
      assert.deepEqual(log.newState, { role: "MEMBER" });
    });

    test("MEMBER_ROLE_CHANGED: audit log records role transition and ignores no-op", async () => {
      await new AddMemberUseCase(uow).execute(aliceActor, { boardId, targetUserId: "user-bob", role: "MEMBER" });
      auditRepo.store = [];

      const changeRoleUseCase = new ChangeMemberRoleUseCase(uow);
      const res = await changeRoleUseCase.execute(aliceActor, {
        boardId,
        targetUserId: "user-bob",
        newRole: "MANAGER",
      });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "MEMBER_ROLE_CHANGED");
      assert.deepEqual(log.previousState, { role: "MEMBER" });
      assert.deepEqual(log.newState, { role: "MANAGER" });

      // No-op
      auditRepo.store = [];
      const noOpRes = await changeRoleUseCase.execute(aliceActor, {
        boardId,
        targetUserId: "user-bob",
        newRole: "MANAGER",
      });
      assert.equal(noOpRes.success, true);
      assert.equal(auditRepo.store.length, 0, "No audit log for unchanged role");
    });

    test("MEMBER_REMOVED: administrative removal logs MEMBER_REMOVED", async () => {
      await new AddMemberUseCase(uow).execute(aliceActor, { boardId, targetUserId: "user-bob", role: "MEMBER" });
      auditRepo.store = [];

      const removeUseCase = new RemoveMemberUseCase(uow);
      const res = await removeUseCase.execute(aliceActor, {
        boardId,
        targetUserId: "user-bob",
      });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "MEMBER_REMOVED");
      assert.equal(log.targetId, "user-bob");
      assert.deepEqual(log.previousState, { role: "MEMBER" });
      assert.equal(log.newState, null);
    });

    test("MEMBER_LEFT_BOARD: voluntary leave logs MEMBER_LEFT_BOARD", async () => {
      await new AddMemberUseCase(uow).execute(aliceActor, { boardId, targetUserId: "user-bob", role: "MEMBER" });
      auditRepo.store = [];

      const leaveUseCase = new LeaveBoardUseCase(uow);
      const res = await leaveUseCase.execute(bobActor, { boardId });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "MEMBER_LEFT_BOARD");
      assert.equal(log.actorUserId, "user-bob");
      assert.equal(log.targetId, "user-bob");
      assert.deepEqual(log.previousState, { role: "MEMBER" });
      assert.equal(log.newState, null);
    });
  });

  describe("3. Area Domain (3 Events)", () => {
    let boardId: string;

    beforeEach(async () => {
      const res = await new CreateBoardUseCase(uow).execute(aliceActor, { name: "Board" });
      assertSuccess(res);
      boardId = res.data.board.id;
      auditRepo.store = [];
    });

    test("AREA_CREATED: audit log records area name and description", async () => {
      const useCase = new CreateAreaUseCase(uow);
      const res = await useCase.execute(aliceActor, {
        boardId,
        name: "Backend",
        description: "API a databáze",
      });

      assertSuccess(res);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "AREA_CREATED");
      assert.equal(log.targetId, res.data.id);
      assert.deepEqual(log.newState, { name: "Backend", description: "API a databáze" });
    });

    test("AREA_UPDATED: audit log records change and ignores no-op", async () => {
      const createRes = await new CreateAreaUseCase(uow).execute(aliceActor, {
        boardId,
        name: "Frontend",
        description: "Starý popis",
      });
      assertSuccess(createRes);
      const areaId = createRes.data.id;
      auditRepo.store = [];

      const updateUseCase = new UpdateAreaUseCase(uow);
      const res = await updateUseCase.execute(aliceActor, {
        areaId,
        name: "Frontend UI",
        description: "Nový popis",
      });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "AREA_UPDATED");
      assert.deepEqual(log.previousState, { name: "Frontend", description: "Starý popis" });
      assert.deepEqual(log.newState, { name: "Frontend UI", description: "Nový popis" });

      // No-op
      auditRepo.store = [];
      const noOp = await updateUseCase.execute(aliceActor, {
        areaId,
        name: "Frontend UI",
        description: "Nový popis",
      });
      assert.equal(noOp.success, true);
      assert.equal(auditRepo.store.length, 0, "No audit log on area no-op update");
    });

    test("AREA_DELETED: audit log records deletion with previous state", async () => {
      const createRes = await new CreateAreaUseCase(uow).execute(aliceActor, {
        boardId,
        name: "Doomed Area",
      });
      assertSuccess(createRes);
      const areaId = createRes.data.id;
      auditRepo.store = [];

      const deleteUseCase = new DeleteAreaUseCase(uow);
      const res = await deleteUseCase.execute(aliceActor, {
        areaId,
        confirmation: "SMAZAT",
      });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "AREA_DELETED");
      assert.equal(log.targetId, areaId);
      assert.deepEqual(log.previousState, { name: "Doomed Area", description: null });
      assert.equal(log.newState, null);
    });
  });

  describe("4. Task Domain (12 Events) and Privacy Policy", () => {
    let boardId: string;
    let taskId: string;

    beforeEach(async () => {
      const boardRes = await new CreateBoardUseCase(uow).execute(aliceActor, { name: "Task Board" });
      assertSuccess(boardRes);
      boardId = boardRes.data.board.id;
      await new AddMemberUseCase(uow).execute(aliceActor, { boardId, targetUserId: "user-bob", role: "MEMBER" });

      const taskRes = await new CreateTaskUseCase(uow).execute(aliceActor, {
        boardId,
        title: "Původní úkol",
        description: "Tajný citlivý popis úkolu",
      });
      assertSuccess(taskRes);
      taskId = taskRes.data.id;
      auditRepo.store = [];
    });

    test("TASK_CREATED: description text is strictly excluded from audit log", async () => {
      const taskRes = await new CreateTaskUseCase(uow).execute(aliceActor, {
        boardId,
        title: "Nový úkol",
        description: "Důvěrný text popisu, který nesmí být v auditu",
      });
      assertSuccess(taskRes);

      const log = auditRepo.store.find((l) => l.operation === "TASK_CREATED");
      assert.ok(log);
      assert.equal(log.targetId, taskRes.data.id);
      assert.equal((log.newState as any).title, "Nový úkol");
      assert.equal((log.newState as any).description, undefined, "Description must NOT be in newState");

      // Verify serialized log does not contain sensitive description
      const serialized = JSON.stringify(log);
      assert.equal(serialized.includes("Důvěrný text popisu"), false);
    });

    test("TASK_TITLE_CHANGED & TASK_DESCRIPTION_CHANGED: privacy rule test", async () => {
      const updateUseCase = new UpdateTaskUseCase(uow);
      const res = await updateUseCase.execute(aliceActor, {
        taskId,
        title: "Upravený název úkolu",
        description: "Zcela nový tajný text popisu",
      });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 2);

      const titleLog = auditRepo.store.find((l) => l.operation === "TASK_TITLE_CHANGED");
      assert.ok(titleLog);
      assert.deepEqual(titleLog.previousState, { title: "Původní úkol" });
      assert.deepEqual(titleLog.newState, { title: "Upravený název úkolu" });

      const descLog = auditRepo.store.find((l) => l.operation === "TASK_DESCRIPTION_CHANGED");
      assert.ok(descLog);
      assert.deepEqual(descLog.previousState, { hasDescription: true });
      assert.deepEqual(descLog.newState, { hasDescription: true });

      // Verify description text is NOT in any log field
      const serialized = JSON.stringify(descLog);
      assert.equal(serialized.includes("Zcela nový tajný text"), false);
      assert.equal(serialized.includes("Tajný citlivý popis"), false);
    });

    test("TASK_STATUS_CHANGED: logs transition and ignores no-op", async () => {
      // First assign to alice so she can change status
      await new ChangeTaskAssigneeUseCase(uow).execute(aliceActor, { taskId, assigneeId: "user-alice" });
      auditRepo.store = [];

      const statusUseCase = new ChangeTaskStatusUseCase(uow);
      const res = await statusUseCase.execute(aliceActor, { taskId, newStatus: "ROZPRACOVANÉ" });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_STATUS_CHANGED");
      assert.deepEqual(log.previousState, { status: "NOVÉ" });
      assert.deepEqual(log.newState, { status: "ROZPRACOVANÉ" });

      // No-op
      auditRepo.store = [];
      const noOpRes = await statusUseCase.execute(aliceActor, { taskId, newStatus: "ROZPRACOVANÉ" });
      assert.equal(noOpRes.success, true);
      assert.equal(auditRepo.store.length, 0, "No audit on same status");
    });

    test("TASK_PRIORITY_CHANGED: logs priority change and ignores no-op", async () => {
      const priorityUseCase = new ChangeTaskPriorityUseCase(uow);
      const res = await priorityUseCase.execute(aliceActor, { taskId, priority: "SPĚCHÁ" });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_PRIORITY_CHANGED");
      assert.deepEqual(log.previousState, { priority: "BĚŽNÁ" });
      assert.deepEqual(log.newState, { priority: "SPĚCHÁ" });

      // No-op
      auditRepo.store = [];
      const noOp = await priorityUseCase.execute(aliceActor, { taskId, priority: "SPĚCHÁ" });
      assert.equal(noOp.success, true);
      assert.equal(auditRepo.store.length, 0);
    });

    test("TASK_DUE_DATE_CHANGED: logs due date change and ignores no-op", async () => {
      const dueDateUseCase = new ChangeTaskDueDateUseCase(uow);
      const targetDate = new Date("2026-12-31T12:00:00Z");
      const res = await dueDateUseCase.execute(aliceActor, { taskId, dueDate: targetDate });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_DUE_DATE_CHANGED");
      assert.deepEqual(log.previousState, { dueDate: null });
      assert.deepEqual(log.newState, { dueDate: targetDate.toISOString() });

      // No-op
      auditRepo.store = [];
      const noOp = await dueDateUseCase.execute(aliceActor, { taskId, dueDate: targetDate });
      assert.equal(noOp.success, true);
      assert.equal(auditRepo.store.length, 0);
    });

    test("TASK_AREA_CHANGED: logs area change and ignores no-op", async () => {
      const areaRes = await new CreateAreaUseCase(uow).execute(aliceActor, { boardId, name: "Area 1" });
      assertSuccess(areaRes);
      auditRepo.store = [];

      const areaUseCase = new ChangeTaskAreaUseCase(uow);
      const res = await areaUseCase.execute(aliceActor, { taskId, newAreaId: areaRes.data.id });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_AREA_CHANGED");
      assert.deepEqual(log.previousState, { areaId: null });
      assert.deepEqual(log.newState, { areaId: areaRes.data.id });

      // No-op
      auditRepo.store = [];
      const noOp = await areaUseCase.execute(aliceActor, { taskId, newAreaId: areaRes.data.id });
      assert.equal(noOp.success, true);
      assert.equal(auditRepo.store.length, 0);
    });

    test("TASK_ASSIGNEE_CHANGED: logs assignee assignment and takeover", async () => {
      const assigneeUseCase = new ChangeTaskAssigneeUseCase(uow);
      const res = await assigneeUseCase.execute(aliceActor, { taskId, assigneeId: "user-bob" });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      let log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_ASSIGNEE_CHANGED");
      assert.deepEqual(log.previousState, { assigneeId: null });
      assert.deepEqual(log.newState, { assigneeId: "user-bob" });

      // Takeover by Alice
      auditRepo.store = [];
      const takeOverUseCase = new TakeOverTaskUseCase(uow);
      const takeOverRes = await takeOverUseCase.execute(aliceActor, { taskId });
      assert.equal(takeOverRes.success, true);
      assert.equal(auditRepo.store.length, 1);
      log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_ASSIGNEE_CHANGED");
      assert.deepEqual(log.previousState, { assigneeId: "user-bob" });
      assert.deepEqual(log.newState, { assigneeId: "user-alice" });
    });

    test("TASK_PARTICIPANT_ADDED & REMOVED: verifies participant joining and leaving", async () => {
      // Bob joins as participant (Alice is assignee)
      await new ChangeTaskAssigneeUseCase(uow).execute(aliceActor, { taskId, assigneeId: "user-alice" });
      auditRepo.store = [];

      const joinUseCase = new JoinTaskAsParticipantUseCase(uow);
      const joinRes = await joinUseCase.execute(bobActor, { taskId });
      assert.equal(joinRes.success, true);
      assert.equal(auditRepo.store.length, 1);
      let log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_PARTICIPANT_ADDED");
      assert.deepEqual(log.newState, { participantId: "user-bob" });

      // Bob leaves
      auditRepo.store = [];
      const leaveUseCase = new LeaveTaskAsParticipantUseCase(uow);
      const leaveRes = await leaveUseCase.execute(bobActor, { taskId });
      assert.equal(leaveRes.success, true);
      assert.equal(auditRepo.store.length, 1);
      log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_PARTICIPANT_REMOVED");
      assert.deepEqual(log.previousState, { participantId: "user-bob" });
      assert.equal(log.newState, null);
    });

    test("TASK_ARCHIVED: produces only TASK_ARCHIVED without TASK_STATUS_CHANGED", async () => {
      await new ChangeTaskAssigneeUseCase(uow).execute(aliceActor, { taskId, assigneeId: "user-alice" });
      auditRepo.store = [];

      const archiveUseCase = new ArchiveTaskUseCase(uow);
      const res = await archiveUseCase.execute(aliceActor, { taskId });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1, "Must produce only TASK_ARCHIVED");
      const log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_ARCHIVED");
      assert.deepEqual(log.previousState, { status: "NOVÉ" });
      assert.deepEqual(log.newState, { status: "ARCHIVOVÁNO" });
    });

    test("TASK_DELETED: hard-delete records snapshot of deleted task", async () => {
      const deleteUseCase = new DeleteTaskUseCase(uow);
      const res = await deleteUseCase.execute(aliceActor, { taskId, confirmation: "SMAZAT" });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_DELETED");
      assert.equal(log.targetId, taskId);
      assert.deepEqual(log.previousState, {
        title: "Původní úkol",
        status: "NOVÉ",
        priority: "BĚŽNÁ",
      });
      assert.equal(log.newState, null);
    });
  });

  describe("5. Comments Domain (3 Events) and Privacy Policy", () => {
    let boardId: string;
    let taskId: string;
    let commentId: string;

    beforeEach(async () => {
      const bRes = await new CreateBoardUseCase(uow).execute(aliceActor, { name: "Board" });
      assertSuccess(bRes);
      boardId = bRes.data.board.id;
      const tRes = await new CreateTaskUseCase(uow).execute(aliceActor, { boardId, title: "Task" });
      assertSuccess(tRes);
      taskId = tRes.data.id;
      auditRepo.store = [];
    });

    test("TASK_COMMENT_CREATED: content text is strictly excluded from audit log", async () => {
      const addUseCase = new AddTaskCommentUseCase(uow);
      const res = await addUseCase.execute(aliceActor, {
        boardId,
        taskId,
        content: "Důvěrný text komentáře, který nesmí být v auditu",
      });

      assertSuccess(res);
      commentId = res.data.id;
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_COMMENT_CREATED");
      assert.equal(log.targetId, commentId);
      assert.deepEqual(log.newState, { taskId });

      const serialized = JSON.stringify(log);
      assert.equal(serialized.includes("Důvěrný text komentáře"), false);
    });

    test("TASK_COMMENT_EDITED: content text is excluded and no-op is respected", async () => {
      const addRes = await new AddTaskCommentUseCase(uow).execute(aliceActor, {
        boardId,
        taskId,
        content: "Původní komentář",
      });
      assertSuccess(addRes);
      commentId = addRes.data.id;
      auditRepo.store = [];

      const editUseCase = new UpdateTaskCommentUseCase(uow);
      const res = await editUseCase.execute(aliceActor, {
        boardId,
        taskId,
        commentId,
        content: "Změněný text komentáře",
      });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_COMMENT_EDITED");
      assert.deepEqual(log.previousState, { taskId });
      assert.deepEqual(log.newState, { taskId });

      const serialized = JSON.stringify(log);
      assert.equal(serialized.includes("Změněný text"), false);
      assert.equal(serialized.includes("Původní komentář"), false);

      // No-op
      auditRepo.store = [];
      const noOp = await editUseCase.execute(aliceActor, {
        boardId,
        taskId,
        commentId,
        content: "Změněný text komentáře",
      });
      assert.equal(noOp.success, true);
      assert.equal(auditRepo.store.length, 0, "No audit on same comment content");
    });

    test("TASK_COMMENT_DELETED: deletion does not expose text", async () => {
      const addRes = await new AddTaskCommentUseCase(uow).execute(aliceActor, {
        boardId,
        taskId,
        content: "Smazaný komentář",
      });
      assertSuccess(addRes);
      commentId = addRes.data.id;
      auditRepo.store = [];

      const deleteUseCase = new DeleteTaskCommentUseCase(uow);
      const res = await deleteUseCase.execute(aliceActor, {
        boardId,
        taskId,
        commentId,
      });

      assert.equal(res.success, true);
      assert.equal(auditRepo.store.length, 1);
      const log = auditRepo.store[0];
      assert.equal(log.operation, "TASK_COMMENT_DELETED");
      assert.equal(log.targetId, commentId);
      assert.deepEqual(log.previousState, { taskId });
      assert.equal(log.newState, null);
    });
  });

  describe("6. Transactional Integrity & Rollback on Audit Failure", () => {
    test("Failing audit log rolls back domain mutations in Unit of Work", async () => {
      auditRepo.shouldFailOnLog = true;

      const useCase = new CreateBoardUseCase(uow);
      await assert.rejects(
        async () => {
          await useCase.execute(aliceActor, { name: "Should Roll Back" });
        },
        /Simulated AuditLog database failure/,
      );

      // Verify domain state: board and membership were NOT committed
      assert.equal(boardsRepo.store.size, 0, "Board creation must be rolled back on audit failure");
      assert.equal(membershipsRepo.store.size, 0, "Membership must be rolled back on audit failure");
      assert.equal(auditRepo.store.length, 0, "No audit log should remain in store");
    });
  });

  describe("7. Non-Audited Operations (Private Notes & Read Operations)", () => {
    let boardId: string;
    let taskId: string;

    beforeEach(async () => {
      const bRes = await new CreateBoardUseCase(uow).execute(aliceActor, { name: "Board" });
      assertSuccess(bRes);
      boardId = bRes.data.board.id;
      const tRes = await new CreateTaskUseCase(uow).execute(aliceActor, { boardId, title: "Task" });
      assertSuccess(tRes);
      taskId = tRes.data.id;
      auditRepo.store = [];
    });

    test("Private Notes: Upsert, Read, Delete do NOT produce any audit logs (STRICT)", async () => {
      // 1. Upsert private note
      const upsertUseCase = new UpsertUserTaskNoteUseCase(uow);
      const upRes = await upsertUseCase.execute(aliceActor, {
        boardId,
        taskId,
        content: "Přísně tajná soukromá poznámka",
      });
      assert.equal(upRes.success, true);
      assert.equal(auditRepo.store.length, 0, "Private note creation must NEVER produce an audit log");

      // 2. Read private note
      const getUseCase = new GetUserTaskNoteUseCase(
        boardsRepo,
        membershipsRepo,
        tasksRepo,
        notesRepo,
        participantsRepo,
      );
      const getRes = await getUseCase.execute(aliceActor, { boardId, taskId });
      assert.equal(getRes.success, true);
      assert.equal(auditRepo.store.length, 0, "Reading a private note must NEVER produce an audit log");

      // 3. Delete private note
      const delUseCase = new DeleteUserTaskNoteUseCase(uow);
      const delRes = await delUseCase.execute(aliceActor, { boardId, taskId });
      assert.equal(delRes.success, true);
      assert.equal(auditRepo.store.length, 0, "Deleting a private note must NEVER produce an audit log");
    });
  });
});
