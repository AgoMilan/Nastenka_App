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
import type {
  BoardRepository,
  MembershipRepository,
  UnitOfWork,
} from "../ports/index.ts";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository.port.ts";

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
 * 5. Zápis do AuditLogu v transakci jako BOARD_DELETED.
 */
export class SoftDeleteBoardUseCase {
  private readonly uow?: UnitOfWork;
  private readonly boardRepo?: BoardRepository;
  private readonly membershipRepo?: MembershipRepository;
  private readonly auditLogRepo?: AuditLogRepository;

  constructor(
    uowOrBoardRepo: UnitOfWork | BoardRepository,
    membershipRepo?: MembershipRepository,
    auditLogRepo?: AuditLogRepository,
    uow?: UnitOfWork,
  ) {
    if ("runInTransaction" in uowOrBoardRepo) {
      this.uow = uowOrBoardRepo;
    } else {
      this.boardRepo = uowOrBoardRepo;
      this.membershipRepo = membershipRepo;
      this.auditLogRepo = auditLogRepo;
      this.uow = uow;
    }
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

    // ── 3. Provedení (s UoW transakcí nebo přes přímé repozitáře) ───
    try {
      if (this.uow) {
        const result = await this.uow.runInTransaction(
          async ({ boards, memberships, auditLogs }) => {
            const board = await boards.findById(boardId);
            if (!board) {
              throw new NotFoundError("Nástěnka nebyla nalezena.");
            }
            if (board.deletedAt !== null) {
              throw new AuthorizationError(
                "Nástěnka je již smazána.",
                "BOARD_DELETED",
              );
            }

            let actorMembership: ActorMembership | null = null;
            if (actor.global_role !== "ADMIN") {
              const membershipRecord = await memberships.findByBoardAndUser(
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
                throw new AuthenticationError();
              }
              throw new AuthorizationError(
                "K provedení smazání Nástěnky nemáte dostatečné oprávnění.",
                authResult.reason,
              );
            }

            const deletedAt = new Date();
            await boards.softDelete(board.id, deletedAt);

            const effectiveAuditLogs = auditLogs ?? this.auditLogRepo;
            if (effectiveAuditLogs) {
              await effectiveAuditLogs.log({
                actorUserId: actor.actor_user_id,
                boardId: board.id,
                operation: "BOARD_DELETED",
                targetId: board.id,
                previousState: { deletedAt: null },
                newState: { deletedAt: deletedAt.toISOString() },
              });
            }

            return {
              boardId: board.id,
              deletedAt,
            };
          },
        );

        return ok(result);
      }

      // Fallback pro přímé repozitáře (např. bez UoW)
      const boardRepo = this.boardRepo!;
      const membershipRepo = this.membershipRepo!;

      const board = await boardRepo.findById(boardId);
      if (!board) {
        return err(new NotFoundError("Nástěnka nebyla nalezena."));
      }
      if (board.deletedAt !== null) {
        return err(
          new AuthorizationError("Nástěnka je již smazána.", "BOARD_DELETED"),
        );
      }

      let actorMembership: ActorMembership | null = null;
      if (actor.global_role !== "ADMIN") {
        const membershipRecord = await membershipRepo.findByBoardAndUser(
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

      const deletedAt = new Date();
      await boardRepo.softDelete(board.id, deletedAt);

      if (this.auditLogRepo) {
        await this.auditLogRepo.log({
          actorUserId: actor.actor_user_id,
          boardId: board.id,
          operation: "BOARD_DELETED",
          targetId: board.id,
          previousState: { deletedAt: null },
          newState: { deletedAt: deletedAt.toISOString() },
        });
      }

      return ok({
        boardId: board.id,
        deletedAt,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
