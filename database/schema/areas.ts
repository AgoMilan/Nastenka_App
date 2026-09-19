import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { boards } from "./boards.ts";

/**
 * Tabulka organizačních oblastí Nástěnky (Area).
 * Oblasti jsou uživatelsky definované okruhy práce (např. Prodejna, Sklad, Dům).
 *
 * Invariant: Název oblasti je unikátní v rámci konkrétní Nástěnky (UNIQUE board_id, name).
 * Životní cyklus: Kontrolovaný hard-delete (nemá deleted_at).
 */
export const areas = pgTable(
  "areas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [unique("areas_board_name_unique").on(table.boardId, table.name)],
);

export type AreaSelect = typeof areas.$inferSelect;
export type AreaInsert = typeof areas.$inferInsert;
