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

export interface ArchiveTaskInput {
  readonly taskId: string;
}

/**
 * Use Case: Archivace úkolu (ArchiveTask).
 *
 * Pravidla (docs/020_Pozadavky.md §5.4, docs/050_Architektura.md §11.7.5):
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board nesmí být smazán.
 * 3. Oprávnění: TASK_ARCHIVE (ASSIGNEE, PARTICIPANT, MANAGER, OWNER, ADMIN).
 * 4. Nastaví stav úkolu na "ARCHIVOVÁNO". Nejedná se o fyzické smazání.
 */
export class ArchiveTaskUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: ArchiveTaskInput,
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
            "TASK_ARCHIVE",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // E. Aktualizace stavu na ARCHIVOVÁNO
          return await tasks.update(task.id, {
            status: "ARCHIVOVÁNO",
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
