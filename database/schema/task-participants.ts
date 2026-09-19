import { pgTable, uuid, varchar, timestamp, unique } from "drizzle-orm/pg-core";
import { tasks } from "./tasks.ts";
import { users } from "./users.ts";

/**
 * Tabulka spoluřešitelů úkolu (TaskParticipant).
 * Vazební entita pro evidenci členů týmu podílejících se na řešení úkolu.
 *
 * Invariant: Každý uživatel může být k úkolu připojen jako spoluřešitel nejvýše jednou (UNIQUE task_id, user_id).
 * Kaskáda: Při trvalém smazání úkolu (hard-delete) se záznamy v této tabulce smažou automaticky (ON DELETE CASCADE).
 */
export const taskParticipants = pgTable(
  "task_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).default("SPOLUŘEŠITEL").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("task_participants_task_user_unique").on(table.taskId, table.userId),
  ],
);

export type TaskParticipantSelect = typeof taskParticipants.$inferSelect;
export type TaskParticipantInsert = typeof taskParticipants.$inferInsert;
