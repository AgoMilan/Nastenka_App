import { pgTable, uuid, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import { users } from "./users.ts";
import { boards } from "./boards.ts";
import { tasks } from "./tasks.ts";

/**
 * Tabulka osobního pořadí úkolů uživatele (UserTaskOrder).
 * Ukládá pořadí úkolů specifické pro konkrétního uživatele v rámci dané nástěnky.
 *
 * Invarianty (STEP 6 – Personal Ordering):
 * 1. Pořadí je striktně osobní pro daného uživatele (user_id).
 * 2. Změna pořadí uživatele A nikdy neovlivní uživatele B.
 * 3. Každý uživatel má pro daný úkol nejvýše jednu pozici: UNIQUE(user_id, task_id).
 * 4. Kaskádové mazání (ON DELETE CASCADE) při smazání uživatele, nástěnky nebo úkolu.
 */
export const userTaskOrders = pgTable(
  "user_task_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("user_task_orders_user_task_unique").on(table.userId, table.taskId),
    index("user_task_orders_board_user_idx").on(table.boardId, table.userId),
  ],
);

export type UserTaskOrderSelect = typeof userTaskOrders.$inferSelect;
export type UserTaskOrderInsert = typeof userTaskOrders.$inferInsert;
