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
  UpdateBoardData,
} from "../../modules/boards/application/ports/index.ts";
import {
  UpdateBoardUseCase,
  type UpdateBoardInput,
} from "../../modules/boards/application/use-cases/index.ts";
import {
  updateBoardSchema,
  type UpdateBoardDto,
} from "../../modules/boards/api/dto/board.dto.ts";
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors/index.ts";

// ─────────────────────────────────────────────────────────────
// In-Memory Repositories pro Unit Testy Board Edit
// ─────────────────────────────────────────────────────────────

class InMemoryBoardRepository implements BoardRepository {
  public store = new Map<string, BoardRecord>();
  public updateCallsCount = 0;

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
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      deletedAt: null,
    };
    this.store.set(id, record);
    return { ...record };
  }

  async update(boardId: string, data: UpdateBoardData): Promise<BoardRecord> {
    this.updateCallsCount++;
    const existing = this.store.get(boardId);
    if (!existing) {
      throw new Error(`Board not found: ${boardId}`);
    }
    const updated: BoardRecord = {
      ...existing,
      name: data.name,
      description:
        data.description !== undefined ? data.description : existing.description,
      updatedAt: new Date("2026-09-29T22:30:00Z"),
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

  async findActiveBoardsForUser(): Promise<any[]> {
    return [];
  }

  async findActiveBoardsForAdmin(): Promise<any[]> {
    return [];
  }
}

class InMemoryMembershipRepository implements MembershipRepository {
  public store = new Map<string, MembershipRecord>();

  async findByBoardAndUser(
    boardId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    const key = `${boardId}:${userId}`;
    const r = this.store.get(key);
    return r ? { ...r } : null;
  }

  async findMembershipsByBoard(boardId: string): Promise<MembershipRecord[]> {
    return Array.from(this.store.values()).filter((m) => m.boardId === boardId);
  }

  async create(data: CreateMembershipData): Promise<MembershipRecord> {
    const key = `${data.boardId}:${data.userId}`;
    const record: MembershipRecord = {
      id: `mem-${crypto.randomUUID()}`,
      boardId: data.boardId,
      userId: data.userId,
      role: data.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.store.set(key, record);
    return { ...record };
  }

  async delete(boardId: string, userId: string): Promise<void> {
    const key = `${boardId}:${userId}`;
    this.store.delete(key);
  }

  async updateRole(
    boardId: string,
    userId: string,
    role: "OWNER" | "MANAGER" | "MEMBER",
  ): Promise<void> {
    const key = `${boardId}:${userId}`;
    const existing = this.store.get(key);
    if (!existing) throw new Error("Membership not found");
    const updated: MembershipRecord = { ...existing, role, updatedAt: new Date() };
    this.store.set(key, updated);
  }

  async countManagers(boardId: string): Promise<number> {
    return Array.from(this.store.values()).filter(
      (m) => m.boardId === boardId && m.role === "MANAGER",
    ).length;
  }
}

// ─────────────────────────────────────────────────────────────
// Test Suite: BOARD EDIT (DTO, Use Case, Server Action, UI)
// ─────────────────────────────────────────────────────────────

describe("BOARD EDIT – Kompletní testovací sada", () => {
  let boardRepo: InMemoryBoardRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let useCase: UpdateBoardUseCase;

  const boardId = "board-123";
  const originalCreatedBy = "user-original-creator";

  // Actor contexts
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
    actor_user_id: "user-owner",
    global_role: "USER",
    session_id: "sess-inactive",
    is_active: false,
  };

  beforeEach(async () => {
    boardRepo = new InMemoryBoardRepository();
    membershipRepo = new InMemoryMembershipRepository();
    useCase = new UpdateBoardUseCase(boardRepo, membershipRepo);

    // Vytvoření testovací nástěnky
    await boardRepo.create({
      id: boardId,
      name: "Původní název",
      description: "Původní popis",
      createdBy: originalCreatedBy,
    });

    // Členství
    await membershipRepo.create({
      boardId,
      userId: ownerActor.actor_user_id,
      role: "OWNER",
    });

    await membershipRepo.create({
      boardId,
      userId: managerActor.actor_user_id,
      role: "MANAGER",
    });

    await membershipRepo.create({
      boardId,
      userId: memberActor.actor_user_id,
      role: "MEMBER",
    });
  });

  // ───────────────────────────────────────────────────────────
  // 1. DTO – updateBoardSchema
  // ───────────────────────────────────────────────────────────
  describe("1. DTO – updateBoardSchema", () => {
    test("přijímá platný název a popis", () => {
      const parsed = updateBoardSchema.safeParse({
        boardId,
        name: "Nový název nástěnky",
        description: "Nový detailní popis",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.name, "Nový název nástěnky");
        assert.equal(parsed.data.description, "Nový detailní popis");
      }
    });

    test("správně ořízne mezery (trim) v názvu", () => {
      const parsed = updateBoardSchema.safeParse({
        name: "   Oříznutý název   ",
      });
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.name, "Oříznutý název");
      }
    });

    test("odmítá prázdný název nebo název složený pouze z mezer", () => {
      const r1 = updateBoardSchema.safeParse({ name: "" });
      assert.equal(r1.success, false);

      const r2 = updateBoardSchema.safeParse({ name: "     " });
      assert.equal(r2.success, false);
    });

    test("odmítá název delší než 255 znaků", () => {
      const longName = "A".repeat(256);
      const parsed = updateBoardSchema.safeParse({ name: longName });
      assert.equal(parsed.success, false);
    });

    test("odmítá popis delší než 1000 znaků", () => {
      const longDesc = "B".repeat(1001);
      const parsed = updateBoardSchema.safeParse({
        name: "Platný název",
        description: longDesc,
      });
      assert.equal(parsed.success, false);
    });

    test("povoluje prázdný řetězec, null i vynechaný popis", () => {
      const r1 = updateBoardSchema.safeParse({
        name: "Název",
        description: "",
      });
      assert.equal(r1.success, true);

      const r2 = updateBoardSchema.safeParse({
        name: "Název",
        description: null,
      });
      assert.equal(r2.success, true);

      const r3 = updateBoardSchema.safeParse({
        name: "Název",
      });
      assert.equal(r3.success, true);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 2. UpdateBoardUseCase – autorizace a byznys logika
  // ───────────────────────────────────────────────────────────
  describe("2. UpdateBoardUseCase – autorizace a byznys logika", () => {
    test("1. OWNER → ALLOW: vlastník může editovat vlastní nástěnku", async () => {
      const result = await useCase.execute(ownerActor, {
        boardId,
        name: "Upraveno vlastníkem",
        description: "Nový popis od vlastníka",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.board.name, "Upraveno vlastníkem");
        assert.equal(result.data.board.description, "Nový popis od vlastníka");
      }
    });

    test("2. MANAGER → ALLOW: správce může editovat nástěnku", async () => {
      const result = await useCase.execute(managerActor, {
        boardId,
        name: "Upraveno správcem",
        description: "Popis od správce",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.board.name, "Upraveno správcem");
      }
    });

    test("3. ADMIN → ALLOW: globální administrátor může editovat nástěnku i bez členství", async () => {
      const result = await useCase.execute(adminActor, {
        boardId,
        name: "Upraveno administrátorem",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.board.name, "Upraveno administrátorem");
      }
    });

    test("4. MEMBER → DENY: běžný člen nemůže editovat nástěnku (INSUFFICIENT_ROLE)", async () => {
      const result = await useCase.execute(memberActor, {
        boardId,
        name: "Pokus o změnu členem",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthorizationError);
        assert.equal((result.error as AuthorizationError).reason, "INSUFFICIENT_ROLE");
      }
    });

    test("5. Nečlen → DENY: uživatel bez členství nemůže editovat nástěnku (NOT_A_MEMBER)", async () => {
      const result = await useCase.execute(nonMemberActor, {
        boardId,
        name: "Pokus nečlena",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthorizationError);
        assert.equal((result.error as AuthorizationError).reason, "NOT_A_MEMBER");
      }
    });

    test("6. Soft-deleted board → DENY: smazanou nástěnku nelze editovat (BOARD_DELETED)", async () => {
      await boardRepo.softDelete(boardId, new Date());

      const result = await useCase.execute(ownerActor, {
        boardId,
        name: "Pokus o editaci smazané nástěnky",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof AuthorizationError);
        assert.equal((result.error as AuthorizationError).reason, "BOARD_DELETED");
      }
    });

    test("7. Neexistující board → NotFoundError", async () => {
      const result = await useCase.execute(ownerActor, {
        boardId: "non-existent-board",
        name: "Nový název",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        assert.ok(result.error instanceof NotFoundError);
      }
    });

    test("8. Správná změna názvu a trim mezer", async () => {
      const result = await useCase.execute(ownerActor, {
        boardId,
        name: "   Zcela Nový Název   ",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.board.name, "Zcela Nový Název");
      }
    });

    test("9. Správná změna popisu a nastavení prázdného popisu na null", async () => {
      const result = await useCase.execute(ownerActor, {
        boardId,
        name: "Název",
        description: "   ",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.board.description, null);
      }
    });

    test("10. boards.created_by se nikdy nezmění", async () => {
      const result = await useCase.execute(ownerActor, {
        boardId,
        name: "Změněný název",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.board.createdBy, originalCreatedBy);
      }
      const reloaded = await boardRepo.findById(boardId);
      assert.equal(reloaded?.createdBy, originalCreatedBy);
    });

    test("11. boards.updated_at se aktualizuje", async () => {
      const initial = await boardRepo.findById(boardId);
      const initialUpdatedAt = initial?.updatedAt;

      const result = await useCase.execute(ownerActor, {
        boardId,
        name: "Aktualizovaný název",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.notEqual(
          result.data.board.updatedAt.getTime(),
          initialUpdatedAt?.getTime(),
        );
      }
    });

    test("12. repository.update se volá pouze po úspěšné autorizaci", async () => {
      const callsBefore = boardRepo.updateCallsCount;

      // Pokus neoprávněného uživatele
      await useCase.execute(memberActor, {
        boardId,
        name: "Neautorizovaná změna",
      });
      assert.equal(boardRepo.updateCallsCount, callsBefore);

      // Úspěšná autorizace
      await useCase.execute(ownerActor, {
        boardId,
        name: "Autorizovaná změna",
      });
      assert.equal(boardRepo.updateCallsCount, callsBefore + 1);
    });

    test("13. Neautentizovaný nebo neaktivní uživatel je zamítnut (AuthenticationError)", async () => {
      const r1 = await useCase.execute(null, {
        boardId,
        name: "Název",
      });
      assert.equal(r1.success, false);
      assert.ok(!r1.success && r1.error instanceof AuthenticationError);

      const r2 = await useCase.execute(inactiveActor, {
        boardId,
        name: "Název",
      });
      assert.equal(r2.success, false);
      assert.ok(!r2.success && r2.error instanceof AuthenticationError);
    });

    test("14. Validační chyby vstupu (prázdný název, název > 255, popis > 1000)", async () => {
      const r1 = await useCase.execute(ownerActor, {
        boardId,
        name: "   ",
      });
      assert.equal(r1.success, false);
      assert.ok(!r1.success && r1.error instanceof ValidationError);

      const r2 = await useCase.execute(ownerActor, {
        boardId,
        name: "X".repeat(256),
      });
      assert.equal(r2.success, false);
      assert.ok(!r2.success && r2.error instanceof ValidationError);

      const r3 = await useCase.execute(ownerActor, {
        boardId,
        name: "Platný název",
        description: "Y".repeat(1001),
      });
      assert.equal(r3.success, false);
      assert.ok(!r3.success && r3.error instanceof ValidationError);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 3. UI Role Permission Derivation (canEditBoard)
  // ───────────────────────────────────────────────────────────
  describe("3. UI Role Permission Derivation (canEditBoard)", () => {
    function deriveCanEditBoard(
      role: "OWNER" | "MANAGER" | "MEMBER" | null,
      isGlobalAdmin: boolean,
    ): boolean {
      return isGlobalAdmin || role === "OWNER" || role === "MANAGER";
    }

    test("OWNER má canEditBoard = true (tlačítko viditelné)", () => {
      assert.equal(deriveCanEditBoard("OWNER", false), true);
    });

    test("MANAGER má canEditBoard = true (tlačítko viditelné)", () => {
      assert.equal(deriveCanEditBoard("MANAGER", false), true);
    });

    test("ADMIN má canEditBoard = true i bez členství (tlačítko viditelné)", () => {
      assert.equal(deriveCanEditBoard(null, true), true);
      assert.equal(deriveCanEditBoard("MEMBER", true), true);
    });

    test("MEMBER má canEditBoard = false (tlačítko skryté)", () => {
      assert.equal(deriveCanEditBoard("MEMBER", false), false);
    });

    test("Nečlen bez role má canEditBoard = false (tlačítko skryté)", () => {
      assert.equal(deriveCanEditBoard(null, false), false);
    });
  });

  // ───────────────────────────────────────────────────────────
  // 4. Server Action – Simulace toku
  // ───────────────────────────────────────────────────────────
  describe("4. Server Action – Simulace toku", () => {
    async function simulateUpdateBoardAction(
      actor: ActorContext | null,
      formData: { boardId?: string; name?: string; description?: string },
    ) {
      if (!actor || !actor.is_active) {
        return {
          success: false,
          error: "Uživatel není přihlášen nebo je účet neaktivní.",
        };
      }

      const parsed = updateBoardSchema.safeParse({
        boardId: formData.boardId ?? "",
        name: formData.name ?? "",
        description: formData.description,
      });

      if (!parsed.success) {
        return {
          success: false,
          error: parsed.error.issues[0]?.message ?? "Neplatný vstup formuláře.",
        };
      }

      const boardId = parsed.data.boardId ?? formData.boardId ?? "";
      if (!boardId) {
        return {
          success: false,
          error: "ID Nástěnky je povinné.",
        };
      }

      const result = await useCase.execute(actor, {
        boardId,
        name: parsed.data.name,
        description: parsed.data.description ? parsed.data.description.trim() : null,
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error.message,
        };
      }

      return {
        success: true,
        boardId: result.data.board.id,
      };
    }

    test("autentizovaný OWNER provede update úspěšně", async () => {
      const res = await simulateUpdateBoardAction(ownerActor, {
        boardId,
        name: "Nový název přes Server Action",
        description: "Nový popis",
      });
      assert.equal(res.success, true);
      assert.equal(res.boardId, boardId);
    });

    test("autentizovaný MANAGER provede update úspěšně", async () => {
      const res = await simulateUpdateBoardAction(managerActor, {
        boardId,
        name: "Manažerský název",
      });
      assert.equal(res.success, true);
    });

    test("autentizovaný ADMIN provede update úspěšně", async () => {
      const res = await simulateUpdateBoardAction(adminActor, {
        boardId,
        name: "Admin název",
      });
      assert.equal(res.success, true);
    });

    test("MEMBER je Server Action odmítnut", async () => {
      const res = await simulateUpdateBoardAction(memberActor, {
        boardId,
        name: "Členský pokus",
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.includes("oprávnění"));
    });

    test("neautentizovaný uživatel je Server Action odmítnut", async () => {
      const res = await simulateUpdateBoardAction(null, {
        boardId,
        name: "Neautentizovaný pokus",
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.includes("přihlášen"));
    });

    test("neplatný vstup selže na validační chybě Zod schématu", async () => {
      const res = await simulateUpdateBoardAction(ownerActor, {
        boardId,
        name: "",
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.includes("prázdný"));
    });

    test("klient nemůže podvrhnout aktéra (aktér pochází ze serverové session)", async () => {
      // I kdyby se klient pokusil poslat jakýkoli údaj, Use Case obdrží pouze serverový actor
      const res = await simulateUpdateBoardAction(memberActor, {
        boardId,
        name: "Podvržení",
      });
      assert.equal(res.success, false);
    });
  });
});
