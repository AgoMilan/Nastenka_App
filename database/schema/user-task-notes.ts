import { pgTable, uuid, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { users } from "./users.ts";
import { tasks } from "./tasks.ts";

/**
 * Tabulka soukromých poznámek uživatele k úkolu (UserTaskNote).
 * Osobní pracovní prostor vázaný k danému úkolu.
 *
 * Invarianty (Osobní poznámky):
 * 1. Každý záznam patří právě jednomu uživateli (user_id) a jednomu úkolu (task_id).
 * 2. Jeden uživatel může mít maximálně jednu aktivní poznámku k jednomu úkolu: UNIQUE(user_id, task_id).
 * 3. Při smazání úkolu se související soukromé poznámky automaticky odstraní (ON DELETE CASCADE).
 * 4. Při smazání uživatelského účtu se odstraní jeho soukromé poznámky (ON DELETE CASCADE).
 * 5. Text poznámky (content) je striktně osobní – žádný jiný uživatel (ani člen, MANAGER, OWNER či ADMIN)
 *    k němu nemá přístup ani oprávnění k nahlížení.
 */
export const userTaskNotes = pgTable(
  "user_task_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("user_task_notes_user_task_unique").on(table.userId, table.taskId),
    index("user_task_notes_task_idx").on(table.taskId),
    index("user_task_notes_user_idx").on(table.userId),
  ],
);

export type UserTaskNoteSelect = typeof userTaskNotes.$inferSelect;
export type UserTaskNoteInsert = typeof userTaskNotes.$inferInsert;
