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

export interface UpdateAreaInput {
  readonly areaId: string;
  readonly name?: string;
  readonly description?: string | null;
}

/**
 * Use Case: Úprava existující Oblasti (UpdateArea).
 *
 * Pravidla:
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board musí existovat a nesmí být smazán (soft-delete).
 * 3. Oprávnění dle AreaPolicy: AREA_EDIT povoleno pro ADMIN, OWNER a MANAGER.
 * 4. Zachovává příslušnost k Nástěnce (boardId nelze měnit).
 * 5. Kontrola unikátnosti názvu v rámci Nástěnky.
 */
export class UpdateAreaUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: UpdateAreaInput,
  ): Promise<Result<AreaRecord, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla ──────────────────────────────────
    const areaId = input.areaId?.trim();
    if (!areaId || areaId.length === 0) {
      return err(new ValidationError("ID oblasti je povinné."));
    }

    if (input.name === undefined && input.description === undefined) {
      return err(
        new ValidationError("Je nutné zadat alespoň název nebo popis oblasti."),
      );
    }

    let trimmedName: string | undefined;
    if (input.name !== undefined) {
      trimmedName = input.name.trim();
      if (trimmedName.length === 0) {
        return err(new ValidationError("Název oblasti nesmí být prázdný."));
      }
      if (trimmedName.length > 255) {
        return err(
          new ValidationError("Název oblasti nesmí přesáhnout 255 znaků."),
        );
      }
    }

    // ── 3. Transakční provedení ────────────────────────────────
    try {
      const updatedArea = await this.uow.runInTransaction(
        async ({ boards, memberships, areas }) => {
          if (!areas) {
            throw new Error("AreaRepository není dostupné v UnitOfWork.");
          }

          // A. Načtení oblasti
          const area = await areas.findById(areaId);
          if (!area) {
            throw new NotFoundError("Oblast nebyla nalezena.");
          }

          // B. Kontrola existence Nástěnky
          const board = await boards.findById(area.boardId);
          if (!board) {
            throw new NotFoundError("Nástěnka nebyla nalezena.");
          }
          if (board.deletedAt !== null) {
            throw new AuthorizationError(
              "Nástěnka je smazána.",
              "BOARD_DELETED",
            );
          }

          // C. Načtení členství
          let actorMembership: ActorMembership | null = null;
          if (actor.global_role !== "ADMIN") {
            const memberRecord = await memberships.findByBoardAndUser(
              area.boardId,
              actor.actor_user_id,
            );
            if (memberRecord) {
              actorMembership = { role: memberRecord.role };
            }
          }

          // D. Autorizace přes AreaPolicy
          const authResult = checkAreaPermission(
            actor,
            area.boardId,
            actorMembership,
            {
              boardId: area.boardId,
              areaId: area.id,
              isBoardDeleted: false,
            },
            "AREA_EDIT",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // E. Kontrola unikátnosti názvu (pokud se mění)
          if (trimmedName !== undefined && trimmedName !== area.name) {
            const existing = await areas.findByBoardAndName(
              area.boardId,
              trimmedName,
            );
            if (existing && existing.id !== area.id) {
              throw new ConflictError(
                "Oblast s tímto názvem na Nástěnce již existuje.",
              );
            }
          }

          // F. Aktualizace oblasti
          return await areas.update(area.id, {
            name: trimmedName,
            description: input.description,
          });
        },
      );

      return ok(updatedArea);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
