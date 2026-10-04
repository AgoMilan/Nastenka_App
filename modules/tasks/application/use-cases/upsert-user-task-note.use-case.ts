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
import type { UserTaskNoteRecord } from "../ports/index.ts";

export interface UpsertUserTaskNoteInput {
  readonly boardId: string;
  readonly taskId: string;
  readonly content: string;
}

/**
 * Use Case: Vytvoření nebo úprava vlastní soukromé poznámky k úkolu (UpsertUserTaskNote).
 *
 * Invarianty (Soukromé poznámky):
 * 1. Actor musí být přihlášen a aktivní (AuthenticationError).
 * 2. Nástěnka nesmí být smazána (soft-deleted -> NotFoundError / BOARD_DELETED).
 * 3. Úkol musí existovat a patřit do dané nástěnky (cross-board ochrana).
 * 4. U archivovaného úkolu (status ARCHIVOVÁNO) je zápis poznámky zakázán (TASK_ARCHIVED).
 * 5. U dokončeného úkolu (status HOTOVO) i aktivních stavů je zápis povolen.
 * 6. Vlastník poznámky je autoritativně určen ze serverového ActorContext (klient nesmí posílat userId).
 * 7. Ani ADMIN, OWNER či MANAGER nemůže vytvořit ani upravit cizí poznámku (NOT_NOTE_OWNER).
 * 8. Validace obsahu: trim, 1–5000 znaků.
 */
export class UpsertUserTaskNoteUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: UpsertUserTaskNoteInput,
  ): Promise<Result<UserTaskNoteRecord, AppError>> {
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
      return err(new ValidationError("Text poznámky nesmí být prázdný."));
    }
    if (content.length > 5000) {
      return err(
        new ValidationError("Text poznámky nesmí přesáhnout 5000 znaků."),
      );
    }

    // ── 3. Transakční provedení v Unit of Work ─────────────────
    try {
      const result = await this.uow.runInTransaction(
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
            "TASK_PRIVATE_NOTE_UPSERT_OWN",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "TASK_ARCHIVED") {
              throw new AuthorizationError(
                "Nelze upravovat soukromou poznámku k archivovanému úkolu.",
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
              "Nemáte oprávnění upravit soukromou poznámku k tomuto úkolu.",
              authResult.reason,
            );
          }

          // E. Uložení/aktualizace soukromé poznámky
          const note = await userTaskNotes.upsert({
            userId: actor.actor_user_id,
            taskId: task.id,
            content,
          });

          return note;
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
