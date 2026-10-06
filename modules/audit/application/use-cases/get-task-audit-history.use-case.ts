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
import type {
  BoardRepository,
  MembershipRepository,
  UserRepository,
} from "../../../boards/application/ports/index.ts";
import { checkTaskPermission } from "../../../tasks/application/policies/task-policy.ts";
import type {
  ActorTaskRelationship,
  TaskAuthorizationTarget,
} from "../../../tasks/application/policies/task-authorization.ts";
import type {
  TaskParticipantRepository,
  TaskRepository,
} from "../../../tasks/application/ports/index.ts";
import type { AuditLogRepository } from "../ports/audit-log-repository.port.ts";
import type { AuditLogView } from "../../domain/audit-views.ts";

export interface GetTaskAuditHistoryInput {
  readonly boardId: string;
  readonly taskId: string;
  readonly limit?: number;
}

/**
 * Use Case: Načtení auditní historie konkrétního úkolu (GetTaskAuditHistory).
 *
 * Invarianty (STEP 9B-UI):
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Nástěnka nesmí být smazána (soft-deleted).
 * 3. Úkol musí existovat a patřit do dané Nástěnky (cross-board ochrana).
 * 4. Autorizace probíhá přes TaskPolicy (akce TASK_VIEW) – povoleno všem členům nástěnky i u archivovaných úkolů.
 * 5. Žádný N+1 problém – autoři auditních záznamů jsou načítáni dávkově (batch).
 * 6. Deterministické seřazení chronologicky sestupně (od nejnovějších).
 */
export class GetTaskAuditHistoryUseCase {
  private readonly boardRepo: BoardRepository;
  private readonly membershipRepo: MembershipRepository;
  private readonly taskRepo: TaskRepository;
  private readonly auditLogRepo: AuditLogRepository;
  private readonly userRepo: UserRepository;
  private readonly taskParticipantRepo?: TaskParticipantRepository;

  constructor(
    boardRepo: BoardRepository,
    membershipRepo: MembershipRepository,
    taskRepo: TaskRepository,
    auditLogRepo: AuditLogRepository,
    userRepo: UserRepository,
    taskParticipantRepo?: TaskParticipantRepository,
  ) {
    this.boardRepo = boardRepo;
    this.membershipRepo = membershipRepo;
    this.taskRepo = taskRepo;
    this.auditLogRepo = auditLogRepo;
    this.userRepo = userRepo;
    this.taskParticipantRepo = taskParticipantRepo;
  }

  async execute(
    actor: ActorContext | null,
    input: GetTaskAuditHistoryInput,
  ): Promise<Result<AuditLogView[], AppError>> {
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

    // ── 3. Ověření existence nástěnky a úkolu ───────────────────
    const board = await this.boardRepo.findById(boardId);
    if (!board || board.deletedAt !== null) {
      return err(new NotFoundError("Nástěnka nebyla nalezena."));
    }

    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      return err(new NotFoundError("Úkol nebyl nalezen."));
    }

    if (task.boardId !== boardId) {
      return err(
        new AuthorizationError(
          "Úkol nepatří do zadané nástěnky.",
          "CROSS_BOARD_ACCESS",
        ),
      );
    }

    // ── 4. Ověření členství a vztahu k úkolu ────────────────────
    let actorMembership: ActorMembership | null = null;
    if (actor.global_role !== "ADMIN") {
      const memberRecord = await this.membershipRepo.findByBoardAndUser(
        boardId,
        actor.actor_user_id,
      );
      if (memberRecord) {
        actorMembership = { role: memberRecord.role };
      }
    }

    const isAssignee = task.assigneeId === actor.actor_user_id;
    let isParticipant = false;
    if (this.taskParticipantRepo) {
      const participantRecord =
        await this.taskParticipantRepo.findByTaskAndUser(
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

    // ── 5. Autorizace přes TaskPolicy ──────────────────────────
    const authResult = checkTaskPermission(
      actor,
      boardId,
      actorMembership,
      target,
      rel,
      "TASK_VIEW",
    );

    if (!authResult.allowed) {
      return err(
        new AuthorizationError(
          "Nemáte oprávnění zobrazit historii tohoto úkolu.",
          authResult.reason,
        ),
      );
    }

    // ── 6. Načtení auditních záznamů a aktérů dávkově ──────────
    const limit = input.limit ?? 50;
    const logs = await this.auditLogRepo.findByTaskId(boardId, taskId, { limit });
    if (logs.length === 0) {
      return ok([]);
    }

    const distinctActorIds = Array.from(
      new Set(logs.map((log) => log.actorUserId)),
    );
    const users = await this.userRepo.findByIds(distinctActorIds);
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const views: AuditLogView[] = logs.map((log) => ({
      id: log.id,
      actor: {
        id: log.actorUserId,
        name: userMap.get(log.actorUserId) ?? "Uživatel",
      },
      timestamp: log.timestamp,
      boardId: log.boardId,
      operation: log.operation,
      targetId: log.targetId,
      previousState: log.previousState,
      newState: log.newState,
      metadata: log.metadata,
    }));

    return ok(views);
  }
}
