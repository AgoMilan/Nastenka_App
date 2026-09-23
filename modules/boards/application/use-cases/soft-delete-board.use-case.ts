import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import type { ActorMembership } from "../policies/board-authorization.ts";
import { checkBoardPermission } from "../policies/board-policy.ts";
import type { BoardRepository, MembershipRepository } from "../ports/index.ts";

export interface SoftDeleteBoardInput {
  readonly boardId: string;
}

export interface SoftDeleteBoardOutput {
  readonly boardId: string;
  readonly deletedAt: Date;
}

/**
 * Use Case: Logické smazání Nástěnky (SoftDeleteBoard).
 *
 * Invarianty (ADR-009, docs/050_Architektura.md §10.3.3, §10.10):
 * 1. Oprávnění ke smazání má výhradně OWNER a globální ADMIN (autorizováno přes BoardPolicy BOARD_DELETE).
 * 2. Neprovádí se fyzický DELETE – Nástěnka je označena příznakem deleted_at.
 * 3. Členství (memberships) Nástěnky zůstávají v DB zachována pro historii a referenční integritu.
 * 4. Již smazaná Nástěnka zamítne operaci s kódem BOARD_DELETED.
 */
export class SoftDeleteBoardUseCase {
  private readonly boardRepo: BoardRepository;
  private readonly membershipRepo: MembershipRepository;

  constructor(
    boardRepo: BoardRepository,
    membershipRepo: MembershipRepository,
  ) {
    this.boardRepo = boardRepo;
    this.membershipRepo = membershipRepo;
  }

  async execute(
    actor: ActorContext | null,
    input: SoftDeleteBoardInput,
  ): Promise<Result<SoftDeleteBoardOutput, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla vstupu ───────────────────────────
    const boardId = input.boardId?.trim();
    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
    }

    // ── 3. Načtení cílové Nástěnky ─────────────────────────────
    const board = await this.boardRepo.findById(boardId);
    if (!board) {
      return err(new NotFoundError("Nástěnka nebyla nalezena."));
    }

    // ── 4. Kontrola stavu smazané Nástěnky ─────────────────────
    if (board.deletedAt !== null) {
      return err(
        new AuthorizationError("Nástěnka je již smazána.", "BOARD_DELETED"),
      );
    }

    // ── 5. Načtení členství Actora a vyhodnocení autorizace ────
    let actorMembership: ActorMembership | null = null;
    if (actor.global_role !== "ADMIN") {
      const membershipRecord = await this.membershipRepo.findByBoardAndUser(
        boardId,
        actor.actor_user_id,
      );
      if (membershipRecord) {
        actorMembership = { role: membershipRecord.role };
      }
    }

    const authResult = checkBoardPermission(
      actor,
      { boardId: board.id, isDeleted: board.deletedAt !== null },
      actorMembership,
      "BOARD_DELETE",
    );

    if (!authResult.allowed) {
      if (authResult.reason === "UNAUTHENTICATED") {
        return err(new AuthenticationError());
      }
      return err(
        new AuthorizationError(
          "K provedení smazání Nástěnky nemáte dostatečné oprávnění.",
          authResult.reason,
        ),
      );
    }

    // ── 6. Provedení soft-delete mutace ────────────────────────
    const deletedAt = new Date();
    await this.boardRepo.softDelete(board.id, deletedAt);

    return ok({
      boardId: board.id,
      deletedAt,
    });
  }
}
