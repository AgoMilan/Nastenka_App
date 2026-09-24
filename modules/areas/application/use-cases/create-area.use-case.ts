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
import { checkAreaPermission } from "../policies/area-policy.ts";
import type { AreaRecord } from "../ports/area-repository.port.ts";

export interface CreateAreaInput {
  readonly boardId: string;
  readonly name: string;
  readonly description?: string | null;
}

/**
 * Use Case: Vytvoření nové Oblasti (CreateArea).
 *
 * Pravidla (docs/020_Pozadavky.md §4, docs/050_Architektura.md §10.3):
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board musí existovat a nesmí být smazán (soft-delete).
 * 3. Oprávnění dle AreaPolicy: AREA_CREATE povoleno pro ADMIN, OWNER a MANAGER. Běžný MEMBER nemá oprávnění.
 * 4. Název oblasti je povinný (1-255 znaků) a unikátní v rámci dané Nástěnky.
 */
export class CreateAreaUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: CreateAreaInput,
  ): Promise<Result<AreaRecord, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla ──────────────────────────────────
    const boardId = input.boardId?.trim();
    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
    }

    const trimmedName = input.name?.trim();
    if (!trimmedName || trimmedName.length === 0) {
      return err(new ValidationError("Název oblasti nesmí být prázdný."));
    }
    if (trimmedName.length > 255) {
      return err(
        new ValidationError("Název oblasti nesmí přesáhnout 255 znaků."),
      );
    }

    // ── 3. Transakční provedení s autorizací a kontrolou unikátnosti ─
    try {
      const area = await this.uow.runInTransaction(
        async ({ boards, memberships, areas }) => {
          if (!areas) {
            throw new Error("AreaRepository není dostupné v UnitOfWork.");
          }

          // A. Kontrola existence Nástěnky
          const board = await boards.findById(boardId);
          if (!board) {
            throw new NotFoundError("Nástěnka nebyla nalezena.");
          }
          if (board.deletedAt !== null) {
            throw new AuthorizationError(
              "Nástěnka je smazána.",
              "BOARD_DELETED",
            );
          }

          // B. Načtení členství pro autorizaci
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

          // C. Vyhodnocení autorizace přes Policy Engine
          const authResult = checkAreaPermission(
            actor,
            boardId,
            actorMembership,
            {
              boardId,
              areaId: "new",
              isBoardDeleted: false,
            },
            "AREA_CREATE",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // D. Kontrola unikátnosti názvu v rámci Nástěnky
          const existing = await areas.findByBoardAndName(boardId, trimmedName);
          if (existing) {
            throw new ConflictError(
              "Oblast s tímto názvem na Nástěnce již existuje.",
            );
          }

          // E. Vytvoření oblasti
          return await areas.create({
            boardId,
            name: trimmedName,
            description: input.description ?? null,
          });
        },
      );

      return ok(area);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
