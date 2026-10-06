import type { AuditEvent } from "./audit-events.ts";

export interface AuditLogActor {
  readonly id: string;
  readonly name: string;
}

export interface AuditLogView {
  readonly id: string;
  readonly actor: AuditLogActor;
  readonly timestamp: Date;
  readonly boardId: string | null;
  readonly operation: AuditEvent | string;
  readonly targetId: string;
  readonly previousState: Record<string, unknown> | null;
  readonly newState: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown> | null;
}
