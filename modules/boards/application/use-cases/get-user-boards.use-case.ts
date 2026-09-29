import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import type { BoardRepository, UserBoardRecord } from "../ports/index.ts";

/**
 * Use Case: Získání seznamu aktivních Nástěnek pro aktuálního přihlášeného uživatele (Moje nástěnky).
 *
 * Invarianty (docs/050_Architektura.md §30.7):
 * 1. Vyžaduje platný a aktivní ActorContext (neautentizovaný volající obdrží AuthenticationError).
 * 2. Běžný USER obdrží výhradně aktivní Nástěnky, kde má platné členství (Membership).
 * 3. Globální ADMIN obdrží všechny aktivní Nástěnky v systému (pokud je na dané Nástěnce členem,
 *    je uvedena jeho konkrétní role, jinak je role null).
 * 4. Soft-deleted Nástěnky (deleted_at IS NOT NULL) jsou ze seznamu VŽDY striktně vyloučeny.
 */
export class GetUserBoardsUseCase {
  private readonly boardRepo: BoardRepository;

  constructor(boardRepo: BoardRepository) {
    this.boardRepo = boardRepo;
  }

  async execute(
    actor: ActorContext | null,
  ): Promise<Result<UserBoardRecord[], AppError>> {
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    if (actor.global_role === "ADMIN") {
      const boards = await this.boardRepo.findActiveBoardsForAdmin(
        actor.actor_user_id,
      );
      return ok(boards);
    }

    const boards = await this.boardRepo.findActiveBoardsForUser(
      actor.actor_user_id,
    );
    return ok(boards);
  }
}
