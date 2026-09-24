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
import { checkAreaPermission } from "../policies/area-policy.ts";

export interface DeleteAreaInput {
  readonly areaId: string;
  readonly confirmation: string;
}

/**
 * Use Case: Řízené definitivní smazání Oblasti (DeleteArea).
 *
 * Pravidla (docs/020_Pozadavky.md §4.3, docs/050_Architektura.md §11.7.3):
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board musí existovat a nesmí být smazán (soft-delete).
 * 3. Oprávnění: pouze OWNER a MANAGER (a ADMIN).
 * 4. Vyžaduje přesné ruční potvrzení slovem "SMAZAT".
 * 5. Kaskádový důsledek: definitivně maže oblast a všechny úkoly do ní zařazené (ON DELETE CASCADE).
 */
export class DeleteAreaUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: DeleteAreaInput,
  ): Promise<Result<void, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla ──────────────────────────────────
    const areaId = input.areaId?.trim();
    if (!areaId || areaId.length === 0) {
      return err(new ValidationError("ID oblasti je povinné."));
    }

    if (input.confirmation !== "SMAZAT") {
      return err(
        new ValidationError(
          "Pro smazání oblasti je vyžadováno přesné potvrzení textem 'SMAZAT'.",
        ),
      );
    }

    // ── 3. Transakční provedení ────────────────────────────────
    try {
      await this.uow.runInTransaction(
        async ({ boards, memberships, areas, tasks }) => {
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
            "AREA_DELETE",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // E. Kaskádové smazání v aplikační vrstvě (pro in-memory repos v testech)
          if (tasks) {
            const areaTasks = await tasks.findByAreaId(area.id);
            for (const t of areaTasks) {
              await tasks.delete(t.id);
            }
          }

          // F. Fyzické smazání oblasti (PostgreSQL CASCADE se postará o relační vazby v DB)
          await areas.delete(area.id);
        },
      );

      return ok(undefined);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
