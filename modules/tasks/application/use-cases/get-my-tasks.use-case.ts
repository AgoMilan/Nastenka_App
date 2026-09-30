import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import type { AreaRepository } from "../../../areas/application/ports/area-repository.port.ts";
import type {
  BoardRepository,
  UserRepository,
} from "../../../boards/application/ports/index.ts";
import type {
  TaskParticipantRecord,
  TaskParticipantRepository,
  TaskPriority,
  TaskRepository,
  TaskRecord,
  TaskStatus,
  UserTaskOrderRepository,
} from "../ports/index.ts";
import type { BoardTaskParticipantView } from "./get-board-tasks.use-case.ts";

export type MyTaskFilterMode = "ACTIVE" | "COMPLETED" | "ARCHIVED" | "ALL";
export type MyTaskRoleFilter = "ALL" | "ASSIGNEE" | "PARTICIPANT";

export interface GetMyTasksOptions {
  readonly filter?: MyTaskFilterMode;
  readonly roleFilter?: MyTaskRoleFilter;
}

export interface MyTaskView {
  readonly id: string;
  readonly boardId: string;
  readonly boardName: string;
  readonly areaId: string | null;
  readonly areaName: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly dueDate: Date | null;
  readonly userRole: "ASSIGNEE" | "PARTICIPANT";
  readonly createdBy: {
    readonly userId: string;
    readonly name: string;
  };
  readonly assignee: {
    readonly userId: string;
    readonly name: string;
  } | null;
  readonly participants: readonly BoardTaskParticipantView[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
  readonly personalPosition?: number;
}

/**
 * Use Case: Získání relevantních úkolů pro osobní pracovní prostor přihlášeného uživatele (Moje úkoly).
 *
 * Invarianty (STEP 7):
 * 1. Actor musí být přihlášen a aktivní (AuthenticationError).
 * 2. Backend je jediná autorita – dotazuje pouze aktivní nástěnky (deleted_at IS NULL),
 *    ke kterým má uživatel platné členství, resp. všechny aktivní pro ADMINa.
 * 3. Dotaz na úrovni SQL filtruje úkoly, kde je uživatel ASSIGNEE nebo PARTICIPANT.
 *    Samotné created_by bez vztahu ASSIGNEE/PARTICIPANT se nezobrazuje.
 * 4. Pokud je uživatel ASSIGNEE i PARTICIPANT, má ASSIGNEE přednost (userRole = "ASSIGNEE").
 * 5. Filtry stavu:
 *    - ACTIVE (výchozí): NOVÉ, PŘEVZATÉ, ROZPRACOVANÉ, ČEKÁ SE (HOTOVO sem nepatří!).
 *    - COMPLETED: HOTOVO.
 *    - ARCHIVED: ARCHIVOVÁNO.
 *    - ALL: všechny stavy.
 * 6. Role filtr: ALL (výchozí) / ASSIGNEE / PARTICIPANT.
 * 7. Řazení zachovává osobní pořadí z user_task_orders v kontextu jednotlivých nástěnek.
 */
export class GetMyTasksUseCase {
  private readonly boardRepo: BoardRepository;
  private readonly taskRepo: TaskRepository;
  private readonly taskParticipantRepo: TaskParticipantRepository;
  private readonly areaRepo: AreaRepository;
  private readonly userRepo: UserRepository;
  private readonly userTaskOrderRepo?: UserTaskOrderRepository;

  constructor(
    boardRepo: BoardRepository,
    taskRepo: TaskRepository,
    taskParticipantRepo: TaskParticipantRepository,
    areaRepo: AreaRepository,
    userRepo: UserRepository,
    userTaskOrderRepo?: UserTaskOrderRepository,
  ) {
    this.boardRepo = boardRepo;
    this.taskRepo = taskRepo;
    this.taskParticipantRepo = taskParticipantRepo;
    this.areaRepo = areaRepo;
    this.userRepo = userRepo;
    this.userTaskOrderRepo = userTaskOrderRepo;
  }

  async execute(
    actor: ActorContext | null,
    options?: GetMyTasksOptions,
  ): Promise<Result<MyTaskView[], AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Získání autorizovaných aktivních nástěnek ───────────
    const authorizedBoards =
      actor.global_role === "ADMIN"
        ? await this.boardRepo.findActiveBoardsForAdmin(actor.actor_user_id)
        : await this.boardRepo.findActiveBoardsForUser(actor.actor_user_id);

    if (authorizedBoards.length === 0) {
      return ok([]);
    }

    const boardMap = new Map(authorizedBoards.map((b) => [b.id, b.name]));
    const boardIds = authorizedBoards.map((b) => b.id);

    // ── 3. Načtení úkolů na databázové úrovni (SQL scope) ─────
    const rawTasks = await this.taskRepo.findUserTasksAcrossBoards(
      actor.actor_user_id,
      boardIds,
    );

    if (rawTasks.length === 0) {
      return ok([]);
    }

    // ── 4. Filtrování podle stavu ──────────────────────────────
    const filterMode = options?.filter ?? "ACTIVE";
    const statusFilteredTasks = rawTasks.filter((t) => {
      if (filterMode === "ACTIVE") {
        return (
          t.status === "NOVÉ" ||
          t.status === "PŘEVZATÉ" ||
          t.status === "ROZPRACOVANÉ" ||
          t.status === "ČEKÁ SE"
        );
      }
      if (filterMode === "COMPLETED") {
        return t.status === "HOTOVO";
      }
      if (filterMode === "ARCHIVED") {
        return t.status === "ARCHIVOVÁNO";
      }
      return true; // "ALL"
    });

    if (statusFilteredTasks.length === 0) {
      return ok([]);
    }

    // ── 5. Dávkové načtení spoluřešitelů (1 query bez N+1) ──────
    const taskIds = statusFilteredTasks.map((t) => t.id);
    const allParticipants =
      await this.taskParticipantRepo.findByTaskIds(taskIds);

    const participantsByTaskId = new Map<string, TaskParticipantRecord[]>();
    for (const p of allParticipants) {
      const list = participantsByTaskId.get(p.taskId);
      if (list) {
        list.push(p);
      } else {
        participantsByTaskId.set(p.taskId, [p]);
      }
    }

    // ── 6. Určení role uživatele a filtrování podle role ────────
    const roleFilter = options?.roleFilter ?? "ALL";

    interface TaskWithRole {
      task: TaskRecord;
      userRole: "ASSIGNEE" | "PARTICIPANT";
    }

    const tasksWithRole: TaskWithRole[] = [];

    for (const t of statusFilteredTasks) {
      const isAssignee = t.assigneeId === actor.actor_user_id;
      const isParticipant = (participantsByTaskId.get(t.id) ?? []).some(
        (p) => p.userId === actor.actor_user_id,
      );

      // Pokud uživatel není řešitel ani spoluřešitel (např. pouze vytvořil), do "Moje úkoly" nepatří
      if (!isAssignee && !isParticipant) {
        continue;
      }

      // ASSIGNEE má přednost před PARTICIPANT
      const userRole: "ASSIGNEE" | "PARTICIPANT" = isAssignee
        ? "ASSIGNEE"
        : "PARTICIPANT";

      if (roleFilter === "ASSIGNEE" && userRole !== "ASSIGNEE") {
        continue;
      }
      if (roleFilter === "PARTICIPANT" && userRole !== "PARTICIPANT") {
        continue;
      }

      tasksWithRole.push({ task: t, userRole });
    }

    if (tasksWithRole.length === 0) {
      return ok([]);
    }

    // ── 7. Dávkové načtení oblastí pro zúčastněné nástěnky ──────
    const relevantBoardIds = Array.from(
      new Set(tasksWithRole.map((item) => item.task.boardId)),
    );

    const areaResults = await Promise.all(
      relevantBoardIds.map((bId) => this.areaRepo.findByBoardId(bId)),
    );
    const areaMap = new Map<string, string>();
    for (const areas of areaResults) {
      for (const a of areas) {
        areaMap.set(a.id, a.name);
      }
    }

    // ── 8. Dávkové načtení jmen uživatelů ───────────────────────
    const userIdsSet = new Set<string>();
    for (const item of tasksWithRole) {
      userIdsSet.add(item.task.createdBy);
      if (item.task.assigneeId) {
        userIdsSet.add(item.task.assigneeId);
      }
    }
    for (const p of allParticipants) {
      userIdsSet.add(p.userId);
    }

    const users = await this.userRepo.findByIds(Array.from(userIdsSet));
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // ── 9. Dávkové načtení osobního pořadí per nástěnka ─────────
    const orderMap = new Map<string, number>();
    if (this.userTaskOrderRepo) {
      const orderResults = await Promise.all(
        relevantBoardIds.map((bId) =>
          this.userTaskOrderRepo!.findByBoardAndUser(bId, actor.actor_user_id),
        ),
      );
      for (const orders of orderResults) {
        for (const o of orders) {
          orderMap.set(o.taskId, o.position);
        }
      }
    }

    // ── 10. Sestavení obohaceného zobrazení MyTaskView ──────────
    const views: MyTaskView[] = tasksWithRole.map(({ task: t, userRole }) => {
      const taskParticipants = participantsByTaskId.get(t.id) ?? [];
      const participantsView: BoardTaskParticipantView[] = taskParticipants.map(
        (p) => ({
          userId: p.userId,
          name: userMap.get(p.userId) ?? "Neznámý uživatel",
          role: p.role,
        }),
      );

      const personalPos = orderMap.get(t.id);

      return {
        id: t.id,
        boardId: t.boardId,
        boardName: boardMap.get(t.boardId) ?? "Neznámá nástěnka",
        areaId: t.areaId,
        areaName: t.areaId ? (areaMap.get(t.areaId) ?? null) : null,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        userRole,
        createdBy: {
          userId: t.createdBy,
          name: userMap.get(t.createdBy) ?? "Neznámý uživatel",
        },
        assignee: t.assigneeId
          ? {
              userId: t.assigneeId,
              name: userMap.get(t.assigneeId) ?? "Neznámý uživatel",
            }
          : null,
        participants: participantsView,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        completedAt: t.completedAt,
        personalPosition: personalPos,
      };
    });

    // ── 11. Seřazení: Primárně podle Nástěnky, uvnitř Nástěnky osobní pořadí / fallback ─
    views.sort((a, b) => {
      // Seskupení podle názvu Nástěnky
      const boardDiff = a.boardName.localeCompare(b.boardName);
      if (boardDiff !== 0) return boardDiff;

      // Pokud jde o archiv, řadíme chronologicky podle updatedAt DESC
      if (filterMode === "ARCHIVED") {
        const updatedDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
        if (updatedDiff !== 0) return updatedDiff;
        return a.id.localeCompare(b.id);
      }

      // Osobní pořadí v kontextu dané nástěnky
      const posA = a.personalPosition;
      const posB = b.personalPosition;

      if (posA !== undefined && posB !== undefined) {
        if (posA !== posB) return posA - posB;
      } else if (posA !== undefined && posB === undefined) {
        return -1;
      } else if (posA === undefined && posB !== undefined) {
        return 1;
      }

      // Deterministický fallback:
      // 1. Priorita: SPĚCHÁ (1) před BĚŽNÁ (2)
      const pA = a.priority === "SPĚCHÁ" ? 1 : 2;
      const pB = b.priority === "SPĚCHÁ" ? 1 : 2;
      if (pA !== pB) return pA - pB;

      // 2. Termín (dueDate): dřívější dříve, nulls last
      if (a.dueDate !== null && b.dueDate !== null) {
        const timeDiff = a.dueDate.getTime() - b.dueDate.getTime();
        if (timeDiff !== 0) return timeDiff;
      } else if (a.dueDate !== null && b.dueDate === null) {
        return -1;
      } else if (a.dueDate === null && b.dueDate !== null) {
        return 1;
      }

      // 3. Vytvořeno (createdAt): novější dříve (DESC)
      const createdDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (createdDiff !== 0) return createdDiff;

      // 4. Deterministický fallback na ID
      return a.id.localeCompare(b.id);
    });

    return ok(views);
  }
}
