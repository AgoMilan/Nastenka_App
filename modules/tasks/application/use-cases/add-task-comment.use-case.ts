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

export interface AddTaskCommentInput {
  readonly boardId: string;
  readonly taskId: string;
  readonly content: string;
}

/**
 * Use Case: Přidání nového komentáře k úkolu (AddTaskComment).
 *
 * Invarianty (STEP 8):
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Nástěnka nesmí být smazána (soft-deleted).
 * 3. Úkol musí existovat a patřit do dané Nástěnky (cross-board ochrana).
 * 4. U archivovaného úkolu (status ARCHIVOVÁNO) je přidávání komentářů zakázáno (TASK_ARCHIVED).
 * 5. Autor komentáře je autoritativně přebírán z ActorContext (nikdy z klientského vstupu).
 * 6. Validace obsahu: trim, 1–5000 znaků.
 */
export class AddTaskCommentUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: AddTaskCommentInput,
  ): Promise<Result<TaskCommentRecord, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validace vstupů ────────────────────────────────────
    const boardId = input.boardId?.trim();
    const taskId = input.taskId?.trim();
    const content = input.content?.trim();

    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID nástěnky je povinné."));
    }
    if (!taskId || taskId.length === 0) {
      return err(new ValidationError("ID úkolu je povinné."));
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
            "TASK_COMMENT_CREATE",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "TASK_ARCHIVED") {
              throw new AuthorizationError(
                "Nelze přidávat komentáře k archivovanému úkolu.",
                "TASK_ARCHIVED",
              );
            }
            throw new AuthorizationError(
              "Nemáte oprávnění přidávat komentáře k tomuto úkolu.",
              authResult.reason,
            );
          }

          // E. Vytvoření komentáře (authorId je výhradně z ActorContext)
          const newComment = await taskComments.create({
            taskId: task.id,
            authorId: actor.actor_user_id,
            content,
          });

          if (auditLogs) {
            await auditLogs.log({
              actorUserId: actor.actor_user_id,
              boardId: task.boardId,
              operation: "TASK_COMMENT_CREATED",
              targetId: newComment.id,
              previousState: null,
              newState: {
                taskId: task.id,
              },
            });
          }

          return newComment;
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
