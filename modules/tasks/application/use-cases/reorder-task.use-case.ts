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
import type { TaskRecord } from "../ports/task-repository.port.ts";

export interface ReorderTaskInput {
  readonly boardId: string;
  readonly taskId: string;
  readonly direction?: "UP" | "DOWN";
  readonly targetTaskId?: string;
  readonly position?: "BEFORE" | "AFTER";
}

export interface ReorderTaskOutput {
  readonly taskId: string;
  readonly newPosition: number;
}

/**
 * Porovnávací funkce pro řazení úkolů s ohledem na osobní pořadí a deterministický fallback.
 */
function compareTasksWithOrders(
  a: TaskRecord,
  b: TaskRecord,
  orderMap: Map<string, number>,
): number {
  const posA = orderMap.get(a.id);
  const posB = orderMap.get(b.id);

  if (posA !== undefined && posB !== undefined) {
    if (posA !== posB) return posA - posB;
  } else if (posA !== undefined && posB === undefined) {
    return -1;
  } else if (posA === undefined && posB !== undefined) {
    return 1;
  }

  // Fallback deterministické řazení:
  // 1. Priorita: SPĚCHÁ před BĚŽNÁ
  const pA = a.priority === "SPĚCHÁ" ? 1 : 2;
  const pB = b.priority === "SPĚCHÁ" ? 1 : 2;
  if (pA !== pB) return pA - pB;

  // 2. Termín: dřívější dříve, nulls last
  if (a.dueDate !== null && b.dueDate !== null) {
    const timeDiff = a.dueDate.getTime() - b.dueDate.getTime();
    if (timeDiff !== 0) return timeDiff;
  } else if (a.dueDate !== null && b.dueDate === null) {
    return -1;
  } else if (a.dueDate === null && b.dueDate !== null) {
    return 1;
  }

  // 3. Vytvořeno: novější dříve (DESC)
  const createdDiff = b.createdAt.getTime() - a.createdAt.getTime();
  if (createdDiff !== 0) return createdDiff;

  // 4. Fallback na ID
  return a.id.localeCompare(b.id);
}

/**
 * Use Case: Změna osobního pořadí úkolů uživatele (ReorderTask).
 *
 * Invarianty (STEP 6 – Personal Ordering):
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Nástěnka musí existovat a nebýt smazána.
 * 3. Oprávnění: TASK_REORDER – povoleno všem členům nástěnky i ADMINovi.
 * 4. Přísná cross-board izolace: úkol i případný targetTaskId musí patřit do stejné nástěnky.
 * 5. Izolace mezi uživateli: zápis probíhá výhradně pod actor.actor_user_id.
 * 6. Zákaz úprav cizího pořadí: uživatel nikdy nemůže změnit pořadí jiného uživatele.
 * 7. Normalizace pozic: pozice jsou ukládány jako celá čísla s krokem 1000.
 */
export class ReorderTaskUseCase {
  private readonly uow: UnitOfWork;

  constructor(uow: UnitOfWork) {
    this.uow = uow;
  }

  async execute(
    actor: ActorContext | null,
    input: ReorderTaskInput,
  ): Promise<Result<ReorderTaskOutput, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla vstupu ───────────────────────────
    const boardId = input.boardId?.trim();
    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
    }

    const taskId = input.taskId?.trim();
    if (!taskId || taskId.length === 0) {
      return err(new ValidationError("ID Úkolu je povinné."));
    }

    if (
      !input.direction &&
      (!input.targetTaskId || !input.position)
    ) {
      return err(
        new ValidationError(
          "Musí být zadán směr (direction) nebo cílový úkol s pozicí (targetTaskId, position).",
        ),
      );
    }

    // ── 3. Transakční provedení ────────────────────────────────
    try {
      const output = await this.uow.runInTransaction(
        async ({ boards, memberships, tasks, userTaskOrders }) => {
          if (!tasks || !userTaskOrders) {
            throw new ValidationError("Repozitáře úkolů nejsou dostupné.");
          }

          // A. Ověření existence a stavu Nástěnky
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

          // B. Ověření členství Actora
          let actorMembership: ActorMembership | null = null;
          if (actor.global_role !== "ADMIN") {
            const memberRecord = await memberships.findByBoardAndUser(
              boardId,
              actor.actor_user_id,
            );
            if (!memberRecord) {
              throw new AuthorizationError(
                "Uživatel není členem Nástěnky.",
                "NOT_A_MEMBER",
              );
            }
            actorMembership = { role: memberRecord.role };
          }

          // C. Načtení cílového úkolu
          const targetTask = await tasks.findById(taskId);
          if (!targetTask) {
            throw new NotFoundError("Úkol nebyl nalezen.");
          }

          // D. Cross-board security kontrola
          if (targetTask.boardId !== boardId) {
            throw new AuthorizationError(
              "Úkol nepatří do zadané Nástěnky.",
              "CROSS_BOARD_ACCESS",
            );
          }

          // E. Ověření oprávnění přes TaskPolicy
          const authResult = checkTaskPermission(
            actor,
            boardId,
            actorMembership,
            {
              boardId,
              taskId: targetTask.id,
              createdBy: targetTask.createdBy,
              assigneeId: targetTask.assigneeId,
              isBoardDeleted: false,
            },
            {
              isAssignee: targetTask.assigneeId === actor.actor_user_id,
              isParticipant: false,
            },
            "TASK_REORDER",
          );

          if (!authResult.allowed) {
            throw new AuthorizationError(undefined, authResult.reason);
          }

          // F. Načtení všech aktivních úkolů ve stejném kontejneru (oblast nebo nezařazeno)
          const allBoardTasks = await tasks.findByBoardId(boardId);
          const containerTasks = allBoardTasks.filter(
            (t) =>
              t.areaId === targetTask.areaId && t.status !== "ARCHIVOVÁNO",
          );

          // G. Načtení uložených pozic tohoto uživatele
          const userOrders = await userTaskOrders.findByBoardAndUser(
            boardId,
            actor.actor_user_id,
          );
          const orderMap = new Map<string, number>(
            userOrders.map((o) => [o.taskId, o.position]),
          );

          // H. Seřazení úkolů podle stávajícího osobního pořadí
          const sorted = [...containerTasks].sort((a, b) =>
            compareTasksWithOrders(a, b, orderMap),
          );

          const currentIndex = sorted.findIndex((t) => t.id === taskId);
          if (currentIndex === -1) {
            throw new NotFoundError(
              "Úkol nebyl v daném zobrazení oblasti nalezen.",
            );
          }

          // I. Aplikace posunu
          if (input.direction === "UP") {
            if (currentIndex > 0) {
              const temp = sorted[currentIndex - 1];
              sorted[currentIndex - 1] = sorted[currentIndex];
              sorted[currentIndex] = temp;
            }
          } else if (input.direction === "DOWN") {
            if (currentIndex < sorted.length - 1) {
              const temp = sorted[currentIndex + 1];
              sorted[currentIndex + 1] = sorted[currentIndex];
              sorted[currentIndex] = temp;
            }
          } else if (input.targetTaskId && input.position) {
            const targetIndex = sorted.findIndex(
              (t) => t.id === input.targetTaskId,
            );
            if (targetIndex !== -1 && targetIndex !== currentIndex) {
              const [moved] = sorted.splice(currentIndex, 1);
              const newTargetIndex = sorted.findIndex(
                (t) => t.id === input.targetTaskId,
              );
              const insertIndex =
                input.position === "BEFORE"
                  ? newTargetIndex
                  : newTargetIndex + 1;
              sorted.splice(insertIndex, 0, moved);
            }
          }

          // J. Normalizace pozic s krokem 1000
          const upsertPayload: Array<{
            boardId: string;
            userId: string;
            taskId: string;
            position: number;
          }> = [];

          let resultingPosition = 1000;

          for (let i = 0; i < sorted.length; i++) {
            const pos = (i + 1) * 1000;
            const currentItem = sorted[i];
            upsertPayload.push({
              boardId,
              userId: actor.actor_user_id,
              taskId: currentItem.id,
              position: pos,
            });
            if (currentItem.id === taskId) {
              resultingPosition = pos;
            }
          }

          await userTaskOrders.upsertOrders(upsertPayload);

          return {
            taskId,
            newPosition: resultingPosition,
          };
        },
      );

      return ok(output);
    } catch (error) {
      if (error instanceof AppError) {
        return err(error);
      }
      throw error;
    }
  }
}
