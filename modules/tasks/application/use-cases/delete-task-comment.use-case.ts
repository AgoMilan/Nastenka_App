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

export interface DeleteTaskCommentInput {
  readonly boardId: string;
  readonly taskId: string;
  readonly commentId: string;
}

/**
 * Use Case: Smazání komentáře (DeleteTaskComment).
 *
 * Invarianty (STEP 8):
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Nástěnka nesmí být smazána (soft-deleted).
 * 3. Komentář musí existovat a patřit k danému úkolu.
 * 4. Úkol musí existovat a patřit do dané Nástěnky (cross-board ochrana).
 * 5. U archivovaného úkolu (status ARCHIVOVÁNO) je mazání komentářů zakázáno (TASK_ARCHIVED).
 * 6. Pouze autor smí smazat svůj vlastní komentář (author-only delete; platí i pro ADMIN/OWNER/MANAGER).
 */
export class DeleteTaskCommentUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: DeleteTaskCommentInput,
  ): Promise<Result<void, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validace vstupů ────────────────────────────────────
    const boardId = input.boardId?.trim();
    const taskId = input.taskId?.trim();
    const commentId = input.commentId?.trim();

    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID nástěnky je povinné."));
    }
    if (!taskId || taskId.length === 0) {
      return err(new ValidationError("ID úkolu je povinné."));
    }
    if (!commentId || commentId.length === 0) {
      return err(new ValidationError("ID komentáře je povinné."));
    }

    // ── 3. Transakční provedení v Unit of Work ─────────────────
    try {
      await this.uow.runInTransaction(
        async ({
          boards,
          memberships,
          tasks,
          taskParticipants,
          taskComments,
          auditLogs,
        }) => {
          if (!tasks || !taskComments) {
            throw new Error(
              "TaskRepository nebo TaskCommentRepository není dostupné v UnitOfWork.",
            );
          }

          // A. Načtení komentáře
          const comment = await taskComments.findById(commentId);
          if (!comment) {
            throw new NotFoundError("Komentář nebyl nalezen.");
          }
          if (comment.taskId !== taskId) {
            throw new AuthorizationError(
              "Komentář nepatří k zadanému úkolu.",
              "CROSS_BOARD_ACCESS",
            );
          }

          // B. Načtení existence Nástěnky
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

          // C. Načtení úkolu
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

          // D. Načtení členství a vztahu k úkolu
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
            commentAuthorId: comment.authorId,
            isBoardDeleted: false,
          };

          const rel: ActorTaskRelationship = {
            isAssignee,
            isParticipant,
          };

          // E. Autorizace přes TaskPolicy
          const authResult = checkTaskPermission(
            actor,
            boardId,
            actorMembership,
            target,
            rel,
            "TASK_COMMENT_DELETE_OWN",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "TASK_ARCHIVED") {
              throw new AuthorizationError(
                "Nelze mazat komentáře u archivovaného úkolu.",
                "TASK_ARCHIVED",
              );
            }
            if (authResult.reason === "NOT_COMMENT_AUTHOR") {
              throw new AuthorizationError(
                "Můžete smazat pouze vlastní komentář.",
                "NOT_COMMENT_AUTHOR",
              );
            }
            throw new AuthorizationError(
              "Nemáte oprávnění smazat tento komentář.",
              authResult.reason,
            );
          }

          // F. Provedení smazání komentáře
          await taskComments.delete(commentId);

          if (auditLogs) {
            await auditLogs.log({
              actorUserId: actor.actor_user_id,
              boardId: task.boardId,
              operation: "TASK_COMMENT_DELETED",
              targetId: comment.id,
              previousState: { taskId: task.id },
              newState: null,
            });
          }
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
