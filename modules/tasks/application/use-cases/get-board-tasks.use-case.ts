import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import type { AreaRepository } from "../../../areas/application/ports/area-repository.port.ts";
import type { ActorMembership } from "../../../boards/application/policies/board-authorization.ts";
import type {
  BoardRepository,
  MembershipRepository,
  UserRepository,
} from "../../../boards/application/ports/index.ts";
import { checkTaskPermission } from "../policies/task-policy.ts";
import type {
  TaskCommentRepository,
  TaskParticipantRecord,
  TaskParticipantRepository,
  TaskPriority,
  TaskRepository,
  TaskStatus,
  UserTaskOrderRepository,
} from "../ports/index.ts";

export type TaskFilterMode = "ACTIVE" | "ARCHIVED" | "ALL";

export interface GetBoardTasksOptions {
  readonly filter?: TaskFilterMode;
}

export interface BoardTaskParticipantView {
  readonly userId: string;
  readonly name: string;
  readonly role: string;
}

export interface BoardTaskView {
  readonly id: string;
  readonly boardId: string;
  readonly areaId: string | null;
  readonly areaName: string | null;

  readonly title: string;
  readonly description: string | null;

  readonly status: TaskStatus;
  readonly priority: TaskPriority;

  readonly dueDate: Date | null;

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
  readonly commentsCount?: number;
}

/**
 * Use Case: Získání seznamu úkolů pro danou Nástěnku (GetBoardTasks).
 *
 * Invarianty (ADR-009, docs/020_Pozadavky.md §5, docs/050_Architektura.md §35.14):
 * 1. Actor musí být přihlášen a aktivní (AuthenticationError).
 * 2. Nástěnka musí existovat a nesmí být smazána (soft-deleted -> NotFoundError).
 * 3. Autorizace probíhá přes TaskPolicy (akce TASK_VIEW):
 *    - Členové (OWNER, MANAGER, MEMBER) i systémový ADMIN mají přístup povolen.
 *    - Nečlen bez role ADMIN obdrží AuthorizationError(NOT_A_MEMBER).
 * 4. Vrací výhradně úkoly dané Nástěnky (přísná cross-board izolace).
 * 5. Efektivita: Žádný N+1 problém – oblasti, spoluřešitelé i uživatelská jména
 *    jsou načítáni dávkově (batch) přes příslušné repozitáře.
 * 6. Filtr stavů:
 *    - "ACTIVE" (výchozí): zobrazuje všechny úkoly kromě "ARCHIVOVÁNO".
 *      DŮLEŽITÉ: Dokončené úkoly ("HOTOVO") zůstávají na nástěnce a JSOU součástí ACTIVE.
 *    - "ARCHIVED": zobrazuje pouze úkoly se stavem "ARCHIVOVÁNO".
 *    - "ALL": zobrazuje všechny úkoly bez ohledu na stav.
 * 7. Deterministické seřazení: Priorita (SPĚCHÁ > BĚŽNÁ), DueDate (dřívější dříve, nulls last),
 *    CreatedAt DESC, ID ASC.
 */
export class GetBoardTasksUseCase {
  private readonly boardRepo: BoardRepository;
  private readonly membershipRepo: MembershipRepository;
  private readonly taskRepo: TaskRepository;
  private readonly taskParticipantRepo: TaskParticipantRepository;
  private readonly areaRepo: AreaRepository;
  private readonly userRepo: UserRepository;
  private readonly userTaskOrderRepo?: UserTaskOrderRepository;
  private readonly taskCommentRepo?: TaskCommentRepository;

  constructor(
    boardRepo: BoardRepository,
    membershipRepo: MembershipRepository,
    taskRepo: TaskRepository,
    taskParticipantRepo: TaskParticipantRepository,
    areaRepo: AreaRepository,
    userRepo: UserRepository,
    userTaskOrderRepo?: UserTaskOrderRepository,
    taskCommentRepo?: TaskCommentRepository,
  ) {
    this.boardRepo = boardRepo;
    this.membershipRepo = membershipRepo;
    this.taskRepo = taskRepo;
    this.taskParticipantRepo = taskParticipantRepo;
    this.areaRepo = areaRepo;
    this.userRepo = userRepo;
    this.userTaskOrderRepo = userTaskOrderRepo;
    this.taskCommentRepo = taskCommentRepo;
  }

  async execute(
    actor: ActorContext | null,
    boardId: string,
    options?: GetBoardTasksOptions,
  ): Promise<Result<BoardTaskView[], AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla vstupu ───────────────────────────
    const trimmedBoardId = boardId?.trim();
    if (!trimmedBoardId || trimmedBoardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
    }

    // ── 3. Existence a stav Nástěnky ───────────────────────────
    const board = await this.boardRepo.findById(trimmedBoardId);
    if (!board || board.deletedAt !== null) {
      return err(new NotFoundError("Nástěnka nebyla nalezena."));
    }

    // ── 4. Načtení členství pro autorizaci ─────────────────────
    let actorMembership: ActorMembership | null = null;
    if (actor.global_role !== "ADMIN") {
      const memberRecord = await this.membershipRepo.findByBoardAndUser(
        trimmedBoardId,
        actor.actor_user_id,
      );
      if (memberRecord) {
        actorMembership = { role: memberRecord.role };
      }
    }

    // ── 5. Vyhodnocení oprávnění přes TaskPolicy ───────────────
    const authResult = checkTaskPermission(
      actor,
      trimmedBoardId,
      actorMembership,
      {
        boardId: trimmedBoardId,
        taskId: "board-tasks",
        createdBy: actor.actor_user_id,
        assigneeId: null,
        isBoardDeleted: false,
      },
      {
        isAssignee: false,
        isParticipant: false,
      },
      "TASK_VIEW",
    );

    if (!authResult.allowed) {
      if (authResult.reason === "UNAUTHENTICATED") {
        return err(new AuthenticationError());
      }
      return err(new AuthorizationError(undefined, authResult.reason));
    }

    // ── 6. Načtení úkolů Nástěnky ──────────────────────────────
    const allBoardTasks = await this.taskRepo.findByBoardId(trimmedBoardId);

    // ── 7. Filtrování podle požadovaného režimu ────────────────
    const filter = options?.filter ?? "ACTIVE";
    const filteredTasks = allBoardTasks.filter((task) => {
      if (filter === "ACTIVE") {
        return task.status !== "ARCHIVOVÁNO";
      }
      if (filter === "ARCHIVED") {
        return task.status === "ARCHIVOVÁNO";
      }
      return true; // "ALL"
    });

    if (filteredTasks.length === 0) {
      return ok([]);
    }

    // ── 8. Dávkové načtení oblastí dané Nástěnky ───────────────
    const areas = await this.areaRepo.findByBoardId(trimmedBoardId);
    const areaMap = new Map(areas.map((a) => [a.id, a.name]));

    // ── 9. Dávkové načtení spoluřešitelů (1 query bez N+1) ──────
    const taskIds = filteredTasks.map((t) => t.id);
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

    // ── 10. Shromáždění ID a dávkové načtení uživatelů ─────────
    const userIdsSet = new Set<string>();
    for (const t of filteredTasks) {
      userIdsSet.add(t.createdBy);
      if (t.assigneeId) {
        userIdsSet.add(t.assigneeId);
      }
    }
    for (const p of allParticipants) {
      userIdsSet.add(p.userId);
    }

    const users = await this.userRepo.findByIds(Array.from(userIdsSet));
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Načtení počtu komentářů pro úkoly dávkově (Batch)
    let commentCounts = new Map<string, number>();
    if (this.taskCommentRepo && filteredTasks.length > 0) {
      commentCounts = await this.taskCommentRepo.countByTaskIds(
        filteredTasks.map((t) => t.id),
      );
    }

    // ── 11. Sestavení obohaceného aplikačního modelu ───────────
    const taskViews: BoardTaskView[] = filteredTasks.map((t) => {
      const taskParticipants = participantsByTaskId.get(t.id) ?? [];
      const participantsView: BoardTaskParticipantView[] = taskParticipants.map(
        (p) => ({
          userId: p.userId,
          name: userMap.get(p.userId) ?? "Neznámý uživatel",
          role: p.role,
        }),
      );

      return {
        id: t.id,
        boardId: t.boardId,
        areaId: t.areaId,
        areaName: t.areaId ? (areaMap.get(t.areaId) ?? null) : null,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
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
        commentsCount: commentCounts.get(t.id) ?? 0,
      };
    });

    // ── 12. Seřazení úkolů (Osobní pořadí / Archivní chronologie / Výchozí fallback) ─
    if (filter === "ARCHIVED") {
      // Archiv: chronologicky podle data archivace/aktualizace (DESC)
      taskViews.sort((a, b) => {
        const updatedDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
        if (updatedDiff !== 0) return updatedDiff;
        return a.id.localeCompare(b.id);
      });
      return ok(taskViews);
    }

    let orderMap = new Map<string, number>();
    if (this.userTaskOrderRepo) {
      const userOrders = await this.userTaskOrderRepo.findByBoardAndUser(
        trimmedBoardId,
        actor.actor_user_id,
      );
      orderMap = new Map(userOrders.map((o) => [o.taskId, o.position]));
    }

    taskViews.sort((a, b) => {
      // 1. Osobní pořadí přihlášeného uživatele (pokud existuje)
      const posA = orderMap.get(a.id);
      const posB = orderMap.get(b.id);

      if (posA !== undefined && posB !== undefined) {
        if (posA !== posB) return posA - posB;
      } else if (posA !== undefined && posB === undefined) {
        return -1;
      } else if (posA === undefined && posB !== undefined) {
        return 1;
      }

      // 2. Deterministické výchozí seřazení pro neuspořádané úkoly:
      // Priorita: SPĚCHÁ (1) před BĚŽNÁ (2)
      const pA = a.priority === "SPĚCHÁ" ? 1 : 2;
      const pB = b.priority === "SPĚCHÁ" ? 1 : 2;
      if (pA !== pB) return pA - pB;

      // Termín (dueDate): dřívější dříve, nulls last
      if (a.dueDate !== null && b.dueDate !== null) {
        const timeDiff = a.dueDate.getTime() - b.dueDate.getTime();
        if (timeDiff !== 0) return timeDiff;
      } else if (a.dueDate !== null && b.dueDate === null) {
        return -1;
      } else if (a.dueDate === null && b.dueDate !== null) {
        return 1;
      }

      // Vytvořeno (createdAt): novější dříve (DESC)
      const createdDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (createdDiff !== 0) return createdDiff;

      // Deterministický fallback na ID
      return a.id.localeCompare(b.id);
    });

    return ok(taskViews);
  }
}
