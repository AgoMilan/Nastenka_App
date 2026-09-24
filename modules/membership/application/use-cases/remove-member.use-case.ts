import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import type { ActorMembership } from "../../../boards/application/policies/board-authorization.ts";
import type { UnitOfWork } from "../../../boards/application/ports/unit-of-work.port.ts";
import { checkMembershipPermission } from "../policies/membership-policy.ts";
import type { MembershipAuthorizationTarget } from "../policies/membership-authorization.ts";

export interface RemoveMemberInput {
  readonly boardId: string;
  readonly targetUserId: string;
}

export interface RemoveMemberOutput {
  readonly boardId: string;
  readonly removedUserId: string;
}

/**
 * Use Case: Odebrání člena z Nástěnky (RemoveMember).
 *
 * Pravidla:
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board musí existovat a nesmí být smazán (soft-deleted).
 * 3. Cílový uživatel musí mít existující členství na dané Nástěnce.
 * 4. Oprávnění: MEMBER_REMOVE dle MembershipPolicy:
 *    - ADMIN: smí odebrat MEMBER i MANAGER (nesmí odebrat sole OWNER)
 *    - OWNER: smí odebrat MEMBER i MANAGER (nesmí odebrat sole OWNER)
 *    - MANAGER: smí odebrat VÝHRADNĚ řadového člena (MEMBER)
 *    - MEMBER: nesmí administrativně odebírat členy
 * 5. Strukturální invarianty:
 *    - Zákaz odebrání jediného platného Ownera (CANNOT_REMOVE_SOLE_OWNER). Nástěnka nesmí zůstat bez Ownera.
 * 6. Kaskádové ošetření úkolů (docs/050_Architektura.md §1074 a §1778):
 *    - Pokud byl odebraný uživatel Hlavním Řešitelem úkolu, úkol přejde do stavu Nepřiřazeno (assigneeId = null).
 *    - Pokud byl odebraný uživatel spoluřešitelem, je z úkolu odstraněn.
 * 7. Zamykání pro souběh přes findByIdForUpdate na úrovni Boardu.
 */
export class RemoveMemberUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: RemoveMemberInput,
  ): Promise<Result<RemoveMemberOutput, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla ──────────────────────────────────
    const boardId = input.boardId?.trim();
    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
    }

    const targetUserId = input.targetUserId?.trim();
    if (!targetUserId || targetUserId.length === 0) {
      return err(new ValidationError("ID cílového uživatele je povinné."));
    }

    // ── 3. Transakční provedení ────────────────────────────────
    try {
      const output = await this.uow.runInTransaction(
        async ({ boards, memberships, tasks, taskParticipants }) => {
          // A. Načtení Nástěnky s uzamčením pro souběh
          const board = await boards.findByIdForUpdate(boardId);
          if (!board) {
            throw new NotFoundError("Nástěnka nebyla nalezena.");
          }
          if (board.deletedAt !== null) {
            throw new AuthorizationError(
              "Nástěnka je smazána.",
              "BOARD_DELETED",
            );
          }

          // B. Načtení cílového členství
          const targetMembership = await memberships.findByBoardAndUser(
            boardId,
            targetUserId,
          );
          if (!targetMembership) {
            throw new NotFoundError(
              "Členství na této Nástěnce nebylo nalezeno.",
            );
          }

          // C. Ověření sole owner invariantu
          const isSoleOwner = targetMembership.role === "OWNER";

          // D. Načtení členství Actora
          let actorMembership: ActorMembership | null = null;
          if (actor.global_role !== "ADMIN") {
            const memberRecord = await memberships.findByBoardAndUser(
              boardId,
              actor.actor_user_id,
            );
            if (memberRecord) {
              actorMembership = { role: memberRecord.role };
            }
          }

          const target: MembershipAuthorizationTarget = {
            boardId,
            isBoardDeleted: false,
            targetUserId,
            targetRole: targetMembership.role,
            isSoleOwner,
          };

          // E. Autorizace přes MembershipPolicy
          const authResult = checkMembershipPermission(
            actor,
            boardId,
            actorMembership,
            target,
            "MEMBER_REMOVE",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // F. Smazání členství
          await memberships.delete(boardId, targetUserId);

          // G. Kaskádové ošetření úkolů na této Nástěnce
          if (tasks) {
            const boardTasks = await tasks.findByBoardId(boardId);
            for (const t of boardTasks) {
              // Pokud byl odebraný člen hlavním řešitelem, úkol přechází do Nepřiřazeno
              if (t.assigneeId === targetUserId) {
                await tasks.update(t.id, { assigneeId: null });
                // Invariant: Úkol bez řešitele nesmí mít spoluřešitele
                if (taskParticipants) {
                  await taskParticipants.removeAllForTask(t.id);
                }
              }

              // Pokud byl spoluřešitelem, odebereme ho
              if (taskParticipants) {
                await taskParticipants.removeParticipant(t.id, targetUserId);
              }
            }
          }

          return {
            boardId,
            removedUserId: targetUserId,
          };
        },
      );

      return ok(output);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
