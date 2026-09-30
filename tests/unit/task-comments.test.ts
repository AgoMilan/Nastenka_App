import assert from "node:assert/strict";
import { describe, test, beforeEach } from "node:test";
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
} from "../../modules/areas/application/ports/area-repository.port.ts";
import type {
  CreateTaskCommentData,
  TaskCommentRecord,
  TaskCommentRepository,
  TaskParticipantRecord,
  TaskParticipantRepository,
  TaskPriority,
  TaskRecord,
  TaskRepository,
  TaskStatus,
  UpdateTaskCommentData,
  UserTaskOrderRepository,
} from "../../modules/tasks/application/ports/index.ts";
import {
  GetTaskCommentsUseCase,
  AddTaskCommentUseCase,
  UpdateTaskCommentUseCase,
  DeleteTaskCommentUseCase,
  GetBoardTasksUseCase,
} from "../../modules/tasks/application/use-cases/index.ts";
import {
  createTaskCommentSchema,
  updateTaskCommentSchema,
  deleteTaskCommentSchema,
  getTaskCommentsSchema,
} from "../../modules/tasks/api/dto/task-comment.dto.ts";
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

  async findByAreaId(): Promise<TaskRecord[]> {
    return [];
  }

  async findByAssigneeId(): Promise<TaskRecord[]> {
    return [];
  }

  async findUserTasksAcrossBoards(): Promise<TaskRecord[]> {
    return [];
  }

  async create(): Promise<TaskRecord> {
    throw new Error("Not implemented");
  }

  async update(): Promise<TaskRecord> {
    throw new Error("Not implemented");
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async countByBoardId(): Promise<number> {
    return 0;
  }

  async countByAreaId(): Promise<number> {
    return 0;
  }
}

class InMemoryTaskParticipantRepository implements TaskParticipantRepository {
  public store: TaskParticipantRecord[] = [];

  async findByTaskId(taskId: string): Promise<TaskParticipantRecord[]> {
    return this.store.filter((p) => p.taskId === taskId);
  }

  async findByTaskIds(taskIds: string[]): Promise<TaskParticipantRecord[]> {
    return this.store.filter((p) => taskIds.includes(p.taskId));
  }

  async findByTaskAndUser(
    taskId: string,
    userId: string,
  ): Promise<TaskParticipantRecord | null> {
    const p = this.store.find(
      (item) => item.taskId === taskId && item.userId === userId,
    );
    return p ? { ...p } : null;
  }

  async addParticipant(): Promise<TaskParticipantRecord> {
    throw new Error("Not implemented");
  }

  async removeParticipant(): Promise<void> {}

  async removeAllForTask(): Promise<void> {}
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
    return Array.from(this.store.values()).filter((a) => a.boardId === boardId);
  }

  async create(): Promise<AreaRecord> {
    throw new Error("Not implemented");
  }

  async update(): Promise<AreaRecord> {
    throw new Error("Not implemented");
  }

  async delete(): Promise<void> {}
}

class InMemoryTaskCommentRepository implements TaskCommentRepository {
  public store = new Map<string, TaskCommentRecord>();
  private nextId = 1;

  async findById(id: string): Promise<TaskCommentRecord | null> {
    const c = this.store.get(id);
    return c ? { ...c } : null;
  }

  async findByTaskId(taskId: string): Promise<TaskCommentRecord[]> {
    return Array.from(this.store.values())
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => {
        const timeDiff = a.createdAt.getTime() - b.createdAt.getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id);
      });
  }

  async countByTaskId(taskId: string): Promise<number> {
    return Array.from(this.store.values()).filter((c) => c.taskId === taskId)
      .length;
  }

  async countByTaskIds(taskIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const c of this.store.values()) {
      if (taskIds.includes(c.taskId)) {
        map.set(c.taskId, (map.get(c.taskId) ?? 0) + 1);
      }
    }
    return map;
  }

  async create(data: CreateTaskCommentData): Promise<TaskCommentRecord> {
    const id = `comment-${this.nextId++}`;
    const now = new Date();
    const comment: TaskCommentRecord = {
      id,
      taskId: data.taskId,
      authorId: data.authorId,
      content: data.content,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(id, comment);
    return { ...comment };
  }

  async update(
    id: string,
    data: UpdateTaskCommentData,
  ): Promise<TaskCommentRecord> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`Comment not found: ${id}`);
    }
    const updated: TaskCommentRecord = {
      ...existing,
      content: data.content,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return { ...updated };
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async deleteAllForTask(taskId: string): Promise<void> {
    for (const [id, c] of this.store.entries()) {
      if (c.taskId === taskId) {
        this.store.delete(id);
      }
    }
  }
}

class InMemoryUnitOfWork implements UnitOfWork {
  private readonly boardRepo: BoardRepository;
  private readonly membershipRepo: MembershipRepository;
  private readonly userRepo: UserRepository;
  private readonly taskRepo: TaskRepository;
  private readonly taskParticipantRepo: TaskParticipantRepository;
  private readonly taskCommentRepo: TaskCommentRepository;

  constructor(
    boardRepo: BoardRepository,
    membershipRepo: MembershipRepository,
    userRepo: UserRepository,
    taskRepo: TaskRepository,
    taskParticipantRepo: TaskParticipantRepository,
    taskCommentRepo: TaskCommentRepository,
  ) {
    this.boardRepo = boardRepo;
    this.membershipRepo = membershipRepo;
    this.userRepo = userRepo;
    this.taskRepo = taskRepo;
    this.taskParticipantRepo = taskParticipantRepo;
    this.taskCommentRepo = taskCommentRepo;
  }

  async runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return await work({
      boards: this.boardRepo,
      memberships: this.membershipRepo,
      users: this.userRepo,
      tasks: this.taskRepo,
      taskParticipants: this.taskParticipantRepo,
      taskComments: this.taskCommentRepo,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────

describe("STEP 8 – Komentáře a diskuze k úkolům", () => {
  // Sdílené proměnné pro testy
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let taskRepo: InMemoryTaskRepository;
  let taskParticipantRepo: InMemoryTaskParticipantRepository;
  let areaRepo: InMemoryAreaRepository;
  let taskCommentRepo: InMemoryTaskCommentRepository;
  let uow: InMemoryUnitOfWork;

  const boardId = "board-1";
  const otherBoardId = "board-2";
  const taskId = "task-1";
  const archivedTaskId = "task-archived";

  const ownerUser: ActorContext = {
    actor_user_id: "user-owner",
    session_id: "session-owner",
    global_role: "USER",
    is_active: true,
  };

  const managerUser: ActorContext = {
    actor_user_id: "user-manager",
    session_id: "session-manager",
    global_role: "USER",
    is_active: true,
  };

  const memberUser: ActorContext = {
    actor_user_id: "user-member",
    session_id: "session-member",
    global_role: "USER",
    is_active: true,
  };

  const otherMemberUser: ActorContext = {
    actor_user_id: "user-other",
    session_id: "session-other",
    global_role: "USER",
    is_active: true,
  };

  const adminUser: ActorContext = {
    actor_user_id: "user-admin",
    session_id: "session-admin",
    global_role: "ADMIN",
    is_active: true,
  };

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    taskRepo = new InMemoryTaskRepository();
    taskParticipantRepo = new InMemoryTaskParticipantRepository();
    areaRepo = new InMemoryAreaRepository();
    taskCommentRepo = new InMemoryTaskCommentRepository();
    uow = new InMemoryUnitOfWork(
      boardRepo,
      membershipRepo,
      userRepo,
      taskRepo,
      taskParticipantRepo,
      taskCommentRepo,
    );

    // Příprava nástěnky
    boardRepo.store.set(boardId, {
      id: boardId,
      name: "Projektová nástěnka",
      description: null,
      createdBy: ownerUser.actor_user_id,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    boardRepo.store.set(otherBoardId, {
      id: otherBoardId,
      name: "Jiná nástěnka",
      description: null,
      createdBy: ownerUser.actor_user_id,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    // Členství
    await membershipRepo.create({
      boardId,
      userId: ownerUser.actor_user_id,
      role: "OWNER",
    });
    await membershipRepo.create({
      boardId,
      userId: managerUser.actor_user_id,
      role: "MANAGER",
    });
    await membershipRepo.create({
      boardId,
      userId: memberUser.actor_user_id,
      role: "MEMBER",
    });
    await membershipRepo.create({
      boardId,
      userId: otherMemberUser.actor_user_id,
      role: "MEMBER",
    });

    // Uživatelé
    userRepo.store.set(ownerUser.actor_user_id, {
      id: ownerUser.actor_user_id,
      name: "Vlastník Petr",
      email: "owner@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set(managerUser.actor_user_id, {
      id: managerUser.actor_user_id,
      name: "Správce Karel",
      email: "manager@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set(memberUser.actor_user_id, {
      id: memberUser.actor_user_id,
      name: "Člen Jan",
      email: "member@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set(otherMemberUser.actor_user_id, {
      id: otherMemberUser.actor_user_id,
      name: "Členka Eva",
      email: "other@test.cz",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set(adminUser.actor_user_id, {
      id: adminUser.actor_user_id,
      name: "Admin Pavel",
      email: "admin@test.cz",
      globalRole: "ADMIN",
      isActive: true,
      deletedAt: null,
    });

    // Úkoly
    taskRepo.store.set(taskId, {
      id: taskId,
      boardId,
      areaId: null,
      title: "Běžný aktivní úkol",
      description: "Popis úkolu",
      status: "ROZPRACOVANÉ",
      priority: "BĚŽNÁ",
      dueDate: null,
      createdBy: ownerUser.actor_user_id,
      assigneeId: memberUser.actor_user_id,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    });

    taskRepo.store.set(archivedTaskId, {
      id: archivedTaskId,
      boardId,
      areaId: null,
      title: "Archivovaný úkol",
      description: "Archivovaný",
      status: "ARCHIVOVÁNO",
      priority: "BĚŽNÁ",
      dueDate: null,
      createdBy: ownerUser.actor_user_id,
      assigneeId: memberUser.actor_user_id,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
    });
  });

  // ───────────────────────────────────────────────────────────
  // 1. Policy Engine – Autorizační pravidla pro komentáře
  // ───────────────────────────────────────────────────────────

  describe("1. Policy Engine (checkTaskPermission)", () => {
    const activeTarget: TaskAuthorizationTarget = {
      boardId: "board-1",
      taskId: "task-1",
      createdBy: "user-owner",
      assigneeId: "user-member",
      status: "ROZPRACOVANÉ",
    };

    const archivedTarget: TaskAuthorizationTarget = {
      boardId: "board-1",
      taskId: "task-archived",
      createdBy: "user-owner",
      assigneeId: "user-member",
      status: "ARCHIVOVÁNO",
    };

    const emptyRel: ActorTaskRelationship = {
      isAssignee: false,
      isParticipant: false,
    };

    test("TASK_COMMENT_VIEW je povoleno všem členům i u archivovaných úkolů", () => {
      // Aktivní úkol
      assert.equal(
        checkTaskPermission(
          memberUser,
          boardId,
          { role: "MEMBER" },
          activeTarget,
          emptyRel,
          "TASK_COMMENT_VIEW",
        ).allowed,
        true,
      );

      // Archivovaný úkol – čtení je povolené!
      assert.equal(
        checkTaskPermission(
          memberUser,
          boardId,
          { role: "MEMBER" },
          archivedTarget,
          emptyRel,
          "TASK_COMMENT_VIEW",
        ).allowed,
        true,
      );

      // ADMIN má taktéž přístup
      assert.equal(
        checkTaskPermission(
          adminUser,
          boardId,
          null,
          archivedTarget,
          emptyRel,
          "TASK_COMMENT_VIEW",
        ).allowed,
        true,
      );
    });

    test("TASK_COMMENT_VIEW odmítá neautentizovaného, nečlena a cross-board", () => {
      // Neautentizovaný
      const unauth = checkTaskPermission(
        null,
        boardId,
        null,
        activeTarget,
        emptyRel,
        "TASK_COMMENT_VIEW",
      );
      assert.equal(unauth.allowed, false);
      assert.equal((unauth as any).reason, "UNAUTHENTICATED");

      // Nečlen
      const nonMember = checkTaskPermission(
        memberUser,
        boardId,
        null,
        activeTarget,
        emptyRel,
        "TASK_COMMENT_VIEW",
      );
      assert.equal(nonMember.allowed, false);
      assert.equal((nonMember as any).reason, "NOT_A_MEMBER");

      // Cross-board
      const crossBoard = checkTaskPermission(
        memberUser,
        otherBoardId,
        { role: "MEMBER" },
        activeTarget,
        emptyRel,
        "TASK_COMMENT_VIEW",
      );
      assert.equal(crossBoard.allowed, false);
      assert.equal((crossBoard as any).reason, "CROSS_BOARD_ACCESS");
    });

    test("TASK_COMMENT_CREATE je povoleno všem členům u aktivních úkolů", () => {
      for (const [role, user] of [
        ["MEMBER", memberUser],
        ["MANAGER", managerUser],
        ["OWNER", ownerUser],
      ] as const) {
        const res = checkTaskPermission(
          user,
          boardId,
          { role },
          activeTarget,
          emptyRel,
          "TASK_COMMENT_CREATE",
        );
        assert.equal(res.allowed, true, `Role ${role} by měla mít povoleno přidat komentář`);
      }
    });

    test("TASK_COMMENT_CREATE je STRIKTNĚ ZAKÁZÁNO u archivovaného úkolu i pro ADMINa", () => {
      // Běžný člen
      const memberRes = checkTaskPermission(
        memberUser,
        boardId,
        { role: "MEMBER" },
        archivedTarget,
        emptyRel,
        "TASK_COMMENT_CREATE",
      );
      assert.equal(memberRes.allowed, false);
      assert.equal((memberRes as any).reason, "TASK_ARCHIVED");

      // OWNER
      const ownerRes = checkTaskPermission(
        ownerUser,
        boardId,
        { role: "OWNER" },
        archivedTarget,
        emptyRel,
        "TASK_COMMENT_CREATE",
      );
      assert.equal(ownerRes.allowed, false);
      assert.equal((ownerRes as any).reason, "TASK_ARCHIVED");

      // Globální ADMIN – ani ten nesmí přidat komentář k archivovanému úkolu!
      const adminRes = checkTaskPermission(
        adminUser,
        boardId,
        null,
        archivedTarget,
        emptyRel,
        "TASK_COMMENT_CREATE",
      );
      assert.equal(adminRes.allowed, false);
      assert.equal((adminRes as any).reason, "TASK_ARCHIVED");
    });

    test("TASK_COMMENT_EDIT_OWN umožňuje editovat VÝHRADNĚ autorovi komentáře", () => {
      const targetWithAuthor: TaskAuthorizationTarget = {
        ...activeTarget,
        commentAuthorId: memberUser.actor_user_id,
      };

      // Vlastní autor smí upravit
      const authorRes = checkTaskPermission(
        memberUser,
        boardId,
        { role: "MEMBER" },
        targetWithAuthor,
        emptyRel,
        "TASK_COMMENT_EDIT_OWN",
      );
      assert.equal(authorRes.allowed, true);

      // Jiný člen NESMÍ upravit
      const otherRes = checkTaskPermission(
        otherMemberUser,
        boardId,
        { role: "MEMBER" },
        targetWithAuthor,
        emptyRel,
        "TASK_COMMENT_EDIT_OWN",
      );
      assert.equal(otherRes.allowed, false);
      assert.equal((otherRes as any).reason, "NOT_COMMENT_AUTHOR");

      // Board MANAGER NESMÍ upravit cizí komentář (nemá moderátorská práva na obsah)
      const managerRes = checkTaskPermission(
        managerUser,
        boardId,
        { role: "MANAGER" },
        targetWithAuthor,
        emptyRel,
        "TASK_COMMENT_EDIT_OWN",
      );
      assert.equal(managerRes.allowed, false);
      assert.equal((managerRes as any).reason, "NOT_COMMENT_AUTHOR");

      // Board OWNER NESMÍ upravit cizí komentář
      const ownerRes = checkTaskPermission(
        ownerUser,
        boardId,
        { role: "OWNER" },
        targetWithAuthor,
        emptyRel,
        "TASK_COMMENT_EDIT_OWN",
      );
      assert.equal(ownerRes.allowed, false);
      assert.equal((ownerRes as any).reason, "NOT_COMMENT_AUTHOR");

      // Globální ADMIN NESMÍ upravit cizí komentář
      const adminRes = checkTaskPermission(
        adminUser,
        boardId,
        null,
        targetWithAuthor,
        emptyRel,
        "TASK_COMMENT_EDIT_OWN",
      );
      assert.equal(adminRes.allowed, false);
      assert.equal((adminRes as any).reason, "NOT_COMMENT_AUTHOR");
    });

    test("TASK_COMMENT_EDIT_OWN je zakázáno u archivovaného úkolu i pro autora", () => {
      const archivedWithAuthor: TaskAuthorizationTarget = {
        ...archivedTarget,
        commentAuthorId: memberUser.actor_user_id,
      };

      const res = checkTaskPermission(
        memberUser,
        boardId,
        { role: "MEMBER" },
        archivedWithAuthor,
        emptyRel,
        "TASK_COMMENT_EDIT_OWN",
      );
      assert.equal(res.allowed, false);
      assert.equal((res as any).reason, "TASK_ARCHIVED");
    });

    test("TASK_COMMENT_DELETE_OWN umožňuje smazat VÝHRADNĚ autorovi komentáře", () => {
      const targetWithAuthor: TaskAuthorizationTarget = {
        ...activeTarget,
        commentAuthorId: memberUser.actor_user_id,
      };

      // Vlastní autor smí smazat
      const authorRes = checkTaskPermission(
        memberUser,
        boardId,
        { role: "MEMBER" },
        targetWithAuthor,
        emptyRel,
        "TASK_COMMENT_DELETE_OWN",
      );
      assert.equal(authorRes.allowed, true);

      // Jiný člen NESMÍ smazat
      const otherRes = checkTaskPermission(
        otherMemberUser,
        boardId,
        { role: "MEMBER" },
        targetWithAuthor,
        emptyRel,
        "TASK_COMMENT_DELETE_OWN",
      );
      assert.equal(otherRes.allowed, false);
      assert.equal((otherRes as any).reason, "NOT_COMMENT_AUTHOR");

      // Board MANAGER NESMÍ smazat cizí komentář
      const managerRes = checkTaskPermission(
        managerUser,
        boardId,
        { role: "MANAGER" },
        targetWithAuthor,
        emptyRel,
        "TASK_COMMENT_DELETE_OWN",
      );
      assert.equal(managerRes.allowed, false);
      assert.equal((managerRes as any).reason, "NOT_COMMENT_AUTHOR");

      // Board OWNER NESMÍ smazat cizí komentář
      const ownerRes = checkTaskPermission(
        ownerUser,
        boardId,
        { role: "OWNER" },
        targetWithAuthor,
        emptyRel,
        "TASK_COMMENT_DELETE_OWN",
      );
      assert.equal(ownerRes.allowed, false);
      assert.equal((ownerRes as any).reason, "NOT_COMMENT_AUTHOR");

      // Globální ADMIN NESMÍ smazat cizí komentář
      const adminRes = checkTaskPermission(
        adminUser,
        boardId,
        null,
        targetWithAuthor,
        emptyRel,
        "TASK_COMMENT_DELETE_OWN",
      );
      assert.equal(adminRes.allowed, false);
      assert.equal((adminRes as any).reason, "NOT_COMMENT_AUTHOR");
    });

    test("TASK_COMMENT_DELETE_OWN je zakázáno u archivovaného úkolu i pro autora", () => {
      const archivedWithAuthor: TaskAuthorizationTarget = {
        ...archivedTarget,
        commentAuthorId: memberUser.actor_user_id,
      };

      const res = checkTaskPermission(
        memberUser,
        boardId,
        { role: "MEMBER" },
        archivedWithAuthor,
        emptyRel,
        "TASK_COMMENT_DELETE_OWN",
      );
      assert.equal(res.allowed, false);
      assert.equal((res as any).reason, "TASK_ARCHIVED");
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. DTO Schémata – Validační pravidla
  // ───────────────────────────────────────────────────────────

  describe("2. DTO Schémata", () => {
    test("createTaskCommentSchema validuje správná i neplatná data", () => {
      // Platný vstup
      const valid = createTaskCommentSchema.safeParse({
        boardId: "board-1",
        taskId: "task-1",
        content: "  Tento komentář má mezery na okrajích  ",
      });
      assert.equal(valid.success, true);
      if (valid.success) {
        assert.equal(valid.data.content, "Tento komentář má mezery na okrajích");
      }

      // Prázdný komentář
      const empty = createTaskCommentSchema.safeParse({
        boardId: "board-1",
        taskId: "task-1",
        content: "   ",
      });
      assert.equal(empty.success, false);

      // Příliš dlouhý komentář (> 5000 znaků)
      const tooLong = createTaskCommentSchema.safeParse({
        boardId: "board-1",
        taskId: "task-1",
        content: "a".repeat(5001),
      });
      assert.equal(tooLong.success, false);
    });

    test("updateTaskCommentSchema validuje commentId, taskId, boardId a content", () => {
      const valid = updateTaskCommentSchema.safeParse({
        boardId: "board-1",
        taskId: "task-1",
        commentId: "c-1",
        content: "Upravený text",
      });
      assert.equal(valid.success, true);

      const missingCommentId = updateTaskCommentSchema.safeParse({
        boardId: "board-1",
        taskId: "task-1",
        commentId: "   ",
        content: "Upravený text",
      });
      assert.equal(missingCommentId.success, false);
    });

    test("deleteTaskCommentSchema validuje povinné identifikátory", () => {
      const valid = deleteTaskCommentSchema.safeParse({
        boardId: "board-1",
        taskId: "task-1",
        commentId: "c-1",
      });
      assert.equal(valid.success, true);

      const invalid = deleteTaskCommentSchema.safeParse({
        boardId: "",
        taskId: "task-1",
        commentId: "c-1",
      });
      assert.equal(invalid.success, false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. AddTaskCommentUseCase
  // ───────────────────────────────────────────────────────────

  describe("3. AddTaskCommentUseCase", () => {
    let useCase: AddTaskCommentUseCase;

    beforeEach(() => {
      useCase = new AddTaskCommentUseCase(uow);
    });

    test("úspěšně přidá komentář a authorId převezme z ActorContext", async () => {
      const res = await useCase.execute(memberUser, {
        boardId,
        taskId,
        content: "Ahoj, pracuji na tomto úkolu.",
      });

      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.taskId, taskId);
        assert.equal(res.data.authorId, memberUser.actor_user_id);
        assert.equal(res.data.content, "Ahoj, pracuji na tomto úkolu.");
      }

      // Ověření v repozitáři
      const comments = await taskCommentRepo.findByTaskId(taskId);
      assert.equal(comments.length, 1);
      assert.equal(comments[0].authorId, memberUser.actor_user_id);
    });

    test("odmítne přidání komentáře k archivovanému úkolu", async () => {
      const res = await useCase.execute(memberUser, {
        boardId,
        taskId: archivedTaskId,
        content: "Nelze přidat.",
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal((res.error as any).reason, "TASK_ARCHIVED");
      }
    });

    test("odmítne neautentizovaného uživatele", async () => {
      const res = await useCase.execute(null, {
        boardId,
        taskId,
        content: "Test",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthenticationError);
      }
    });

    test("odmítne cross-board přístup (úkol patří do jiné nástěnky)", async () => {
      const res = await useCase.execute(memberUser, {
        boardId: otherBoardId,
        taskId, // taskId patří do boardId, nikoliv otherBoardId
        content: "Cross-board pokus",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal((res.error as any).reason, "CROSS_BOARD_ACCESS");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. GetTaskCommentsUseCase
  // ───────────────────────────────────────────────────────────

  describe("4. GetTaskCommentsUseCase", () => {
    let useCase: GetTaskCommentsUseCase;

    beforeEach(() => {
      useCase = new GetTaskCommentsUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        taskCommentRepo,
        userRepo,
        taskParticipantRepo,
      );
    });

    test("vrátí komentáře seřazené chronologicky s obohacenými informacemi o autorovi", async () => {
      // Vytvoříme 2 komentáře s časovým posunem
      const c1 = await taskCommentRepo.create({
        taskId,
        authorId: memberUser.actor_user_id,
        content: "První komentář",
      });
      // Simulace posunu času
      const c2 = await taskCommentRepo.create({
        taskId,
        authorId: ownerUser.actor_user_id,
        content: "Druhý komentář",
      });

      const res = await useCase.execute(memberUser, { boardId, taskId });
      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.length, 2);
        assert.equal(res.data[0].id, c1.id);
        assert.equal(res.data[0].content, "První komentář");
        assert.equal(res.data[0].author.name, "Člen Jan");
        assert.equal(res.data[0].isOwn, true);
        assert.equal(res.data[0].canEdit, true);
        assert.equal(res.data[0].canDelete, true);

        assert.equal(res.data[1].id, c2.id);
        assert.equal(res.data[1].content, "Druhý komentář");
        assert.equal(res.data[1].author.name, "Vlastník Petr");
        assert.equal(res.data[1].isOwn, false);
        assert.equal(res.data[1].canEdit, false);
        assert.equal(res.data[1].canDelete, false);
      }
    });

    test("u archivovaného úkolu komentáře vrátí, ale canEdit a canDelete jsou false", async () => {
      await taskCommentRepo.create({
        taskId: archivedTaskId,
        authorId: memberUser.actor_user_id,
        content: "Starý komentář z archivu",
      });

      const res = await useCase.execute(memberUser, {
        boardId,
        taskId: archivedTaskId,
      });

      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.length, 1);
        assert.equal(res.data[0].isOwn, true);
        assert.equal(res.data[0].canEdit, false);
        assert.equal(res.data[0].canDelete, false);
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 5. UpdateTaskCommentUseCase
  // ───────────────────────────────────────────────────────────

  describe("5. UpdateTaskCommentUseCase", () => {
    let useCase: UpdateTaskCommentUseCase;
    let commentId: string;

    beforeEach(async () => {
      useCase = new UpdateTaskCommentUseCase(uow);
      const c = await taskCommentRepo.create({
        taskId,
        authorId: memberUser.actor_user_id,
        content: "Původní komentář",
      });
      commentId = c.id;
    });

    test("autor úspěšně upraví svůj komentář", async () => {
      const res = await useCase.execute(memberUser, {
        boardId,
        taskId,
        commentId,
        content: "Upravený text komentáře",
      });

      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.content, "Upravený text komentáře");
      }

      const inRepo = await taskCommentRepo.findById(commentId);
      assert.equal(inRepo?.content, "Upravený text komentáře");
    });

    test("jiný člen NEMŮŽE upravit cizí komentář", async () => {
      const res = await useCase.execute(otherMemberUser, {
        boardId,
        taskId,
        commentId,
        content: "Pokus o změnu cizího komentáře",
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal((res.error as any).reason, "NOT_COMMENT_AUTHOR");
      }
    });

    test("ani OWNER ani ADMIN nemohou upravit cizí komentář", async () => {
      // OWNER pokus
      const ownerRes = await useCase.execute(ownerUser, {
        boardId,
        taskId,
        commentId,
        content: "Owner se snaží upravit",
      });
      assert.equal(ownerRes.success, false);
      assert.equal((ownerRes.error as any).reason, "NOT_COMMENT_AUTHOR");

      // ADMIN pokus
      const adminRes = await useCase.execute(adminUser, {
        boardId,
        taskId,
        commentId,
        content: "Admin se snaží upravit",
      });
      assert.equal(adminRes.success, false);
      assert.equal((adminRes.error as any).reason, "NOT_COMMENT_AUTHOR");
    });

    test("nelze upravit komentář u archivovaného úkolu", async () => {
      const archivedComment = await taskCommentRepo.create({
        taskId: archivedTaskId,
        authorId: memberUser.actor_user_id,
        content: "Archivovaný text",
      });

      const res = await useCase.execute(memberUser, {
        boardId,
        taskId: archivedTaskId,
        commentId: archivedComment.id,
        content: "Nový text",
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal((res.error as any).reason, "TASK_ARCHIVED");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 6. DeleteTaskCommentUseCase
  // ───────────────────────────────────────────────────────────

  describe("6. DeleteTaskCommentUseCase", () => {
    let useCase: DeleteTaskCommentUseCase;
    let commentId: string;

    beforeEach(async () => {
      useCase = new DeleteTaskCommentUseCase(uow);
      const c = await taskCommentRepo.create({
        taskId,
        authorId: memberUser.actor_user_id,
        content: "Komentář ke smazání",
      });
      commentId = c.id;
    });

    test("autor úspěšně smaže svůj komentář", async () => {
      const res = await useCase.execute(memberUser, {
        boardId,
        taskId,
        commentId,
      });

      assert.equal(res.success, true);
      const inRepo = await taskCommentRepo.findById(commentId);
      assert.equal(inRepo, null);
    });

    test("jiný člen NEMŮŽE smazat cizí komentář", async () => {
      const res = await useCase.execute(otherMemberUser, {
        boardId,
        taskId,
        commentId,
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal((res.error as any).reason, "NOT_COMMENT_AUTHOR");
      }
    });

    test("ani OWNER ani ADMIN nemohou smazat cizí komentář", async () => {
      const ownerRes = await useCase.execute(ownerUser, {
        boardId,
        taskId,
        commentId,
      });
      assert.equal(ownerRes.success, false);
      assert.equal((ownerRes.error as any).reason, "NOT_COMMENT_AUTHOR");

      const adminRes = await useCase.execute(adminUser, {
        boardId,
        taskId,
        commentId,
      });
      assert.equal(adminRes.success, false);
      assert.equal((adminRes.error as any).reason, "NOT_COMMENT_AUTHOR");
    });

    test("nelze smazat komentář u archivovaného úkolu", async () => {
      const archivedComment = await taskCommentRepo.create({
        taskId: archivedTaskId,
        authorId: memberUser.actor_user_id,
        content: "Archivovaný komentář",
      });

      const res = await useCase.execute(memberUser, {
        boardId,
        taskId: archivedTaskId,
        commentId: archivedComment.id,
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal((res.error as any).reason, "TASK_ARCHIVED");
      }
    });
  });

  // ───────────────────────────────────────────────────────────
  // 7. Integrace do zobrazení úkolů nástěnky (commentsCount)
  // ───────────────────────────────────────────────────────────

  describe("7. GetBoardTasksUseCase s počtem komentářů", () => {
    test("úkoly mají správně vyplněné commentsCount", async () => {
      await taskCommentRepo.create({
        taskId,
        authorId: memberUser.actor_user_id,
        content: "Komentář 1",
      });
      await taskCommentRepo.create({
        taskId,
        authorId: ownerUser.actor_user_id,
        content: "Komentář 2",
      });

      const getTasksUseCase = new GetBoardTasksUseCase(
        boardRepo,
        membershipRepo,
        taskRepo,
        taskParticipantRepo,
        areaRepo,
        userRepo,
        undefined,
        taskCommentRepo,
      );

      const res = await getTasksUseCase.execute(memberUser, boardId);
      assert.equal(res.success, true);
      if (res.success) {
        const found = res.data.find((t) => t.id === taskId);
        assert.ok(found);
        assert.equal(found.commentsCount, 2);
      }
    });
  });
});
