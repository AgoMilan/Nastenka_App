import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import { checkBoardPermission } from "../policies/board-policy.ts";
import type {
  BoardRecord,
  BoardRepository,
  BoardRole,
  MembershipRepository,
} from "../ports/index.ts";

export interface BoardDetailOutput {
  readonly board: BoardRecord;
  readonly role: BoardRole | null;
}

/**
 * Use Case: Získání detailu Nástěnky pro zobrazení / kontejner (Board Detail).
 *
 * Invarianty (docs/050_Architektura.md §30.8, §35.14):
 * 1. Vyžaduje platný a aktivní ActorContext (neautentizovaný volající obdrží AuthenticationError).
 * 2. Ověřuje existenci Nástěnky (neexistující -> NotFoundError).
 * 3. Soft-deleted Nástěnka je striktně nedostupná (NotFoundError / BOARD_DELETED).
 * 4. Autorizace probíhá přes BoardPolicy (checkBoardPermission pro akci BOARD_VIEW):
 *    - Členové (OWNER, MANAGER, MEMBER) mají přístup povolen.
 *    - Globální ADMIN má přístup povolen i bez přímého členství.
 *    - Nečlen obdrží AuthorizationError(NOT_A_MEMBER).
 */
export class GetBoardDetailUseCase {
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
    boardId: string,
  ): Promise<Result<BoardDetailOutput, AppError>> {
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    const trimmedId = boardId?.trim();
    if (!trimmedId) {
      return err(new ValidationError("ID Nástěnky nesmí být prázdné."));
    }

    const board = await this.boardRepo.findById(trimmedId);
    if (!board || board.deletedAt !== null) {
      return err(new NotFoundError("Nástěnka nebyla nalezena."));
    }

    const membership = await this.membershipRepo.findByBoardAndUser(
      trimmedId,
      actor.actor_user_id,
    );

    const authResult = checkBoardPermission(
      actor,
      { boardId: board.id, isDeleted: board.deletedAt !== null },
      membership ? { role: membership.role } : null,
      "BOARD_VIEW",
    );

    if (!authResult.allowed) {
      return err(new AuthorizationError(undefined, authResult.reason));
    }

    return ok({
      board,
      role: membership ? membership.role : null,
    });
  }
}
