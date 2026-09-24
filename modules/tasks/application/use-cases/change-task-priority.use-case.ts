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
import type {
  TaskPriority,
  TaskRecord,
} from "../ports/task-repository.port.ts";

export interface ChangeTaskPriorityInput {
  readonly taskId: string;
  readonly priority: TaskPriority;
}

/**
 * Use Case: Změna priority úkolu (ChangeTaskPriority).
 *
 * Pravidla:
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board nesmí být smazán.
 * 3. Oprávnění: TASK_SET_PRIORITY (povoleno všem členům Nástěnky).
 * 4. Povolené hodnoty: pouze "BĚŽNÁ" a "SPĚCHÁ".
 */
export class ChangeTaskPriorityUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: ChangeTaskPriorityInput,
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

    if (input.priority !== "BĚŽNÁ" && input.priority !== "SPĚCHÁ") {
      return err(new ValidationError("Neplatná priorita úkolu."));
    }

    // ── 3. Transakční provedení ────────────────────────────────
    try {
      const updated = await this.uow.runInTransaction(
        async ({ boards, memberships, tasks, taskParticipants }) => {
          if (!tasks) {
            throw new Error("TaskRepository není dostupné v UnitOfWork.");
          }

          // A. Načtení úkolu pro update
          const task = await tasks.findByIdForUpdate(taskId);
          if (!task) {
            throw new NotFoundError("Úkol nebyl nalezen.");
          }

          // B. Kontrola existence Nástěnky
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

          // C. Načtení členství Actora a vztahu k úkolu
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

          // D. Autorizace přes TaskPolicy
          const authResult = checkTaskPermission(
            actor,
            task.boardId,
            actorMembership,
            target,
            rel,
            "TASK_SET_PRIORITY",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // E. Aktualizace priority
          return await tasks.update(task.id, {
            priority: input.priority,
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
