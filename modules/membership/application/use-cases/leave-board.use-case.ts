import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import type { ActorMembership } from "../../../boards/application/policies/board-authorization.ts";
import type { UnitOfWork } from "../../../boards/application/ports/unit-of-work.port.ts";
import { checkMembershipPermission } from "../policies/membership-policy.ts";
import type { MembershipAuthorizationTarget } from "../policies/membership-authorization.ts";

export interface LeaveBoardInput {
  readonly boardId: string;
}

export interface LeaveBoardOutput {
  readonly boardId: string;
  readonly userId: string;
}

/**
 * Use Case: Dobrovolný odchod člena z Nástěnky (LeaveBoard).
 *
 * Pravidla (docs/020_Pozadavky.md §9, docs/050_Architektura.md §8.8.4, §10.4.2, TD-07):
 * 1. Actor musí být přihlášen a aktivní (identita odcházejícího uživatele je určena výhradně ze serverového ActorContextu).
 * 2. Board musí existovat a nesmí být smazán (soft-deleted).
 * 3. Actor musí mít existující členství na dané Nástěnce (jinak NotFoundError).
 * 4. Oprávnění: MEMBER_LEAVE dle MembershipPolicy:
 *    - MEMBER: smí dobrovolně opustit Nástěnku (ALLOW)
 *    - MANAGER: smí dobrovolně opustit Nástěnku (ALLOW)
 *    - ADMIN: pokud má roli MEMBER/MANAGER na Nástěnce, smí opustit; pokud má roli OWNER, nesmí opustit bez převodu
 *    - OWNER: nesmí opustit Nástěnku bez předchozího převodu vlastnictví (ConflictError / Invariant 1)
 * 5. Strukturální invarianty:
 *    - Aktivní Nástěnka musí mít v každém okamžiku právě 1 OWNER (Invariant 1).
 *    - Odchod OWNERa bez převodu vlastnictví je přísně zakázán (CANNOT_REMOVE_SOLE_OWNER -> 409 ConflictError).
 * 6. Kaskádové ošetření úkolů (docs/020_Pozadavky.md §9.1, docs/050_Architektura.md §10.4.2):
 *    - Pokud byl odcházející člen Hlavním Řešitelem úkolu, úkol přejde do stavu Nepřiřazeno (assigneeId = null) a jeho spoluřešitelé jsou uvolněni.
 *    - Pokud byl odcházející člen spoluřešitelem, je z úkolu odstraněn.
 * 7. Zamykání pro souběh přes findByIdForUpdate na úrovni Boardu.
 */
export class LeaveBoardUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: LeaveBoardInput,
  ): Promise<Result<LeaveBoardOutput, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla vstupu ───────────────────────────
    const boardId = input.boardId?.trim();
    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
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

          // B. Načtení členství Actora na této Nástěnce
          const memberRecord = await memberships.findByBoardAndUser(
            boardId,
            actor.actor_user_id,
          );
          if (!memberRecord) {
            throw new NotFoundError(
              "Členství na této Nástěnce nebylo nalezeno.",
            );
          }

          const actorMembership: ActorMembership = { role: memberRecord.role };

          const target: MembershipAuthorizationTarget = {
            boardId,
            isBoardDeleted: false,
            targetUserId: actor.actor_user_id,
            targetRole: memberRecord.role,
            isSoleOwner: memberRecord.role === "OWNER",
          };

          // C. Autorizace přes MembershipPolicy
          const authResult = checkMembershipPermission(
            actor,
            boardId,
            actorMembership,
            target,
            "MEMBER_LEAVE",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            if (authResult.reason === "CANNOT_REMOVE_SOLE_OWNER") {
              throw new ConflictError(
                "Vlastník nemůže opustit Nástěnku bez předchozího převodu vlastnictví.",
              );
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // D. Smazání členství odcházejícího uživatele
          await memberships.delete(boardId, actor.actor_user_id);

          // E. Kaskádové ošetření úkolů na této Nástěnce
          if (tasks) {
            const boardTasks = await tasks.findByBoardId(boardId);
            for (const t of boardTasks) {
              // Pokud byl odcházející člen hlavním řešitelem, úkol přechází do Nepřiřazeno
              if (t.assigneeId === actor.actor_user_id) {
                await tasks.update(t.id, { assigneeId: null });
                // Invariant: Úkol bez řešitele nesmí mít spoluřešitele
                if (taskParticipants) {
                  await taskParticipants.removeAllForTask(t.id);
                }
              } else if (taskParticipants) {
                // Pokud byl spoluřešitelem, odebereme ho
                await taskParticipants.removeParticipant(
                  t.id,
                  actor.actor_user_id,
                );
              }
            }
          }

          return {
            boardId,
            userId: actor.actor_user_id,
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
