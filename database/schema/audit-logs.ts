import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users.ts";
import { boards } from "./boards.ts";

/**
 * Tabulka nezávislého auditního protokolu (AuditLog).
 * Slouží pro neměnný chronologický záznam správních a destruktivních operací.
 *
 * Zásadní architektonické invarianty:
 * 1. target_id NENÍ cizí klíč (FK), aby auditní stopa přežila trvalé smazání cílového objektu (DELETE_TASK, DELETE_AREA).
 * 2. actor_user_id reprezentuje původce akce (Actor), získaného výhradně ze serverové session.
 * 3. Záznamy jsou striktně append-only – neobsahují secrets ani hesla.
 */
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  boardId: uuid("board_id").references(() => boards.id, {
    onDelete: "set null",
  }),
  operation: varchar("operation", { length: 50 }).notNull(),
  targetId: varchar("target_id", { length: 255 }).notNull(),
  previousState: jsonb("previous_state"),
  newState: jsonb("new_state"),
  metadata: jsonb("metadata"),
});

export type AuditLogSelect = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;
