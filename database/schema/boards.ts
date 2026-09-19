import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.ts";

/**
 * Tabulka Nástěnek (Board).
 * Reprezentuje samostatný pracovní prostor s vlastními oblastmi, úkoly a členy.
 *
 * DŮLEŽITÉ: created_by představuje pouze historického tvůrce Nástěnky,
 * NIKOLIV nutně aktuálního OWNERa. Aktuální vlastník je určen přes Membership!
 * Nástěnka podporuje soft-delete (deleted_at).
 */
export const boards = pgTable("boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export type BoardSelect = typeof boards.$inferSelect;
export type BoardInsert = typeof boards.$inferInsert;
