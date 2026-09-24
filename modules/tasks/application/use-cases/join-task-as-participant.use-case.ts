import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
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
import type { TaskParticipantRecord } from "../ports/task-participant-repository.port.ts";

export interface JoinTaskAsParticipantInput {
  readonly taskId: string;
}

/**
 * Use Case: Dobrovolné připojení se k úkolu jako Spoluřešitel (JoinTaskAsParticipant).
 *
 * Pravidla:
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Board nesmí být smazán.
 * 3. Invariant: Úkol MUSÍ mít Hlavního Řešitele (assigneeId !== null). Jinak DENY(TASK_HAS_NO_ASSIGNEE).
 * 4. Invariant: Hlavní řešitel se nemůže připojit sám k sobě jako spoluřešitel.
 * 5. Uživatel nesmí být k úkolu již připojen (duplicita).
 * 6. Oprávnění: TASK_JOIN_AS_PARTICIPANT.
 */
export class JoinTaskAsParticipantUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: JoinTaskAsParticipantInput,
  ): Promise<Result<TaskParticipantRecord, AppError>> {
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
      const participant = await this.uow.runInTransaction(
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

          // C. Kontrola existence řešitele (invariant)
          if (task.assigneeId === null) {
            throw new AuthorizationError(
              "K úkolu bez hlavního řešitele se nelze připojit jako spoluřešitel.",
              "TASK_HAS_NO_ASSIGNEE",
            );
          }

          // D. Hlavní řešitel nemůže být zároveň spoluřešitelem
          if (task.assigneeId === actor.actor_user_id) {
            throw new ConflictError(
              "Hlavní řešitel úkolu se nemůže připojit sám k sobě jako spoluřešitel.",
            );
          }

          // E. Kontrola duplicity
          const existing = await taskParticipants.findByTaskAndUser(
            task.id,
            actor.actor_user_id,
          );
          if (existing) {
            throw new ConflictError(
              "Uživatel je již spoluřešitelem tohoto úkolu.",
            );
          }

          // F. Načtení členství Actora a vyhodnocení autorizace
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
            isBoardDeleted: false,
          };

          const rel: ActorTaskRelationship = {
            isAssignee: false,
            isParticipant: false,
          };

          const authResult = checkTaskPermission(
            actor,
            task.boardId,
            actorMembership,
            target,
            rel,
            "TASK_JOIN_AS_PARTICIPANT",
          );

          if (!authResult.allowed) {
            if (authResult.reason === "UNAUTHENTICATED") {
              throw new AuthenticationError();
            }
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // G. Přidání spoluřešitele
          return await taskParticipants.addParticipant(
            task.id,
            actor.actor_user_id,
            "SPOLUŘEŠITEL",
          );
        },
      );

      return ok(participant);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
