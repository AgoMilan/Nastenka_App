import { and, desc, eq, or, sql } from "drizzle-orm";
import { auditLogs, type AuditLogSelect } from "../../../database/schema/index.ts";
import type { Database } from "../client.ts";
import type {
  AuditLogRecord,
  AuditLogRepository,
  AuditQueryOptions,
  CreateAuditLogData,
} from "../../../modules/audit/application/ports/audit-log-repository.port.ts";

export class DrizzleAuditLogRepository implements AuditLogRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async log(data: CreateAuditLogData): Promise<AuditLogRecord> {
    const [row] = await this.db
      .insert(auditLogs)
      .values({
        actorUserId: data.actorUserId,
        boardId: data.boardId,
        operation: data.operation,
        targetId: data.targetId,
        previousState: data.previousState ?? null,
        newState: data.newState ?? null,
        metadata: data.metadata ?? null,
        timestamp: data.timestamp ?? new Date(),
      })
      .returning();

    return this.mapToRecord(row);
  }

  async findByBoardId(boardId: string, options?: AuditQueryOptions): Promise<AuditLogRecord[]> {
    const query = this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.boardId, boardId))
      .orderBy(desc(auditLogs.timestamp), desc(auditLogs.id));

    if (options?.limit) {
      query.limit(options.limit);
    }

    const rows = await query;
    return rows.map((row) => this.mapToRecord(row));
  }

  async findByTaskId(
    boardId: string,
    taskId: string,
    options?: AuditQueryOptions,
  ): Promise<AuditLogRecord[]> {
    const query = this.db
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.boardId, boardId),
          or(
            eq(auditLogs.targetId, taskId),
            sql`(${auditLogs.newState}->>'taskId') = ${taskId}`,
            sql`(${auditLogs.previousState}->>'taskId') = ${taskId}`,
          ),
        ),
      )
      .orderBy(desc(auditLogs.timestamp), desc(auditLogs.id));

    if (options?.limit) {
      query.limit(options.limit);
    }

    const rows = await query;
    return rows.map((row) => this.mapToRecord(row));
  }

  private mapToRecord(row: AuditLogSelect): AuditLogRecord {
    return {
      id: row.id,
      actorUserId: row.actorUserId,
      timestamp: row.timestamp,
      boardId: row.boardId,
      operation: row.operation,
      targetId: row.targetId,
      previousState: (row.previousState as Record<string, unknown> | null) ?? null,
      newState: (row.newState as Record<string, unknown> | null) ?? null,
      metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    };
  }
}
