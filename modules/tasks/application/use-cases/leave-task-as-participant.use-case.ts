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

export interface LeaveTaskAsParticipantInput {
  readonly taskId: string;
}

/**
 * Use Case: Odpojení se z úkolu jako Spoluřešitel (LeaveTaskAsParticipant).
 *
 * Pravidla:
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board nesmí být smazán.
 * 3. Invariant: Uživatel smí přes tuto operaci odpojit VÝHRADNĚ sám sebe (CANNOT_LEAVE_OTHER_PARTICIPANT).
 * 4. Uživatel musí být aktuálně spoluřešitelem úkolu.
 */
export class LeaveTaskAsParticipantUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: LeaveTaskAsParticipantInput,
  ): Promise<Result<void, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla ──────────────────────────────────
    const taskId = input.taskId?.trim();
    if (!taskId || taskId.length === 0) {
      return err(new ValidationError("ID úkolu je povinné."));
    }

    // ── 3. Transakční provedení ────────────────────────────────
    try {
      await this.uow.runInTransaction(
        async ({ boards, memberships, tasks, taskParticipants }) => {
          if (!tasks || !taskParticipants) {
            throw new Error(
              "TaskRepository nebo TaskParticipantRepository není dostupné v UnitOfWork.",
            );
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

          // C. Ověření, že Actor je spoluřešitelem
          const participantRecord = await taskParticipants.findByTaskAndUser(
            task.id,
            actor.actor_user_id,
          );
          if (!participantRecord) {
            throw new NotFoundError(
              "Uživatel není spoluřešitelem tohoto úkolu.",
            );
          }

          // D. Načtení členství Actora a vyhodnocení autorizace
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

          const target: TaskAuthorizationTarget = {
            boardId: task.boardId,
            taskId: task.id,
            createdBy: task.createdBy,
            assigneeId: task.assigneeId,
            targetUserId: actor.actor_user_id,
            isBoardDeleted: false,
          };

          const rel: ActorTaskRelationship = {
            isAssignee: task.assigneeId === actor.actor_user_id,
            isParticipant: true,
          };

          const authResult = checkTaskPermission(
            actor,
            task.boardId,
            actorMembership,
            target,
            rel,
            "TASK_LEAVE_AS_PARTICIPANT",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // E. Odstranění spoluřešitele
          await taskParticipants.removeParticipant(
            task.id,
            actor.actor_user_id,
          );
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
