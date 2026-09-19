import { pgTable, uuid, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { users } from "./users.ts";
import { boards } from "./boards.ts";

/**
 * Role člena v rámci konkrétní Nástěnky.
 * Striktně odděleno od User.global_role!
 */
export const membershipRoleEnum = pgEnum("membership_role", [
  "OWNER",
  "MANAGER",
  "MEMBER",
]);

/**
 * Tabulka členství (Membership).
 * Propojuje uživatele s konkrétní Nástěnkou a definuje jeho kontextovou roli.
 *
 * Invariant: Každý uživatel má na dané Nástěnce nejvýše jedno členství (UNIQUE user_id, board_id).
 */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unikátní constraint pro pár (user_id, board_id)
    unique("memberships_user_board_unique").on(table.userId, table.boardId),
  ],
);

export type MembershipSelect = typeof memberships.$inferSelect;
export type MembershipInsert = typeof memberships.$inferInsert;
