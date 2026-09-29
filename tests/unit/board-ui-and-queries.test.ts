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
  UnitOfWork,
  UnitOfWorkRepositories,
  UserBoardRecord,
  UserRecord,
  UserRepository,
} from "../../modules/boards/application/ports/index.ts";
import {
  CreateBoardUseCase,
  GetBoardDetailUseCase,
  GetUserBoardsUseCase,
} from "../../modules/boards/application/use-cases/index.ts";
import { createBoardSchema } from "../../modules/boards/api/dto/board.dto.ts";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// Testovací In-Memory Implementace Repozitářů
// ─────────────────────────────────────────────────────────────

class InMemoryBoardRepository implements BoardRepository {
  public store = new Map<string, BoardRecord>();
  public membershipsRef: InMemoryMembershipRepository | null = null;

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
    if (!this.membershipsRef) return [];
    const results: UserBoardRecord[] = [];

    for (const board of this.store.values()) {
      if (board.deletedAt !== null) continue; // Pouze aktivní
      const membership = await this.membershipsRef.findByBoardAndUser(
        board.id,
        userId,
      );
      if (membership) {
        results.push({
          id: board.id,
          name: board.name,
          description: board.description,
          role: membership.role,
          createdAt: board.createdAt,
          updatedAt: board.updatedAt,
        });
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  async findActiveBoardsForAdmin(adminUserId: string): Promise<UserBoardRecord[]> {
    const results: UserBoardRecord[] = [];

    for (const board of this.store.values()) {
      if (board.deletedAt !== null) continue; // Pouze aktivní
      let role = null;
      if (this.membershipsRef) {
        const membership = await this.membershipsRef.findByBoardAndUser(
          board.id,
          adminUserId,
        );
        if (membership) {
          role = membership.role;
        }
      }
      results.push({
        id: board.id,
        name: board.name,
        description: board.description,
        role,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt,
      });
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
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
    const record: MembershipRecord = {
      id: data.id ?? `member-${crypto.randomUUID()}`,
      boardId: data.boardId,
      userId: data.userId,
      role: data.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(record.id, record);
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

class InMemoryUnitOfWork implements UnitOfWork {
  public readonly boards: InMemoryBoardRepository;
  public readonly memberships: InMemoryMembershipRepository;
  public readonly users: InMemoryUserRepository;

  constructor(
    boards: InMemoryBoardRepository,
    memberships: InMemoryMembershipRepository,
    users: InMemoryUserRepository,
  ) {
    this.boards = boards;
    this.memberships = memberships;
    this.users = users;
  }

  async runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return await work({
      boards: this.boards,
      memberships: this.memberships,
      users: this.users,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Testovací Suite pro STEP 4 / STEP 22
// ─────────────────────────────────────────────────────────────

describe("STEP 4 / STEP 22 – Board UI & Server Actions", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let uow: InMemoryUnitOfWork;

  const userActor: ActorContext = {
    actor_user_id: "user-1",
    global_role: "USER",
    session_id: "sess-1",
    is_active: true,
  };

  const otherUserActor: ActorContext = {
    actor_user_id: "user-2",
    global_role: "USER",
    session_id: "sess-2",
    is_active: true,
  };

  const adminActor: ActorContext = {
    actor_user_id: "admin-1",
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

  beforeEach(() => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    boardRepo.membershipsRef = membershipRepo;
    userRepo = new InMemoryUserRepository();
    uow = new InMemoryUnitOfWork(boardRepo, membershipRepo, userRepo);
  });

  // ───────────────────────────────────────────────────────────
  // 1. Query: Seznam nástěnek uživatele (GetUserBoardsUseCase)
  // ───────────────────────────────────────────────────────────
  describe("1. Query (GetUserBoardsUseCase)", () => {
    test("USER vidí pouze Boardy, jejichž je členem", async () => {
      // Board 1: user-1 je OWNER
      const b1 = await boardRepo.create({ name: "Nástěnka A", createdBy: "user-1" });
      await membershipRepo.create({ boardId: b1.id, userId: "user-1", role: "OWNER" });

      // Board 2: user-1 je MEMBER
      const b2 = await boardRepo.create({ name: "Nástěnka B", createdBy: "user-2" });
      await membershipRepo.create({ boardId: b2.id, userId: "user-1", role: "MEMBER" });

      // Board 3: user-2 je OWNER (user-1 není členem)
      const b3 = await boardRepo.create({ name: "Nástěnka C", createdBy: "user-2" });
      await membershipRepo.create({ boardId: b3.id, userId: "user-2", role: "OWNER" });

      const useCase = new GetUserBoardsUseCase(boardRepo);
      const result = await useCase.execute(userActor);

      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.length, 2);
      const ids = result.data.map((b) => b.id);
      assert.ok(ids.includes(b1.id));
      assert.ok(ids.includes(b2.id));
      assert.ok(!ids.includes(b3.id));
    });

    test("USER nevidí Board jiného týmu", async () => {
      const bOther = await boardRepo.create({ name: "Cizí tým", createdBy: "user-2" });
      await membershipRepo.create({ boardId: bOther.id, userId: "user-2", role: "OWNER" });

      const useCase = new GetUserBoardsUseCase(boardRepo);
      const result = await useCase.execute(userActor);

      assert.equal(result.success, true);
      if (!result.success) return;
      assert.equal(result.data.length, 0);
    });

    test("Soft-deleted Board není ve výsledku pro USERa ani pro ADMINa", async () => {
      const bActive = await boardRepo.create({ name: "Aktivní", createdBy: "user-1" });
      await membershipRepo.create({ boardId: bActive.id, userId: "user-1", role: "OWNER" });

      const bDeleted = await boardRepo.create({ name: "Smazaná", createdBy: "user-1" });
      await membershipRepo.create({ boardId: bDeleted.id, userId: "user-1", role: "OWNER" });
      await boardRepo.softDelete(bDeleted.id, new Date());

      const useCase = new GetUserBoardsUseCase(boardRepo);

      // Kontrola pro USER
      const userRes = await useCase.execute(userActor);
      assert.equal(userRes.success, true);
      if (userRes.success) {
        assert.equal(userRes.data.length, 1);
        assert.equal(userRes.data[0].id, bActive.id);
      }

      // Kontrola pro ADMIN
      const adminRes = await useCase.execute(adminActor);
      assert.equal(adminRes.success, true);
      if (adminRes.success) {
        assert.equal(adminRes.data.length, 1);
        assert.equal(adminRes.data[0].id, bActive.id);
      }
    });

    test("Role membership je vrácena správně (OWNER, MANAGER, MEMBER)", async () => {
      const b1 = await boardRepo.create({ name: "Board 1", createdBy: "user-1" });
      await membershipRepo.create({ boardId: b1.id, userId: "user-1", role: "OWNER" });

      const b2 = await boardRepo.create({ name: "Board 2", createdBy: "user-2" });
      await membershipRepo.create({ boardId: b2.id, userId: "user-1", role: "MANAGER" });

      const b3 = await boardRepo.create({ name: "Board 3", createdBy: "user-2" });
      await membershipRepo.create({ boardId: b3.id, userId: "user-1", role: "MEMBER" });

      const useCase = new GetUserBoardsUseCase(boardRepo);
      const result = await useCase.execute(userActor);

      assert.equal(result.success, true);
      if (!result.success) return;

      const map = new Map(result.data.map((b) => [b.id, b.role]));
      assert.equal(map.get(b1.id), "OWNER");
      assert.equal(map.get(b2.id), "MANAGER");
      assert.equal(map.get(b3.id), "MEMBER");
    });

    test("ADMIN chování odpovídá existující autorizační architektuře (vidí všechny aktivní boardy)", async () => {
      const b1 = await boardRepo.create({ name: "Tým 1", createdBy: "user-1" });
      await membershipRepo.create({ boardId: b1.id, userId: "user-1", role: "OWNER" });

      const b2 = await boardRepo.create({ name: "Tým 2", createdBy: "user-2" });
      await membershipRepo.create({ boardId: b2.id, userId: "admin-1", role: "MEMBER" });

      const useCase = new GetUserBoardsUseCase(boardRepo);
      const result = await useCase.execute(adminActor);

      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.length, 2);
      const b1Admin = result.data.find((b) => b.id === b1.id);
      const b2Admin = result.data.find((b) => b.id === b2.id);

      assert.equal(b1Admin?.role, null); // Admin není přímým členem
      assert.equal(b2Admin?.role, "MEMBER"); // Admin je přímým členem s rolí MEMBER
    });

    test("Neautentizovaný nebo neaktivní požadavek je zamítnut", async () => {
      const useCase = new GetUserBoardsUseCase(boardRepo);

      const resNull = await useCase.execute(null);
      assert.equal(resNull.success, false);
      assert.ok(resNull.error instanceof AuthenticationError);

      const resInactive = await useCase.execute(inactiveActor);
      assert.equal(resInactive.success, false);
      assert.ok(resInactive.error instanceof AuthenticationError);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. Create Board (CreateBoardUseCase & Validace)
  // ───────────────────────────────────────────────────────────
  describe("2. Create Board", () => {
    test("autentizovaný USER může vytvořit Board se správným created_by", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const result = await useCase.execute(userActor, {
        name: "Moje nová nástěnka",
        description: "Popis práce",
      });

      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.board.name, "Moje nová nástěnka");
      assert.equal(result.data.board.description, "Popis práce");
      assert.equal(result.data.board.createdBy, userActor.actor_user_id);
    });

    test("creator dostane membership OWNER", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const result = await useCase.execute(userActor, {
        name: "Testovací nástěnka",
      });

      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.ownerMembership.boardId, result.data.board.id);
      assert.equal(result.data.ownerMembership.userId, userActor.actor_user_id);
      assert.equal(result.data.ownerMembership.role, "OWNER");
    });

    test("nelze vytvořit Board bez platného názvu (prázdný, whitespace, >255 znaků)", async () => {
      const useCase = new CreateBoardUseCase(uow);

      // Prázdný
      const res1 = await useCase.execute(userActor, { name: "" });
      assert.equal(res1.success, false);
      assert.ok(res1.error instanceof ValidationError);

      // Pouze mezery
      const res2 = await useCase.execute(userActor, { name: "   " });
      assert.equal(res2.success, false);
      assert.ok(res2.error instanceof ValidationError);

      // Nad limit 255 znaků
      const res3 = await useCase.execute(userActor, { name: "A".repeat(256) });
      assert.equal(res3.success, false);
      assert.ok(res3.error instanceof ValidationError);
    });

    test("Zod validační schéma pro formulář CreateBoard odmítne neplatný vstup", () => {
      // Platný vstup
      const valid = createBoardSchema.safeParse({ name: "Platná nástěnka", description: "Popis" });
      assert.equal(valid.success, true);

      // Prázdný název
      const invalidEmpty = createBoardSchema.safeParse({ name: "" });
      assert.equal(invalidEmpty.success, false);

      // Chybějící název
      const invalidMissing = createBoardSchema.safeParse({});
      assert.equal(invalidMissing.success, false);

      // Příliš dlouhý název
      const invalidLong = createBoardSchema.safeParse({ name: "A".repeat(256) });
      assert.equal(invalidLong.success, false);

      // Příliš dlouhý popis
      const invalidDesc = createBoardSchema.safeParse({ name: "OK", description: "B".repeat(1001) });
      assert.equal(invalidDesc.success, false);
    });

    test("Běžný uživatel nemůže podvrhnout targetUserId (klientem dodané userId je ignorováno nebo zamítnuto)", async () => {
      const useCase = new CreateBoardUseCase(uow);

      // USER zadá cizí targetUserId -> DENY
      const res = await useCase.execute(userActor, {
        name: "Pokus o podvržení",
        targetUserId: otherUserActor.actor_user_id,
      });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthorizationError);
    });

    test("unauthenticated request je odmítnut", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const res = await useCase.execute(null, { name: "Anonymní" });

      assert.equal(res.success, false);
      assert.ok(res.error instanceof AuthenticationError);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. Board Detail (GetBoardDetailUseCase)
  // ───────────────────────────────────────────────────────────
  describe("3. Board Detail (GetBoardDetailUseCase)", () => {
    test("člen Boardu může Board otevřít a obdrží svou roli", async () => {
      const b = await boardRepo.create({ name: "Projekt", createdBy: "user-1" });
      await membershipRepo.create({ boardId: b.id, userId: "user-1", role: "OWNER" });

      const useCase = new GetBoardDetailUseCase(boardRepo, membershipRepo);
      const result = await useCase.execute(userActor, b.id);

      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.board.id, b.id);
      assert.equal(result.data.board.name, "Projekt");
      assert.equal(result.data.role, "OWNER");
    });

    test("nečlen nemůže Board otevřít (vrátí AuthorizationError / NOT_A_MEMBER)", async () => {
      const b = await boardRepo.create({ name: "Cizí projekt", createdBy: "user-2" });
      await membershipRepo.create({ boardId: b.id, userId: "user-2", role: "OWNER" });

      const useCase = new GetBoardDetailUseCase(boardRepo, membershipRepo);
      const result = await useCase.execute(userActor, b.id);

      assert.equal(result.success, false);
      assert.ok(result.error instanceof AuthorizationError);
      assert.equal((result.error as AuthorizationError).reason, "NOT_A_MEMBER");
    });

    test("neexistující Board skončí chybou NotFoundError", async () => {
      const useCase = new GetBoardDetailUseCase(boardRepo, membershipRepo);
      const result = await useCase.execute(userActor, "non-existent-id");

      assert.equal(result.success, false);
      assert.ok(result.error instanceof NotFoundError);
    });

    test("soft-deleted Board skončí chybou NotFoundError", async () => {
      const b = await boardRepo.create({ name: "Smazaný projekt", createdBy: "user-1" });
      await membershipRepo.create({ boardId: b.id, userId: "user-1", role: "OWNER" });
      await boardRepo.softDelete(b.id, new Date());

      const useCase = new GetBoardDetailUseCase(boardRepo, membershipRepo);
      const result = await useCase.execute(userActor, b.id);

      assert.equal(result.success, false);
      assert.ok(result.error instanceof NotFoundError);
    });

    test("ADMIN může Board otevřít i bez členství", async () => {
      const b = await boardRepo.create({ name: "Uživatelský projekt", createdBy: "user-1" });
      await membershipRepo.create({ boardId: b.id, userId: "user-1", role: "OWNER" });

      const useCase = new GetBoardDetailUseCase(boardRepo, membershipRepo);
      const result = await useCase.execute(adminActor, b.id);

      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.board.id, b.id);
      assert.equal(result.data.role, null); // Admin bez členství
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. Board Switcher
  // ───────────────────────────────────────────────────────────
  describe("4. Switcher (Board list scoping)", () => {
    test("obsahuje pouze dostupné Boardy daného uživatele", async () => {
      const b1 = await boardRepo.create({ name: "Moje 1", createdBy: "user-1" });
      await membershipRepo.create({ boardId: b1.id, userId: "user-1", role: "OWNER" });

      const b2 = await boardRepo.create({ name: "Moje 2", createdBy: "user-1" });
      await membershipRepo.create({ boardId: b2.id, userId: "user-1", role: "MEMBER" });

      const bOther = await boardRepo.create({ name: "Cizí", createdBy: "user-2" });
      await membershipRepo.create({ boardId: bOther.id, userId: "user-2", role: "OWNER" });

      const useCase = new GetUserBoardsUseCase(boardRepo);
      const result = await useCase.execute(userActor);

      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.length, 2);
      assert.ok(result.data.some((b) => b.id === b1.id));
      assert.ok(result.data.some((b) => b.id === b2.id));
      assert.ok(!result.data.some((b) => b.id === bOther.id));
    });

    test("neobsahuje soft-deleted Boardy", async () => {
      const bActive = await boardRepo.create({ name: "Aktivní", createdBy: "user-1" });
      await membershipRepo.create({ boardId: bActive.id, userId: "user-1", role: "OWNER" });

      const bDeleted = await boardRepo.create({ name: "Smazaná", createdBy: "user-1" });
      await membershipRepo.create({ boardId: bDeleted.id, userId: "user-1", role: "OWNER" });
      await boardRepo.softDelete(bDeleted.id, new Date());

      const useCase = new GetUserBoardsUseCase(boardRepo);
      const result = await useCase.execute(userActor);

      assert.equal(result.success, true);
      if (!result.success) return;

      assert.equal(result.data.length, 1);
      assert.equal(result.data[0].id, bActive.id);
    });
  });
});
