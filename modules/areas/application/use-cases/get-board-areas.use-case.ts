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
import type {
  BoardRepository,
  MembershipRepository,
} from "../../../boards/application/ports/index.ts";
import { checkAreaPermission } from "../policies/area-policy.ts";
import type {
  AreaRecord,
  AreaRepository,
} from "../ports/area-repository.port.ts";

export type AreaView = AreaRecord;

/**
 * Use Case: Získání seznamu Oblastí pro danou Nástěnku (GetBoardAreas).
 *
 * Invarianty (ADR-009, docs/020_Pozadavky.md §4, docs/050_Architektura.md §35.14):
 * 1. Actor musí být přihlášen a aktivní (AuthenticationError).
 * 2. Nástěnka musí existovat a nesmí být smazána (soft-deleted -> NotFoundError).
 * 3. Oprávnění dle AreaPolicy: AREA_VIEW je povoleno pro OWNER, MANAGER, MEMBER i systémového ADMINa.
 * 4. Nečlen Nástěnky bez role ADMIN obdrží AuthorizationError(NOT_A_MEMBER).
 * 5. Oblasti jsou vráceny výhradně pro danou Nástěnku (přísná board izolace).
 * 6. Výsledek je deterministicky seřazen podle názvu oblasti.
 */
export class GetBoardAreasUseCase {
  private readonly boardRepo: BoardRepository;
  private readonly membershipRepo: MembershipRepository;
  private readonly areaRepo: AreaRepository;

  constructor(
    boardRepo: BoardRepository,
    membershipRepo: MembershipRepository,
    areaRepo: AreaRepository,
  ) {
    this.boardRepo = boardRepo;
    this.membershipRepo = membershipRepo;
    this.areaRepo = areaRepo;
  }

  async execute(
    actor: ActorContext | null,
    boardId: string,
  ): Promise<Result<AreaView[], AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla vstupu ───────────────────────────
    const trimmedBoardId = boardId?.trim();
    if (!trimmedBoardId || trimmedBoardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
    }

    // ── 3. Existence a stav Nástěnky ───────────────────────────
    const board = await this.boardRepo.findById(trimmedBoardId);
    if (!board || board.deletedAt !== null) {
      return err(new NotFoundError("Nástěnka nebyla nalezena."));
    }

    // ── 4. Načtení členství pro autorizaci ─────────────────────
    let actorMembership: ActorMembership | null = null;
    if (actor.global_role !== "ADMIN") {
      const memberRecord = await this.membershipRepo.findByBoardAndUser(
        trimmedBoardId,
        actor.actor_user_id,
      );
      if (memberRecord) {
        actorMembership = { role: memberRecord.role };
      }
    }

    // ── 5. Vyhodnocení oprávnění přes AreaPolicy ───────────────
    const authResult = checkAreaPermission(
      actor,
      trimmedBoardId,
      actorMembership,
      {
        boardId: trimmedBoardId,
        areaId: "all",
        isBoardDeleted: false,
      },
      "AREA_VIEW",
    );

    if (!authResult.allowed) {
      if (authResult.reason === "UNAUTHENTICATED") {
        return err(new AuthenticationError());
      }
      return err(new AuthorizationError(undefined, authResult.reason));
    }

    // ── 6. Načtení oblastí pro danou Nástěnku ──────────────────
    const areaRecords = await this.areaRepo.findByBoardId(trimmedBoardId);

    // ── 7. Deterministické seřazení podle názvu abecedně ──────
    const sortedAreas = [...areaRecords].sort((a, b) =>
      a.name.localeCompare(b.name, "cs"),
    );

    return ok(sortedAreas);
  }
}
