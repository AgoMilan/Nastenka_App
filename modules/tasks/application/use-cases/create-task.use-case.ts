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
import { checkTaskPermission } from "../policies/task-policy.ts";
import type {
  TaskPriority,
  TaskRecord,
} from "../ports/task-repository.port.ts";

export interface CreateTaskInput {
  readonly boardId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly areaId?: string | null;
  readonly assigneeId?: string | null;
  readonly dueDate?: Date | string | null;
  readonly priority?: TaskPriority;
}

/**
 * Use Case: Vytvoření nového Úkolu (CreateTask).
 *
 * Pravidla:
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board musí existovat a nesmí být smazán (soft-delete).
 * 3. Oprávnění: TASK_CREATE povoleno všem členům Nástěnky (OWNER, MANAGER, MEMBER, ADMIN).
 * 4. Název úkolu je povinný (1-255 znaků).
 * 5. Cílová oblast (pokud je zadána) musí patřit do stejné Nástěnky.
 * 6. Přiřazený řešitel (pokud je zadán) musí být aktivním členem stejné Nástěnky (zákaz cross-board).
 * 7. Výchozí stav = "NOVÉ", výchozí priorita = "BĚŽNÁ".
 */
export class CreateTaskUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: CreateTaskInput,
  ): Promise<Result<TaskRecord, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla ──────────────────────────────────
    const boardId = input.boardId?.trim();
    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
    }

    const trimmedTitle = input.title?.trim();
    if (!trimmedTitle || trimmedTitle.length === 0) {
      return err(new ValidationError("Název úkolu nesmí být prázdný."));
    }
    if (trimmedTitle.length > 255) {
      return err(
        new ValidationError("Název úkolu nesmí přesáhnout 255 znaků."),
      );
    }

    const priority: TaskPriority = input.priority ?? "BĚŽNÁ";
    if (priority !== "BĚŽNÁ" && priority !== "SPĚCHÁ") {
      return err(new ValidationError("Neplatná priorita úkolu."));
    }

    let parsedDueDate: Date | null = null;
    if (input.dueDate) {
      parsedDueDate =
        input.dueDate instanceof Date ? input.dueDate : new Date(input.dueDate);
      if (isNaN(parsedDueDate.getTime())) {
        return err(new ValidationError("Neplatný formát termínu (dueDate)."));
      }
    }

    // ── 3. Transakční provedení ────────────────────────────────
    try {
      const task = await this.uow.runInTransaction(
        async ({ boards, memberships, users, areas, tasks }) => {
          if (!tasks) {
            throw new Error("TaskRepository není dostupné v UnitOfWork.");
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

          // B. Načtení členství Actora
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

          // C. Autorizace vytvoření úkolu přes TaskPolicy
          const authResult = checkTaskPermission(
            actor,
            boardId,
            actorMembership,
            {
              boardId,
              taskId: "new",
              createdBy: actor.actor_user_id,
              assigneeId: null,
              isBoardDeleted: false,
            },
            {
              isAssignee: false,
              isParticipant: false,
            },
            "TASK_CREATE",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // D. Validace oblasti (pokud je zadána)
          let finalAreaId: string | null = null;
          if (input.areaId) {
            if (!areas) {
              throw new Error("AreaRepository není dostupné v UnitOfWork.");
            }
            const area = await areas.findById(input.areaId);
            if (!area) {
              throw new NotFoundError("Oblast nebyla nalezena.");
            }
            if (area.boardId !== boardId) {
              throw new AuthorizationError(
                "Oblast nepatří do stejné Nástěnky.",
                "CROSS_BOARD_ACCESS",
              );
            }
            finalAreaId = area.id;
          }

          // E. Validace řešitele (pokud je zadán)
          let finalAssigneeId: string | null = null;
          if (input.assigneeId) {
            const assigneeUser = await users.findById(input.assigneeId);
            if (
              !assigneeUser ||
              !assigneeUser.isActive ||
              assigneeUser.deletedAt !== null
            ) {
              throw new ValidationError(
                "Přiřazený řešitel neexistuje nebo není aktivní.",
              );
            }

            const assigneeMembership = await memberships.findByBoardAndUser(
              boardId,
              input.assigneeId,
            );
            if (!assigneeMembership) {
              throw new AuthorizationError(
                "Řešitel musí být aktivním členem stejné Nástěnky.",
                "CROSS_BOARD_ACCESS",
              );
            }
            finalAssigneeId = input.assigneeId;
          }

          // F. Vytvoření úkolu
          return await tasks.create({
            boardId,
            areaId: finalAreaId,
            title: trimmedTitle,
            description: input.description ?? null,
            status: "NOVÉ",
            priority,
            dueDate: parsedDueDate,
            createdBy: actor.actor_user_id,
            assigneeId: finalAssigneeId,
          });
        },
      );

      return ok(task);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
