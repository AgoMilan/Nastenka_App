import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import type {
  BoardRecord,
  MembershipRecord,
  UnitOfWork,
} from "../ports/index.ts";

export interface CreateBoardInput {
  readonly name: string;
  readonly description?: string | null;
  /**
   * Volitelné cílové ID uživatele, který má být OWNERem.
   * Povoleno VÝHRADNĚ pro globálního ADMINa (vytvoření Nástěnky pro jiného uživatele).
   * Běžný uživatel se vždy stává OWNERem sám.
   */
  readonly targetUserId?: string;
}

export interface CreateBoardOutput {
  readonly board: BoardRecord;
  readonly ownerMembership: MembershipRecord;
}

/**
 * Use Case: Vytvoření nové Nástěnky (CreateBoard).
 *
 * Invarianty (ADR-009, docs/050_Architektura.md §10.3.1, §10.12):
 * 1. Každý přihlášený a aktivní uživatel smí vytvořit Nástěnku.
 * 2. Vytvoření je striktně atomické v rámci jedné transakce (Unit of Work):
 *    - INSERT do tabulky boards (createdBy = actor.actor_user_id)
 *    - INSERT do tabulky memberships (role = OWNER, userId = ownerUserId)
 * 3. Nikdy nesmí vzniknout Nástěnka bez vlastníka (0 Ownerů).
 * 4. Při selhání libovolného kroku dojde k ROLLBACKU.
 */
export class CreateBoardUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: CreateBoardInput,
  ): Promise<Result<CreateBoardOutput, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Určení cílového vlastníka a autorizace ──────────────
    let ownerUserId = actor.actor_user_id;

    if (input.targetUserId && input.targetUserId !== actor.actor_user_id) {
      if (actor.global_role !== "ADMIN") {
        return err(
          new AuthorizationError(
            "Pouze administrátor může vytvořit Nástěnku pro jiného vlastníka.",
            "INSUFFICIENT_ROLE",
          ),
        );
      }
      ownerUserId = input.targetUserId;
    }

    // ── 3. Validační pravidla ──────────────────────────────────
    const trimmedName = input.name?.trim();
    if (!trimmedName || trimmedName.length === 0) {
      return err(new ValidationError("Název Nástěnky nesmí být prázdný."));
    }
    if (trimmedName.length > 255) {
      return err(
        new ValidationError("Název Nástěnky nesmí přesáhnout 255 znaků."),
      );
    }

    // ── 4. Atomické vytvoření v transakci ──────────────────────
    try {
      const result = await this.uow.runInTransaction(
        async ({ boards, memberships, users }) => {
          // Pokud je specifikován jiný vlastník pro ADMINa, ověříme jeho existenci a aktivitu
          if (
            input.targetUserId &&
            input.targetUserId !== actor.actor_user_id
          ) {
            const targetUser = await users.findById(input.targetUserId);
            if (
              !targetUser ||
              !targetUser.isActive ||
              targetUser.deletedAt !== null
            ) {
              throw new ValidationError(
                "Cílový uživatel pro vlastnictví Nástěnky neexistuje nebo není aktivní.",
              );
            }
          }

          const board = await boards.create({
            name: trimmedName,
            description: input.description ?? null,
            createdBy: actor.actor_user_id,
          });

          const ownerMembership = await memberships.create({
            boardId: board.id,
            userId: ownerUserId,
            role: "OWNER",
          });

          return { board, ownerMembership };
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
