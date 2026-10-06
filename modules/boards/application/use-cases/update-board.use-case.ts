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
  BoardRecord,
  BoardRepository,
  MembershipRepository,
  UnitOfWork,
} from "../ports/index.ts";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository.port.ts";

export interface UpdateBoardInput {
  readonly boardId: string;
  readonly name: string;
  readonly description?: string | null;
}

export interface UpdateBoardOutput {
  readonly board: BoardRecord;
}

/**
 * Use Case: Úprava metadat Nástěnky (UpdateBoard).
 *
 * Invarianty (docs/050_Architektura.md):
 * 1. Oprávnění k úpravě má OWNER, MANAGER a globální ADMIN (autorizováno přes BoardPolicy BOARD_EDIT).
 * 2. MEMBER a nečlen jsou odmítnuti (INSUFFICIENT_ROLE / NOT_A_MEMBER).
 * 3. Soft-deleted Nástěnka zamítne operaci s kódem BOARD_DELETED.
 * 4. Neexistující Nástěnka vrací NotFoundError.
 * 5. boards.created_by je historický tvůrce a nesmí se nikdy změnit.
 * 6. Aktuální vlastník je určen přes membership OWNER, nikoliv přes boards.created_by.
 * 7. Změna se zaznamenává do AuditLogu v transakci, pokud se změnila hodnota.
 */
export class UpdateBoardUseCase {
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
    input: UpdateBoardInput,
  ): Promise<Result<UpdateBoardOutput, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla vstupu ───────────────────────────
    const boardId = input.boardId?.trim();
    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
    }

    const name = input.name?.trim();
    if (!name || name.length === 0) {
      return err(new ValidationError("Název nástěnky nesmí být prázdný."));
    }
    if (name.length > 255) {
      return err(
        new ValidationError("Název nástěnky nesmí přesáhnout 255 znaků."),
      );
    }

    let normalizedDescription: string | null = null;
    if (input.description !== undefined && input.description !== null) {
      const trimmedDesc = input.description.trim();
      if (trimmedDesc.length > 1000) {
        return err(new ValidationError("Popis nesmí přesáhnout 1000 znaků."));
      }
      normalizedDescription = trimmedDesc.length > 0 ? trimmedDesc : null;
    }

    // ── 3. Provedení (s UoW transakcí nebo přes přímé repozitáře) ───
    try {
      if (this.uow) {
        const updated = await this.uow.runInTransaction(
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
              "BOARD_EDIT",
            );

            if (!authResult.allowed) {
              if (authResult.reason === "UNAUTHENTICATED") {
                throw new AuthenticationError();
              }
              throw new AuthorizationError(
                "K úpravě Nástěnky nemáte dostatečné oprávnění.",
                authResult.reason,
              );
            }

            const targetDescription =
              input.description !== undefined
                ? normalizedDescription
                : board.description;

            const nameChanged = name !== board.name;
            const descChanged = targetDescription !== board.description;

            const updatedBoard = await boards.update(board.id, {
              name,
              description: targetDescription,
            });

            const effectiveAuditLogs = auditLogs ?? this.auditLogRepo;
            if (effectiveAuditLogs && (nameChanged || descChanged)) {
              await effectiveAuditLogs.log({
                actorUserId: actor.actor_user_id,
                boardId: board.id,
                operation: "BOARD_UPDATED",
                targetId: board.id,
                previousState: {
                  name: board.name,
                  description: board.description,
                },
                newState: {
                  name: updatedBoard.name,
                  description: updatedBoard.description,
                },
              });
            }

            return updatedBoard;
          },
        );

        return ok({ board: updated });
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
        "BOARD_EDIT",
      );

      if (!authResult.allowed) {
        if (authResult.reason === "UNAUTHENTICATED") {
          return err(new AuthenticationError());
        }
        return err(
          new AuthorizationError(
            "K úpravě Nástěnky nemáte dostatečné oprávnění.",
            authResult.reason,
          ),
        );
      }

      const targetDescription =
        input.description !== undefined
          ? normalizedDescription
          : board.description;

      const nameChanged = name !== board.name;
      const descChanged = targetDescription !== board.description;

      const updatedBoard = await boardRepo.update(board.id, {
        name,
        description: targetDescription,
      });

      if (this.auditLogRepo && (nameChanged || descChanged)) {
        await this.auditLogRepo.log({
          actorUserId: actor.actor_user_id,
          boardId: board.id,
          operation: "BOARD_UPDATED",
          targetId: board.id,
          previousState: {
            name: board.name,
            description: board.description,
          },
          newState: {
            name: updatedBoard.name,
            description: updatedBoard.description,
          },
        });
      }

      return ok({ board: updatedBoard });
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
