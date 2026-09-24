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
  UserRecord,
  UserRepository,
} from "../../modules/boards/application/ports/index.ts";
import {
  CreateBoardUseCase,
  SoftDeleteBoardUseCase,
  TransferOwnershipUseCase,
} from "../../modules/boards/application/use-cases/index.ts";
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// Test In-Memory Repositories & Unit of Work s podporou Rollbacku
// ─────────────────────────────────────────────────────────────

class InMemoryBoardRepository implements BoardRepository {
  public store = new Map<string, BoardRecord>();
  private locks = new Map<string, Promise<void>>();

  async acquireLock(boardId: string): Promise<() => void> {
    while (this.locks.has(boardId)) {
      await this.locks.get(boardId);
    }
    let releaseLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = () => {
        this.locks.delete(boardId);
        resolve();
      };
    });
    this.locks.set(boardId, lockPromise);
    return releaseLock;
  }

  async findById(boardId: string): Promise<BoardRecord | null> {
    const record = this.store.get(boardId);
    return record ? { ...record } : null;
  }

  async findByIdForUpdate(boardId: string): Promise<BoardRecord | null> {
    return this.findById(boardId);
  }

  async create(data: CreateBoardData): Promise<BoardRecord> {
    const record: BoardRecord = {
      id: data.id ?? `board-${crypto.randomUUID()}`,
      name: data.name,
      description: data.description ?? null,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };
    this.store.set(record.id, record);
    return { ...record };
  }

  async softDelete(boardId: string, deletedAt: Date): Promise<void> {
    const existing = this.store.get(boardId);
    if (existing) {
      this.store.set(boardId, {
        ...existing,
        deletedAt,
        updatedAt: new Date(),
      });
    }
  }

  clone(): Map<string, BoardRecord> {
    return new Map(
      Array.from(this.store.entries()).map(([k, v]) => [k, { ...v }]),
    );
  }

  restore(snapshot: Map<string, BoardRecord>): void {
    this.store = snapshot;
  }
}

class InMemoryMembershipRepository implements MembershipRepository {
  public store = new Map<string, MembershipRecord>();
  public shouldFailOnCreate = false;
  public shouldFailOnSecondUpdate = false;
  private updateCount = 0;

  async findByBoardAndUser(
    boardId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    for (const record of this.store.values()) {
      if (record.boardId === boardId && record.userId === userId) {
        return { ...record };
      }
    }
    return null;
  }

  async findMembershipsByBoard(boardId: string): Promise<MembershipRecord[]> {
    const results: MembershipRecord[] = [];
    for (const record of this.store.values()) {
      if (record.boardId === boardId) {
        results.push({ ...record });
      }
    }
    return results;
  }

  async create(data: CreateMembershipData): Promise<MembershipRecord> {
    if (this.shouldFailOnCreate) {
      throw new Error("Simulated database failure during membership create");
    }
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
    this.updateCount++;
    if (this.shouldFailOnSecondUpdate && this.updateCount === 2) {
      throw new Error("Simulated database failure during second role update");
    }

    for (const [id, record] of this.store.entries()) {
      if (record.boardId === boardId && record.userId === userId) {
        this.store.set(id, {
          ...record,
          role: newRole,
          updatedAt: new Date(),
        });
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

  clone(): Map<string, MembershipRecord> {
    return new Map(
      Array.from(this.store.entries()).map(([k, v]) => [k, { ...v }]),
    );
  }

  restore(snapshot: Map<string, MembershipRecord>): void {
    this.store = snapshot;
  }

  resetUpdateCount(): void {
    this.updateCount = 0;
  }
}

class InMemoryUserRepository implements UserRepository {
  public store = new Map<string, UserRecord>();

  async findById(userId: string): Promise<UserRecord | null> {
    const u = this.store.get(userId);
    return u ? { ...u } : null;
  }
}

class TxBoardRepository implements BoardRepository {
  private parent: InMemoryBoardRepository;
  private onFinish: (fn: () => void) => void;

  constructor(
    parent: InMemoryBoardRepository,
    onFinish: (fn: () => void) => void,
  ) {
    this.parent = parent;
    this.onFinish = onFinish;
  }

  async findById(boardId: string): Promise<BoardRecord | null> {
    return this.parent.findById(boardId);
  }

  async findByIdForUpdate(boardId: string): Promise<BoardRecord | null> {
    const release = await this.parent.acquireLock(boardId);
    this.onFinish(release);
    return this.parent.findById(boardId);
  }

  async create(data: CreateBoardData): Promise<BoardRecord> {
    return this.parent.create(data);
  }

  async softDelete(boardId: string, deletedAt: Date): Promise<void> {
    return this.parent.softDelete(boardId, deletedAt);
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
    const cleanupFns: Array<() => void> = [];
    const txBoardRepo = new TxBoardRepository(this.boards, (fn) =>
      cleanupFns.push(fn),
    );
    const boardSnapshot = this.boards.clone();
    const membershipSnapshot = this.memberships.clone();

    try {
      return await work({
        boards: txBoardRepo,
        memberships: this.memberships,
        users: this.users,
      });
    } catch (err) {
      this.boards.restore(boardSnapshot);
      this.memberships.restore(membershipSnapshot);
      throw err;
    } finally {
      for (const fn of cleanupFns) {
        fn();
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const actorUser: ActorContext = {
  actor_user_id: "user-1",
  global_role: "USER",
  session_id: "session-1",
  is_active: true,
};

const actorAdmin: ActorContext = {
  actor_user_id: "admin-1",
  global_role: "ADMIN",
  session_id: "session-admin",
  is_active: true,
};

const inactiveActor: ActorContext = {
  actor_user_id: "inactive-1",
  global_role: "USER",
  session_id: "session-inactive",
  is_active: false,
};

// ─────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────

describe("Board Use Cases (STEP 17.11)", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let uow: InMemoryUnitOfWork;

  beforeEach(() => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    uow = new InMemoryUnitOfWork(boardRepo, membershipRepo, userRepo);

    // Výchozí uživatelé
    userRepo.store.set("user-1", {
      id: "user-1",
      name: "Milan",
      email: "milan@test.local",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set("user-2", {
      id: "user-2",
      name: "Alena",
      email: "alena@test.local",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set("user-3", {
      id: "user-3",
      name: "Adam",
      email: "adam@test.local",
      globalRole: "USER",
      isActive: true,
      deletedAt: null,
    });
    userRepo.store.set("admin-1", {
      id: "admin-1",
      name: "Admin",
      email: "admin@test.local",
      globalRole: "ADMIN",
      isActive: true,
      deletedAt: null,
    });
  });

  // ═════════════════════════════════════════════════════════════
  // 1. CreateBoardUseCase
  // ═════════════════════════════════════════════════════════════
  describe("1. CreateBoardUseCase", () => {
    test("úspěšné vytvoření Nástěnky běžným USEREM vytvoří Nástěnku a OWNER membership", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const res = await useCase.execute(actorUser, {
        name: "Vývojový tým",
        description: "Hlavní Nástěnka",
      });

      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.board.name, "Vývojový tým");
        assert.equal(res.data.board.createdBy, "user-1");
        assert.equal(res.data.ownerMembership.userId, "user-1");
        assert.equal(res.data.ownerMembership.role, "OWNER");
        assert.equal(res.data.ownerMembership.boardId, res.data.board.id);

        // Ověření v repozitáři
        const boardInDb = await boardRepo.findById(res.data.board.id);
        assert.ok(boardInDb);
        const members = await membershipRepo.findMembershipsByBoard(
          res.data.board.id,
        );
        assert.equal(members.length, 1);
        assert.equal(members[0].role, "OWNER");
      }
    });

    test("úspěšné vytvoření Nástěnky ADMINEM pro sebe", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const res = await useCase.execute(actorAdmin, {
        name: "Admin Nástěnka",
      });

      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.board.createdBy, "admin-1");
        assert.equal(res.data.ownerMembership.userId, "admin-1");
        assert.equal(res.data.ownerMembership.role, "OWNER");
      }
    });

    test("úspěšné vytvoření Nástěnky ADMINEM pro jiného uživatele (targetUserId)", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const res = await useCase.execute(actorAdmin, {
        name: "Klientská Nástěnka",
        targetUserId: "user-2",
      });

      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.board.createdBy, "admin-1");
        assert.equal(res.data.ownerMembership.userId, "user-2");
        assert.equal(res.data.ownerMembership.role, "OWNER");
      }
    });

    test("běžný USER nesmí zadat targetUserId pro jiného uživatele → DENY(INSUFFICIENT_ROLE)", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const res = await useCase.execute(actorUser, {
        name: "Pokus o podvržení vlastníka",
        targetUserId: "user-2",
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal(res.error.statusCode, 403);
      }
    });

    test("neautentizovaný Actor (null nebo is_active=false) → UNAUTHENTICATED (401)", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const resNull = await useCase.execute(null, { name: "Test" });
      assert.equal(resNull.success, false);
      if (!resNull.success) {
        assert.ok(resNull.error instanceof AuthenticationError);
        assert.equal(resNull.error.statusCode, 401);
      }

      const resInactive = await useCase.execute(inactiveActor, {
        name: "Test",
      });
      assert.equal(resInactive.success, false);
      if (!resInactive.success) {
        assert.ok(resInactive.error instanceof AuthenticationError);
      }
    });

    test("prázdný název Nástěnky → VALIDATION_ERROR (400)", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const res = await useCase.execute(actorUser, { name: "   " });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
        assert.equal(res.error.statusCode, 400);
      }
    });

    test("ADMIN zadá neexistujícího targetUserId → VALIDATION_ERROR", async () => {
      const useCase = new CreateBoardUseCase(uow);
      const res = await useCase.execute(actorAdmin, {
        name: "Test",
        targetUserId: "non-existent-user",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });

    test("Atomicity & Rollback: selhání při vytvoření membership vrátí celou operaci a Board nevznikne", async () => {
      membershipRepo.shouldFailOnCreate = true;

      const useCase = new CreateBoardUseCase(uow);
      await assert.rejects(async () => {
        await useCase.execute(actorUser, { name: "Transakční Nástěnka" });
      }, /Simulated database failure/);

      // Ověření, že v repozitáři nezůstala žádná vytvořená Nástěnka bez vlastníka
      assert.equal(boardRepo.store.size, 0);
      assert.equal(membershipRepo.store.size, 0);
    });
  });

  // ═════════════════════════════════════════════════════════════
  // 2. SoftDeleteBoardUseCase
  // ═════════════════════════════════════════════════════════════
  describe("2. SoftDeleteBoardUseCase", () => {
    let activeBoardId: string;

    beforeEach(async () => {
      // Vytvoření aktivní Nástěnky s user-1 jako OWNER
      const board = await boardRepo.create({
        name: "Projekt X",
        createdBy: "user-1",
      });
      activeBoardId = board.id;
      await membershipRepo.create({
        boardId: activeBoardId,
        userId: "user-1",
        role: "OWNER",
      });
      await membershipRepo.create({
        boardId: activeBoardId,
        userId: "user-2",
        role: "MANAGER",
      });
      await membershipRepo.create({
        boardId: activeBoardId,
        userId: "user-3",
        role: "MEMBER",
      });
    });

    test("OWNER smí provést soft-delete aktivní Nástěnky", async () => {
      const useCase = new SoftDeleteBoardUseCase(boardRepo, membershipRepo);
      const res = await useCase.execute(actorUser, { boardId: activeBoardId });

      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.boardId, activeBoardId);
        assert.ok(res.data.deletedAt instanceof Date);

        // Ověření v repozitáři: záznam zůstává, má deletedAt
        const boardInDb = await boardRepo.findById(activeBoardId);
        assert.ok(boardInDb);
        assert.ok(boardInDb.deletedAt !== null);

        // Invariant: memberships zůstávají zachována
        const members =
          await membershipRepo.findMembershipsByBoard(activeBoardId);
        assert.equal(members.length, 3);
      }
    });

    test("ADMIN smí provést soft-delete i bez členství v Nástěnce", async () => {
      const useCase = new SoftDeleteBoardUseCase(boardRepo, membershipRepo);
      const res = await useCase.execute(actorAdmin, { boardId: activeBoardId });

      assert.equal(res.success, true);
      const boardInDb = await boardRepo.findById(activeBoardId);
      assert.ok(boardInDb && boardInDb.deletedAt !== null);
    });

    test("MANAGER nesmí smazat Nástěnku → DENY(INSUFFICIENT_ROLE)", async () => {
      const managerActor: ActorContext = {
        actor_user_id: "user-2",
        global_role: "USER",
        session_id: "session-2",
        is_active: true,
      };

      const useCase = new SoftDeleteBoardUseCase(boardRepo, membershipRepo);
      const res = await useCase.execute(managerActor, {
        boardId: activeBoardId,
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal(res.error.statusCode, 403);
      }
    });

    test("MEMBER nesmí smazat Nástěnku → DENY(INSUFFICIENT_ROLE)", async () => {
      const memberActor: ActorContext = {
        actor_user_id: "user-3",
        global_role: "USER",
        session_id: "session-3",
        is_active: true,
      };

      const useCase = new SoftDeleteBoardUseCase(boardRepo, membershipRepo);
      const res = await useCase.execute(memberActor, {
        boardId: activeBoardId,
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
      }
    });

    test("nečlen nesmí smazat Nástěnku → DENY(NOT_A_MEMBER)", async () => {
      const nonMemberActor: ActorContext = {
        actor_user_id: "user-outside",
        global_role: "USER",
        session_id: "session-outside",
        is_active: true,
      };

      const useCase = new SoftDeleteBoardUseCase(boardRepo, membershipRepo);
      const res = await useCase.execute(nonMemberActor, {
        boardId: activeBoardId,
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
      }
    });

    test("neexistující Nástěnka vrací NOT_FOUND (404)", async () => {
      const useCase = new SoftDeleteBoardUseCase(boardRepo, membershipRepo);
      const res = await useCase.execute(actorUser, { boardId: "non-existent" });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
        assert.equal(res.error.statusCode, 404);
      }
    });

    test("již smazaná Nástěnka zamítne operaci s BOARD_DELETED", async () => {
      await boardRepo.softDelete(activeBoardId, new Date());

      const useCase = new SoftDeleteBoardUseCase(boardRepo, membershipRepo);
      const res = await useCase.execute(actorUser, { boardId: activeBoardId });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
      }
    });
  });

  // ═════════════════════════════════════════════════════════════
  // 3. TransferOwnershipUseCase
  // ═════════════════════════════════════════════════════════════
  describe("3. TransferOwnershipUseCase", () => {
    let boardId: string;

    beforeEach(async () => {
      const board = await boardRepo.create({
        name: "Společný projekt",
        createdBy: "user-1",
      });
      boardId = board.id;
    });

    test("úspěšný převod z OWNER na MEMBER bez jiného Managera: cílový uživatel je OWNER, původní se stává MANAGER", async () => {
      // Stav: user-1 je OWNER, user-2 je MEMBER (žádný Manager na Nástěnce)
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "user-2",
        role: "MEMBER",
      });

      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(actorUser, {
        boardId,
        targetUserId: "user-2",
      });

      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.newOwner.userId, "user-2");
        assert.equal(res.data.newOwner.newRole, "OWNER");
        assert.equal(res.data.previousOwner.userId, "user-1");
        assert.equal(res.data.previousOwner.newRole, "MANAGER");

        // Ověření invariantů: právě 1 OWNER, max 1 MANAGER
        const all = await membershipRepo.findMembershipsByBoard(boardId);
        const owners = all.filter((m) => m.role === "OWNER");
        const managers = all.filter((m) => m.role === "MANAGER");
        assert.equal(owners.length, 1);
        assert.equal(owners[0].userId, "user-2");
        assert.equal(managers.length, 1);
        assert.equal(managers[0].userId, "user-1");
      }
    });

    test("úspěšný převod z OWNER na MEMBER při existujícím jiném Managerovi: původní Owner se stává MEMBER", async () => {
      // Stav: user-1 je OWNER, user-2 je MANAGER, user-3 je MEMBER
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "user-2",
        role: "MANAGER",
      });
      await membershipRepo.create({
        boardId,
        userId: "user-3",
        role: "MEMBER",
      });

      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(actorUser, {
        boardId,
        targetUserId: "user-3",
      });

      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.newOwner.userId, "user-3");
        assert.equal(res.data.newOwner.newRole, "OWNER");
        assert.equal(res.data.previousOwner.userId, "user-1");
        assert.equal(res.data.previousOwner.newRole, "MEMBER");

        // Invariant: právě 1 OWNER a max. 1 MANAGER
        const all = await membershipRepo.findMembershipsByBoard(boardId);
        const owners = all.filter((m) => m.role === "OWNER");
        const managers = all.filter((m) => m.role === "MANAGER");
        assert.equal(owners.length, 1);
        assert.equal(owners[0].userId, "user-3");
        assert.equal(managers.length, 1);
        assert.equal(managers[0].userId, "user-2");
      }
    });

    test("úspěšný převod z OWNER na stávajícího MANAGERA: Manager se stává OWNER, původní Owner se stává MANAGER", async () => {
      // Stav: user-1 je OWNER, user-2 je MANAGER
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "user-2",
        role: "MANAGER",
      });

      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(actorUser, {
        boardId,
        targetUserId: "user-2",
      });

      assert.equal(res.success, true);
      if (res.success) {
        assert.equal(res.data.newOwner.userId, "user-2");
        assert.equal(res.data.newOwner.newRole, "OWNER");
        assert.equal(res.data.previousOwner.userId, "user-1");
        assert.equal(res.data.previousOwner.newRole, "MANAGER");

        // Ověření invariantů
        const all = await membershipRepo.findMembershipsByBoard(boardId);
        const owners = all.filter((m) => m.role === "OWNER");
        const managers = all.filter((m) => m.role === "MANAGER");
        assert.equal(owners.length, 1);
        assert.equal(managers.length, 1);
      }
    });

    test("úspěšný převod iniciovaný ADMINEM", async () => {
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "user-2",
        role: "MEMBER",
      });

      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(actorAdmin, {
        boardId,
        targetUserId: "user-2",
      });

      assert.equal(res.success, true);
      const all = await membershipRepo.findMembershipsByBoard(boardId);
      const owners = all.filter((m) => m.role === "OWNER");
      assert.equal(owners.length, 1);
      assert.equal(owners[0].userId, "user-2");
    });

    test("MANAGER nesmí převést vlastnictví → DENY(INSUFFICIENT_ROLE)", async () => {
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "user-2",
        role: "MANAGER",
      });

      const managerActor: ActorContext = {
        actor_user_id: "user-2",
        global_role: "USER",
        session_id: "session-2",
        is_active: true,
      };

      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(managerActor, {
        boardId,
        targetUserId: "user-1",
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
        assert.equal(res.error.statusCode, 403);
      }
    });

    test("MEMBER nesmí převést vlastnictví → DENY(INSUFFICIENT_ROLE)", async () => {
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "user-3",
        role: "MEMBER",
      });

      const memberActor: ActorContext = {
        actor_user_id: "user-3",
        global_role: "USER",
        session_id: "session-3",
        is_active: true,
      };

      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(memberActor, {
        boardId,
        targetUserId: "user-1",
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
      }
    });

    test("převod na sebe sama (stávajícího Ownera) je zamítnut jako CONFLICT", async () => {
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });

      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(actorUser, {
        boardId,
        targetUserId: "user-1",
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ConflictError);
        assert.equal(res.error.statusCode, 409);
      }
    });

    test("převod na uživatele, který není členem Nástěnky → VALIDATION_ERROR", async () => {
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      // user-2 není přidán do Nástěnky

      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(actorUser, {
        boardId,
        targetUserId: "user-2",
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });

    test("převod na smazané Nástěnce → BOARD_DELETED", async () => {
      await boardRepo.softDelete(boardId, new Date());
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "user-2",
        role: "MEMBER",
      });

      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(actorUser, {
        boardId,
        targetUserId: "user-2",
      });

      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof AuthorizationError);
      }
    });

    test("zamítne neautentizovaného nebo neaktivního aktéra", async () => {
      const useCase = new TransferOwnershipUseCase(uow);
      const resNull = await useCase.execute(null, {
        boardId,
        targetUserId: "user-2",
      });
      assert.equal(resNull.success, false);
      if (!resNull.success) {
        assert.ok(resNull.error instanceof AuthenticationError);
      }

      const inactiveActor: ActorContext = {
        actor_user_id: "inactive-user",
        global_role: "USER",
        session_id: "inactive-sess",
        is_active: false,
      };
      const resInactive = await useCase.execute(inactiveActor, {
        boardId,
        targetUserId: "user-2",
      });
      assert.equal(resInactive.success, false);
      if (!resInactive.success) {
        assert.ok(resInactive.error instanceof AuthenticationError);
      }
    });

    test("zamítne prázdné ID Nástěnky nebo cílového uživatele", async () => {
      const useCase = new TransferOwnershipUseCase(uow);
      const resEmptyBoard = await useCase.execute(actorUser, {
        boardId: "   ",
        targetUserId: "user-2",
      });
      assert.equal(resEmptyBoard.success, false);
      if (!resEmptyBoard.success) {
        assert.ok(resEmptyBoard.error instanceof ValidationError);
      }

      const resEmptyUser = await useCase.execute(actorUser, {
        boardId,
        targetUserId: "",
      });
      assert.equal(resEmptyUser.success, false);
      if (!resEmptyUser.success) {
        assert.ok(resEmptyUser.error instanceof ValidationError);
      }
    });

    test("zamítne převod na neexistující Nástěnce", async () => {
      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(actorUser, {
        boardId: "non-existent-board",
        targetUserId: "user-2",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof NotFoundError);
      }
    });

    test("zamítne převod pokud cílový uživatel neexistuje v users repozitáři", async () => {
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "ghost-user",
        role: "MEMBER",
      });

      const useCase = new TransferOwnershipUseCase(uow);
      const res = await useCase.execute(actorUser, {
        boardId,
        targetUserId: "ghost-user",
      });
      assert.equal(res.success, false);
      if (!res.success) {
        assert.ok(res.error instanceof ValidationError);
      }
    });

    test("zamítne převod pokud cílový uživatel není aktivní nebo je soft-deleted", async () => {
      userRepo.store.set("inactive-target", {
        id: "inactive-target",
        name: "Inactive Target",
        email: "inactive@test.local",
        globalRole: "USER",
        isActive: false,
        deletedAt: null,
      });
      userRepo.store.set("deleted-target", {
        id: "deleted-target",
        name: "Deleted Target",
        email: "deleted@test.local",
        globalRole: "USER",
        isActive: true,
        deletedAt: new Date(),
      });

      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "inactive-target",
        role: "MEMBER",
      });
      await membershipRepo.create({
        boardId,
        userId: "deleted-target",
        role: "MEMBER",
      });

      const useCase = new TransferOwnershipUseCase(uow);

      const resInactive = await useCase.execute(actorUser, {
        boardId,
        targetUserId: "inactive-target",
      });
      assert.equal(resInactive.success, false);
      if (!resInactive.success) {
        assert.ok(resInactive.error instanceof ValidationError);
      }

      const resDeleted = await useCase.execute(actorUser, {
        boardId,
        targetUserId: "deleted-target",
      });
      assert.equal(resDeleted.success, false);
      if (!resDeleted.success) {
        assert.ok(resDeleted.error instanceof ValidationError);
      }
    });

    test("Atomicity & Rollback: selhání při aktualizaci nového Ownera vrátí celou operaci zpět", async () => {
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "user-2",
        role: "MEMBER",
      });

      membershipRepo.shouldFailOnSecondUpdate = true;
      membershipRepo.resetUpdateCount();

      const useCase = new TransferOwnershipUseCase(uow);
      await assert.rejects(async () => {
        await useCase.execute(actorUser, { boardId, targetUserId: "user-2" });
      }, /Simulated database failure during second role update/);

      // Ověření návratu (Rollback): původní Owner zůstal OWNER, cíl zůstal MEMBER
      const m1 = await membershipRepo.findByBoardAndUser(boardId, "user-1");
      const m2 = await membershipRepo.findByBoardAndUser(boardId, "user-2");
      assert.equal(m1?.role, "OWNER");
      assert.equal(m2?.role, "MEMBER");
    });

    test("Concurrency ochrana: dva souběžné požadavky na převod vlastnictví nesmí vytvořit stav se 2 Ownery", async () => {
      // user-1 je OWNER, user-2 i user-3 jsou MEMBER
      await membershipRepo.create({ boardId, userId: "user-1", role: "OWNER" });
      await membershipRepo.create({
        boardId,
        userId: "user-2",
        role: "MEMBER",
      });
      await membershipRepo.create({
        boardId,
        userId: "user-3",
        role: "MEMBER",
      });

      const useCase = new TransferOwnershipUseCase(uow);

      // Spuštění dvou souběžných požadavků
      const [res1, res2] = await Promise.all([
        useCase.execute(actorUser, { boardId, targetUserId: "user-2" }),
        useCase.execute(actorUser, { boardId, targetUserId: "user-3" }),
      ]);

      // Alespoň jeden musel uspět
      const successes = [res1, res2].filter((r) => r.success);
      assert.ok(
        successes.length >= 1,
        "Alespoň jeden souběžný požadavek musí uspět",
      );

      // Invariant: na Nástěnce musí být právě 1 OWNER
      const all = await membershipRepo.findMembershipsByBoard(boardId);
      const owners = all.filter((m) => m.role === "OWNER");
      assert.equal(owners.length, 1, "Na Nástěnce smí být právě 1 OWNER");
    });
  });
});
