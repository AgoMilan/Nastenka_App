/**
 * Audit Event Catalog v1 (docs/050_Architektura.md)
 *
 * Schválených 25 sémantických událostí business operací napříč doménami:
 * - Board (4 události)
 * - Membership (4 události)
 * - Area (3 události)
 * - Task (11/12 událostí)
 * - Comments (3 události)
 *
 * Bezpečnostní a privacy invarianty:
 * 1. ZÁKAZ ukládání textu popisu úkolu (TASK_DESCRIPTION_CHANGED) – pouze indikace přítomnosti/změny.
 * 2. ZÁKAZ ukládání obsahu komentáře (TASK_COMMENT_*) – pouze ID a vazba na úkol.
 * 3. ZÁKAZ auditu privátních poznámek (Private Notes).
 * 4. ZÁKAZ auditu read/view operací.
 * 5. Žádná no-op událost (při nezměněné hodnotě se audit nevytváří).
 */

export const AUDIT_EVENTS = [
  // Board
  "BOARD_CREATED",
  "BOARD_UPDATED",
  "BOARD_OWNER_TRANSFERRED",
  "BOARD_DELETED",

  // Membership
  "MEMBER_ADDED",
  "MEMBER_REMOVED",
  "MEMBER_LEFT_BOARD",
  "MEMBER_ROLE_CHANGED",

  // Area
  "AREA_CREATED",
  "AREA_UPDATED",
  "AREA_DELETED",

  // Task
  "TASK_CREATED",
  "TASK_TITLE_CHANGED",
  "TASK_DESCRIPTION_CHANGED",
  "TASK_STATUS_CHANGED",
  "TASK_PRIORITY_CHANGED",
  "TASK_DUE_DATE_CHANGED",
  "TASK_AREA_CHANGED",
  "TASK_ASSIGNEE_CHANGED",
  "TASK_PARTICIPANT_ADDED",
  "TASK_PARTICIPANT_REMOVED",
  "TASK_ARCHIVED",
  "TASK_DELETED",

  // Comments
  "TASK_COMMENT_CREATED",
  "TASK_COMMENT_EDITED",
  "TASK_COMMENT_DELETED",
] as const;

export type AuditEvent = (typeof AUDIT_EVENTS)[number];

export interface AuditLogRecord {
  readonly id: string;
  readonly actorUserId: string;
  readonly timestamp: Date;
  readonly boardId: string | null;
  readonly operation: AuditEvent | string;
  readonly targetId: string;
  readonly previousState: Record<string, unknown> | null;
  readonly newState: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown> | null;
}
