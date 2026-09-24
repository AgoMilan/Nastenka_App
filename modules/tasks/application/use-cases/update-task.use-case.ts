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
  ActorTaskRelationship,
  TaskAuthorizationTarget,
} from "../policies/task-authorization.ts";
import type { TaskRecord } from "../ports/task-repository.port.ts";

export interface UpdateTaskInput {
  readonly taskId: string;
  readonly title?: string;
  readonly description?: string | null;
}

/**
 * Use Case: Úprava názvu a/nebo popisu úkolu (UpdateTask).
 *
 * Pravidla:
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board nesmí být smazán.
 * 3. Oprávnění: TASK_EDIT_TITLE a TASK_EDIT_DESCRIPTION povoleno všem členům Nástěnky, řešitelům i spoluřešitelům.
 */
export class UpdateTaskUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: UpdateTaskInput,
  ): Promise<Result<TaskRecord, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla ──────────────────────────────────
    const taskId = input.taskId?.trim();
    if (!taskId || taskId.length === 0) {
      return err(new ValidationError("ID úkolu je povinné."));
    }

    if (input.title === undefined && input.description === undefined) {
      return err(
        new ValidationError("Je nutné zadat alespoň název nebo popis úkolu."),
      );
    }

    let trimmedTitle: string | undefined;
    if (input.title !== undefined) {
      trimmedTitle = input.title.trim();
      if (trimmedTitle.length === 0) {
        return err(new ValidationError("Název úkolu nesmí být prázdný."));
      }
      if (trimmedTitle.length > 255) {
        return err(
          new ValidationError("Název úkolu nesmí přesáhnout 255 znaků."),
        );
      }
    }

    // ── 3. Transakční provedení ────────────────────────────────
    try {
      const updated = await this.uow.runInTransaction(
        async ({ boards, memberships, tasks, taskParticipants }) => {
          if (!tasks) {
            throw new Error("TaskRepository není dostupné v UnitOfWork.");
          }

          // A. Načtení úkolu pro aktualizaci s uzamčením řádku
          const task = await tasks.findByIdForUpdate(taskId);
          if (!task) {
            throw new NotFoundError("Úkol nebyl nalezen.");
          }

          // B. Kontrola smazané Nástěnky
          const board = await boards.findById(task.boardId);
          if (!board) {
            throw new NotFoundError("Nástěnka nebyla nalezena.");
          }
          if (board.deletedAt !== null) {
            throw new AuthorizationError(
              "Nástěnka je smazána.",
              "BOARD_DELETED",
            );
          }

          // C. Načtení členství a vztahu k úkolu
          let actorMembership: ActorMembership | null = null;
          if (actor.global_role !== "ADMIN") {
            const memberRecord = await memberships.findByBoardAndUser(
              task.boardId,
              actor.actor_user_id,
            );
            if (memberRecord) {
              actorMembership = { role: memberRecord.role };
            }
          }

          const isAssignee = task.assigneeId === actor.actor_user_id;
          let isParticipant = false;
          if (taskParticipants) {
            const participantRecord = await taskParticipants.findByTaskAndUser(
              task.id,
              actor.actor_user_id,
            );
            isParticipant = participantRecord !== null;
          }

          const target: TaskAuthorizationTarget = {
            boardId: task.boardId,
            taskId: task.id,
            createdBy: task.createdBy,
            assigneeId: task.assigneeId,
            isBoardDeleted: false,
          };

          const rel: ActorTaskRelationship = {
            isAssignee,
            isParticipant,
          };

          // D. Autorizace dle změněných polí
          if (trimmedTitle !== undefined) {
            const authTitle = checkTaskPermission(
              actor,
              task.boardId,
              actorMembership,
              target,
              rel,
              "TASK_EDIT_TITLE",
            );
            if (!authTitle.allowed) {
              if (authTitle.reason === "UNAUTHENTICATED") {
                throw new AuthenticationError();
              }
              throw new AuthorizationError(undefined, authTitle.reason);
            }
          }

          if (input.description !== undefined) {
            const authDesc = checkTaskPermission(
              actor,
              task.boardId,
              actorMembership,
              target,
              rel,
              "TASK_EDIT_DESCRIPTION",
            );
            if (!authDesc.allowed) {
              if (authDesc.reason === "UNAUTHENTICATED") {
                throw new AuthenticationError();
              }
              throw new AuthorizationError(undefined, authDesc.reason);
            }
          }

          // E. Aktualizace úkolu
          return await tasks.update(task.id, {
            title: trimmedTitle,
            description: input.description,
          });
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
