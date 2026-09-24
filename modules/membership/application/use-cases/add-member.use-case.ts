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
import type {
  BoardRole,
  MembershipRecord,
} from "../../../boards/application/ports/membership-repository.port.ts";
import { checkMembershipPermission } from "../policies/membership-policy.ts";
import type { MembershipAuthorizationTarget } from "../policies/membership-authorization.ts";

export interface AddMemberInput {
  readonly boardId: string;
  readonly targetUserId: string;
  readonly role?: BoardRole;
}

/**
 * Use Case: Přidání člena do Nástěnky (AddMember).
 *
 * Pravidla:
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board musí existovat a nesmí být smazán (soft-deleted).
 * 3. Cílový uživatel musí existovat a být aktivní.
 * 4. Cílový uživatel nesmí již být členem dané Nástěnky (UNIQUE user_id, board_id).
 * 5. Oprávnění: MEMBER_ADD dle MembershipPolicy:
 *    - ADMIN: smí přidat člena s rolí MEMBER i MANAGER
 *    - OWNER: smí přidat člena s rolí MEMBER i MANAGER (pokud není překročen limit manažerů)
 *    - MANAGER: smí přidat člena VÝHRADNĚ s rolí MEMBER
 *    - MEMBER: nesmí přidávat členy
 * 6. Invarianty:
 *    - Přidání s rolí OWNER je zakázáno (vyžaduje samostatný proces).
 *    - Max. 1 MANAGER na Nástěnku (pokud již Manager existuje, jmenování dalšího je zamítnuto).
 * 7. Zamykání pro souběh přes findByIdForUpdate na úrovni Boardu.
 */
export class AddMemberUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: AddMemberInput,
  ): Promise<Result<MembershipRecord, AppError>> {
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

    const desiredRole: BoardRole = input.role ?? "MEMBER";
    if (
      desiredRole !== "MEMBER" &&
      desiredRole !== "MANAGER" &&
      desiredRole !== "OWNER"
    ) {
      return err(new ValidationError("Neplatná role člena."));
    }

    // ── 3. Transakční provedení ────────────────────────────────
    try {
      const created = await this.uow.runInTransaction(
        async ({ boards, memberships, users }) => {
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

          // B. Ověření existence a aktivity cílového uživatele
          const targetUser = await users.findById(targetUserId);
          if (!targetUser) {
            throw new NotFoundError("Cílový uživatel nebyl nalezen.");
          }
          if (!targetUser.isActive || targetUser.deletedAt !== null) {
            throw new ValidationError("Cílový uživatel není aktivní.");
          }

          // C. Ověření, že cílový uživatel dosud není členem Nástěnky
          const existing = await memberships.findByBoardAndUser(
            boardId,
            targetUserId,
          );
          if (existing) {
            throw new ConflictError("Uživatel již je členem této Nástěnky.");
          }

          // D. Zjištění, zda Nástěnka již má existujícího Managera
          const allMembers = await memberships.findMembershipsByBoard(boardId);
          const hasExistingManager = allMembers.some(
            (m) => m.role === "MANAGER",
          );

          // E. Načtení členství Actora
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
            targetRole: null,
            newRole: desiredRole,
            hasExistingManager,
          };

          // F. Autorizace přes MembershipPolicy
          const authResult = checkMembershipPermission(
            actor,
            boardId,
            actorMembership,
            target,
            "MEMBER_ADD",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // G. Vytvoření členství
          return await memberships.create({
            boardId,
            userId: targetUserId,
            role: desiredRole,
          });
        },
      );

      return ok(created);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
