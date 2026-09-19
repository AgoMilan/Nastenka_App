import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { users } from "./users.ts";
import { boards } from "./boards.ts";
import { areas } from "./areas.ts";

/**
 * Životní stavy úkolu podle schváleného funkčního modelu (docs/030_Funkcni_model.md).
 */
export const taskStatusEnum = pgEnum("task_status", [
  "NOVÉ",
  "PŘEVZATÉ",
  "ROZPRACOVANÉ",
  "ČEKÁ SE",
  "HOTOVO",
  "ARCHIVOVÁNO",
]);

/**
 * Priority úkolu podle schválené specifikace.
 */
export const taskPriorityEnum = pgEnum("task_priority", ["BĚŽNÁ", "SPĚCHÁ"]);

/**
 * Tabulka úkolů (Task).
 * Základní pracovní jednotka patřící konkrétní Nástěnce a volitelně oblasti.
 *
 * Autonomie rolí:
 * - created_by = autor úkolu (neměnný, ON DELETE RESTRICT)
 * - assignee_id = Hlavní Řešitel (NULL = Nepřiřazeno, ON DELETE SET NULL)
 *
 * Životní cyklus: Kontrolovaný hard-delete (nemá deleted_at).
 */
export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  areaId: uuid("area_id").references(() => areas.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("NOVÉ").notNull(),
  priority: taskPriorityEnum("priority").default("BĚŽNÁ").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true, mode: "date" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  assigneeId: uuid("assignee_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
});

export type TaskSelect = typeof tasks.$inferSelect;
export type TaskInsert = typeof tasks.$inferInsert;
