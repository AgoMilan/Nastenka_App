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
import type { ActorMembership } from "../policies/board-authorization.ts";
import { checkBoardPermission } from "../policies/board-policy.ts";
import type { UnitOfWork } from "../ports/index.ts";

export interface TransferOwnershipInput {
  readonly boardId: string;
  readonly targetUserId: string;
}

export interface TransferOwnershipOutput {
  readonly boardId: string;
  readonly previousOwner: {
    readonly userId: string;
    readonly newRole: "MANAGER" | "MEMBER";
  };
  readonly newOwner: {
    readonly userId: string;
    readonly newRole: "OWNER";
  };
}

/**
 * Use Case: Převod vlastnictví Nástěnky (TransferOwnership).
 *
 * Invarianty (ADR-009, docs/050_Architektura.md §8.3, §10.5, §10.12):
 * 1. Actor musí být aktuální OWNER Nástěnky nebo globální ADMIN (autorizováno přes BoardPolicy BOARD_TRANSFER_OWNERSHIP).
 * 2. Cílový uživatel musí být stávajícím členem dané Nástěnky.
 * 3. Cílový uživatel musí existovat a být aktivní (nebýt soft-deleted).
 * 4. Cílový uživatel nesmí být totožný se současným Ownerem (nelze převést vlastnictví na sebe sama).
 * 5. Invariant Invariant 1 (přesně 1 OWNER): po commitu má Nástěnka právě 1 platného Ownera.
 * 6. Invariant Invariant 4 (max. 1 MANAGER):
 *    - Pokud je pozice Managera volná (nebo cílový uživatel sám byl oním Managerem),
 *      původní Owner získává roli MANAGER.
 *    - Pokud na Nástěnce již jiný Manager existuje, původní Owner získává roli MEMBER.
 * 7. Změna rolí probíhá v jediné atomické transakci (Unit of Work). Při selhání dojde k ROLLBACKU.
 */
export class TransferOwnershipUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: TransferOwnershipInput,
  ): Promise<Result<TransferOwnershipOutput, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla vstupu ───────────────────────────
    const boardId = input.boardId?.trim();
    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
    }

    const targetUserId = input.targetUserId?.trim();
    if (!targetUserId || targetUserId.length === 0) {
      return err(new ValidationError("ID cílového uživatele je povinné."));
    }

    // ── 3. Transakční provedení s kontrolou invariantů ────────
    try {
      const result = await this.uow.runInTransaction(
        async ({ boards, memberships, users }) => {
          // A. Kontrola existence a stavu Nástěnky s uzamčením řádku pro souběh (FOR UPDATE)
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

          // B. Autorizace Actora přes BoardPolicy
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

          const authResult = checkBoardPermission(
            actor,
            { boardId: board.id, isDeleted: board.deletedAt !== null },
            actorMembership,
            "BOARD_TRANSFER_OWNERSHIP",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(
              "K převodu vlastnictví Nástěnky nemáte dostatečné oprávnění.",
              authResult.reason,
            );
          }

          // C. Nalezení aktuálního vlastníka Nástěnky
          const allMembers = await memberships.findMembershipsByBoard(boardId);
          const currentOwner = allMembers.find((m) => m.role === "OWNER");
          if (!currentOwner) {
            throw new ConflictError(
              "Nástěnka nemá žádného aktivního vlastníka (porušen Invariant 1).",
            );
          }

          // D. Validace cílového uživatele
          if (targetUserId === currentOwner.userId) {
            throw new ConflictError(
              "Cílový uživatel je již vlastníkem Nástěnky.",
            );
          }

          const targetMember = allMembers.find(
            (m) => m.userId === targetUserId,
          );
          if (!targetMember) {
            throw new ValidationError(
              "Cílový uživatel není členem této Nástěnky.",
            );
          }

          const targetUser = await users.findById(targetUserId);
          if (
            !targetUser ||
            !targetUser.isActive ||
            targetUser.deletedAt !== null
          ) {
            throw new ValidationError(
              "Cílový uživatel neexistuje nebo není aktivní.",
            );
          }

          // E. Určení nové role původního Ownera (Invariant max. 1 Manager):
          // Pokud je na Nástěnce jiný člen v roli MANAGER (který není cílem převodu ani stávajícím ownerem),
          // původní Owner se stane MEMBER. V opačném případě získá roli MANAGER.
          const otherManager = allMembers.find(
            (m) =>
              m.role === "MANAGER" &&
              m.userId !== targetUserId &&
              m.userId !== currentOwner.userId,
          );
          const previousOwnerNewRole: "MANAGER" | "MEMBER" = otherManager
            ? "MEMBER"
            : "MANAGER";

          // F. Atomická změna rolí v transakci
          await memberships.updateRole(
            boardId,
            currentOwner.userId,
            previousOwnerNewRole,
          );
          await memberships.updateRole(boardId, targetMember.userId, "OWNER");

          return {
            boardId,
            previousOwner: {
              userId: currentOwner.userId,
              newRole: previousOwnerNewRole,
            },
            newOwner: {
              userId: targetMember.userId,
              newRole: "OWNER" as const,
            },
          };
        },
      );

      return ok(result);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
