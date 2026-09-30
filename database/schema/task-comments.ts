import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { tasks } from "./tasks.ts";
import { users } from "./users.ts";

/**
 * Tabulka komentářů úkolu (TaskComment).
 * Uživatelská diskuze vázaná k danému úkolu.
 *
 * Invarianty (STEP 8):
 * 1. Každý komentář patří právě jednomu úkolu (task_id).
 * 2. Při smazání úkolu se komentáře kaskádově smažou (ON DELETE CASCADE).
 * 3. Uživatel nemůže být smazán, pokud existují jeho komentáře (ON DELETE RESTRICT) pro zachování integrity diskuze.
 * 4. Indexy pro rychlé chronologické načtení (task_id, created_at) a dohledání autora (author_id).
 */
export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("task_comments_task_created_idx").on(table.taskId, table.createdAt),
    index("task_comments_author_idx").on(table.authorId),
  ],
);

export type TaskCommentSelect = typeof taskComments.$inferSelect;
export type TaskCommentInsert = typeof taskComments.$inferInsert;
