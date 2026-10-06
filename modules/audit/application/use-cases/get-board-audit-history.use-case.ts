import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import { checkBoardPermission } from "../../../boards/application/policies/board-policy.ts";
import type { ActorMembership } from "../../../boards/application/policies/board-authorization.ts";
import type {
  BoardRepository,
  MembershipRepository,
  UserRepository,
} from "../../../boards/application/ports/index.ts";
import type { AuditLogRepository } from "../ports/audit-log-repository.port.ts";
import type { AuditLogView } from "../../domain/audit-views.ts";

export interface GetBoardAuditHistoryInput {
  readonly boardId: string;
  readonly limit?: number;
}

/**
 * Use Case: Načtení auditní historie celé nástěnky (GetBoardAuditHistory).
 *
 * Invarianty (STEP 9B-UI):
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Nástěnka nesmí být smazána (soft-deleted).
 * 3. Autorizace probíhá přes BoardPolicy (akce BOARD_VIEW) – povoleno členům nástěnky a ADMINovi.
 * 4. Žádný N+1 problém – autoři auditních záznamů jsou načítáni dávkově (batch).
 * 5. Deterministické seřazení chronologicky sestupně (od nejnovějších).
 */
export class GetBoardAuditHistoryUseCase {
  private readonly boardRepo: BoardRepository;
  private readonly membershipRepo: MembershipRepository;
  private readonly auditLogRepo: AuditLogRepository;
  private readonly userRepo: UserRepository;

  constructor(
    boardRepo: BoardRepository,
    membershipRepo: MembershipRepository,
    auditLogRepo: AuditLogRepository,
    userRepo: UserRepository,
  ) {
    this.boardRepo = boardRepo;
    this.membershipRepo = membershipRepo;
    this.auditLogRepo = auditLogRepo;
    this.userRepo = userRepo;
  }

  async execute(
    actor: ActorContext | null,
    input: GetBoardAuditHistoryInput,
  ): Promise<Result<AuditLogView[], AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validace vstupů ────────────────────────────────────
    const boardId = input.boardId?.trim();

    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID nástěnky je povinné."));
    }

    // ── 3. Ověření existence nástěnky ──────────────────────────
    const board = await this.boardRepo.findById(boardId);
    if (!board || board.deletedAt !== null) {
      return err(new NotFoundError("Nástěnka nebyla nalezena."));
    }

    // ── 4. Ověření členství a autorizace přes BoardPolicy ──────
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

    const authResult = checkBoardPermission(
      actor,
      { boardId: board.id, isDeleted: board.deletedAt !== null },
      actorMembership,
      "BOARD_VIEW",
    );

    if (!authResult.allowed) {
      return err(
        new AuthorizationError(
          "Nemáte oprávnění zobrazit historii této nástěnky.",
          authResult.reason,
        ),
      );
    }

    // ── 5. Načtení auditních záznamů a aktérů dávkově ──────────
    const limit = input.limit ?? 50;
    const logs = await this.auditLogRepo.findByBoardId(boardId, { limit });
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
