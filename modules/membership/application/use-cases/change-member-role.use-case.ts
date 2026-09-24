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
import type {
  BoardRole,
  MembershipRecord,
} from "../../../boards/application/ports/membership-repository.port.ts";
import { checkMembershipPermission } from "../policies/membership-policy.ts";
import type { MembershipAuthorizationTarget } from "../policies/membership-authorization.ts";

export interface ChangeMemberRoleInput {
  readonly boardId: string;
  readonly targetUserId: string;
  readonly newRole: BoardRole;
}

/**
 * Use Case: Změna role člena na Nástěnce (ChangeMemberRole).
 *
 * Pravidla:
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board musí existovat a nesmí být smazán (soft-deleted).
 * 3. Cílový uživatel musí mít existující členství na dané Nástěnce.
 * 4. Idempotence: Pokud má uživatel již požadovanou roli, neprovádí se žádná DB změna.
 * 5. Oprávnění: MEMBER_CHANGE_ROLE dle MembershipPolicy:
 *    - ADMIN: smí měnit role mezi MEMBER a MANAGER
 *    - OWNER: smí měnit role mezi MEMBER a MANAGER
 *    - MANAGER: nesmí měnit role členů (INSUFFICIENT_ROLE)
 *    - MEMBER: nesmí měnit role členů (INSUFFICIENT_ROLE)
 * 6. Strukturální invarianty:
 *    - Zákaz sesazení sole Ownera přes ChangeMemberRole (CANNOT_DEMOTE_SOLE_OWNER).
 *    - Zákaz povýšení na OWNER přes ChangeMemberRole (OWNERSHIP_TRANSFER_REQUIRED) – převod vyžaduje TransferOwnership.
 *    - Invariant max. 1 Manager (MANAGER_LIMIT_EXCEEDED).
 * 7. Zamykání pro souběh přes findByIdForUpdate na úrovni Boardu.
 */
export class ChangeMemberRoleUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: ChangeMemberRoleInput,
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

    const newRole = input.newRole;
    if (newRole !== "MEMBER" && newRole !== "MANAGER" && newRole !== "OWNER") {
      return err(new ValidationError("Neplatná role člena."));
    }

    // ── 3. Transakční provedení ────────────────────────────────
    try {
      const updated = await this.uow.runInTransaction(
        async ({ boards, memberships }) => {
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

          // C. Kontrola existence jiného Managera (pro invariant max. 1 Manager)
          const allMembers = await memberships.findMembershipsByBoard(boardId);
          const hasExistingManager = allMembers.some(
            (m) => m.role === "MANAGER" && m.userId !== targetUserId,
          );

          // D. Ověření sole owner invariantu
          const isSoleOwner = targetMembership.role === "OWNER";

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
            targetRole: targetMembership.role,
            newRole,
            isSoleOwner,
            hasExistingManager,
          };

          // F. Autorizace přes MembershipPolicy
          const authResult = checkMembershipPermission(
            actor,
            boardId,
            actorMembership,
            target,
            "MEMBER_CHANGE_ROLE",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // G. Idempotence: Pokud je role již nastavena a Actor je autorizován, vrátíme beze změny
          if (targetMembership.role === newRole) {
            return targetMembership;
          }

          // H. Provedení změny role
          await memberships.updateRole(boardId, targetUserId, newRole);

          return {
            ...targetMembership,
            role: newRole,
            updatedAt: new Date(),
          };
        },
      );

      return ok(updated);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
