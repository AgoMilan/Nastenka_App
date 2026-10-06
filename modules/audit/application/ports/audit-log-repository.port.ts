/**
 * Port (rozhraní) pro nezávislý auditní log (AuditLogRepository).
 *
 * Invarianty (ADR-009, STEP 9B):
 * 1. Žádný přímý import Drizzle ani konkrétní databáze do aplikační vrstvy.
 * 2. Poskytuje čisté operace zápisu auditních záznamů.
 * 3. Záznamy jsou striktně append-only.
 */

import type { AuditEvent, AuditLogRecord } from "../../domain/audit-events.ts";
export type { AuditEvent, AuditLogRecord };

export interface CreateAuditLogData {
  readonly actorUserId: string;
  readonly boardId: string | null;
  readonly operation: AuditEvent;
  readonly targetId: string;
  readonly previousState?: Record<string, unknown> | null;
  readonly newState?: Record<string, unknown> | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly timestamp?: Date;
}

export interface AuditQueryOptions {
  readonly limit?: number;
}

export interface AuditLogRepository {
  log(data: CreateAuditLogData): Promise<AuditLogRecord>;
  findByBoardId(boardId: string, options?: AuditQueryOptions): Promise<AuditLogRecord[]>;
  findByTaskId(boardId: string, taskId: string, options?: AuditQueryOptions): Promise<AuditLogRecord[]>;
}

