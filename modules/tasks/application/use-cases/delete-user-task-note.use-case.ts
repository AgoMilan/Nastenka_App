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

export interface DeleteUserTaskNoteInput {
  readonly boardId: string;
  readonly taskId: string;
}

/**
 * Use Case: Smazání vlastní soukromé poznámky k úkolu (DeleteUserTaskNote).
 *
 * Invarianty (Soukromé poznámky):
 * 1. Actor musí být přihlášen a aktivní (AuthenticationError).
 * 2. Nástěnka nesmí být smazána (soft-deleted -> NotFoundError / BOARD_DELETED).
 * 3. Úkol musí existovat a patřit do dané nástěnky (cross-board ochrana).
 * 4. U archivovaného úkolu (status ARCHIVOVÁNO) je smazání poznámky zakázáno (TASK_ARCHIVED).
 * 5. Uživatel smí smazat VÝHRADNĚ svou vlastní poznámku.
 * 6. Ani ADMIN, OWNER či MANAGER nemůže smazat cizí poznámku (NOT_NOTE_OWNER).
 */
export class DeleteUserTaskNoteUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: DeleteUserTaskNoteInput,
  ): Promise<Result<void, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validace vstupů ────────────────────────────────────
    const boardId = input.boardId?.trim();
    const taskId = input.taskId?.trim();

    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID nástěnky je povinné."));
    }
    if (!taskId || taskId.length === 0) {
      return err(new ValidationError("ID úkolu je povinné."));
    }

    // ── 3. Transakční provedení v Unit of Work ─────────────────
    try {
      await this.uow.runInTransaction(
        async ({ boards, memberships, tasks, taskParticipants, userTaskNotes }) => {
          if (!tasks || !userTaskNotes) {
            throw new Error(
              "TaskRepository nebo UserTaskNoteRepository není dostupné v UnitOfWork.",
            );
          }

          // A. Načtení existence Nástěnky
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

          // B. Načtení úkolu
          const task = await tasks.findById(taskId);
          if (!task) {
            throw new NotFoundError("Úkol nebyl nalezen.");
          }
          if (task.boardId !== boardId) {
            throw new AuthorizationError(
              "Úkol nepatří do zadané nástěnky.",
              "CROSS_BOARD_ACCESS",
            );
          }

          // C. Načtení členství a vztahu k úkolu
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

          const isAssignee = task.assigneeId === actor.actor_user_id;
          let isParticipant = false;
          if (taskParticipants) {
            const participantRecord =
              await taskParticipants.findByTaskAndUser(
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
            status: task.status,
            isBoardDeleted: false,
            noteOwnerUserId: actor.actor_user_id,
          };

          const rel: ActorTaskRelationship = {
            isAssignee,
            isParticipant,
          };

          // D. Autorizace přes TaskPolicy
          const authResult = checkTaskPermission(
            actor,
            boardId,
            actorMembership,
            target,
            rel,
            "TASK_PRIVATE_NOTE_DELETE_OWN",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "TASK_ARCHIVED") {
              throw new AuthorizationError(
                "Nelze mazat soukromou poznámku k archivovanému úkolu.",
                "TASK_ARCHIVED",
              );
            }
            if (authResult.reason === "NOT_NOTE_OWNER") {
              throw new AuthorizationError(
                "Nemáte oprávnění k této soukromé poznámce.",
                "NOT_NOTE_OWNER",
              );
            }
            throw new AuthorizationError(
              "Nemáte oprávnění smazat soukromou poznámku k tomuto úkolu.",
              authResult.reason,
            );
          }

          // E. Smazání poznámky
          await userTaskNotes.delete(actor.actor_user_id, task.id);
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
