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
import type { TaskCommentRecord } from "../ports/index.ts";

export interface UpdateTaskCommentInput {
  readonly boardId: string;
  readonly taskId: string;
  readonly commentId: string;
  readonly content: string;
}

/**
 * Use Case: Úprava existujícího komentáře (UpdateTaskComment).
 *
 * Invarianty (STEP 8):
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Nástěnka nesmí být smazána (soft-deleted).
 * 3. Komentář musí existovat a patřit k danému úkolu.
 * 4. Úkol musí existovat a patřit do dané Nástěnky (cross-board ochrana).
 * 5. U archivovaného úkolu (status ARCHIVOVÁNO) je úprava komentářů zakázána (TASK_ARCHIVED).
 * 6. Pouze autor smí upravit svůj vlastní komentář (author-only edit; platí i pro ADMIN/OWNER/MANAGER).
 * 7. Validace obsahu: trim, 1–5000 znaků.
 */
export class UpdateTaskCommentUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: UpdateTaskCommentInput,
  ): Promise<Result<TaskCommentRecord, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validace vstupů ────────────────────────────────────
    const boardId = input.boardId?.trim();
    const taskId = input.taskId?.trim();
    const commentId = input.commentId?.trim();
    const content = input.content?.trim();

    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID nástěnky je povinné."));
    }
    if (!taskId || taskId.length === 0) {
      return err(new ValidationError("ID úkolu je povinné."));
    }
    if (!commentId || commentId.length === 0) {
      return err(new ValidationError("ID komentáře je povinné."));
    }
    if (!content || content.length === 0) {
      return err(new ValidationError("Text komentáře nesmí být prázdný."));
    }
    if (content.length > 5000) {
      return err(
        new ValidationError("Text komentáře nesmí přesáhnout 5000 znaků."),
      );
    }

    // ── 3. Transakční provedení v Unit of Work ─────────────────
    try {
      const result = await this.uow.runInTransaction(
        async ({ boards, memberships, tasks, taskParticipants, taskComments }) => {
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
            "TASK_COMMENT_EDIT_OWN",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "TASK_ARCHIVED") {
              throw new AuthorizationError(
                "Nelze upravovat komentáře u archivovaného úkolu.",
                "TASK_ARCHIVED",
              );
            }
            if (authResult.reason === "NOT_COMMENT_AUTHOR") {
              throw new AuthorizationError(
                "Můžete upravit pouze vlastní komentář.",
                "NOT_COMMENT_AUTHOR",
              );
            }
            throw new AuthorizationError(
              "Nemáte oprávnění upravit tento komentář.",
              authResult.reason,
            );
          }

          // F. Provedení úpravy komentáře
          const updated = await taskComments.update(commentId, { content });
          return updated;
        },
      );

      return ok(result);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
