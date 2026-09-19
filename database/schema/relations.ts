import { relations } from "drizzle-orm";
import { users } from "./users.ts";
import { boards } from "./boards.ts";
import { memberships } from "./memberships.ts";

/**
 * Relační vazby pro uživatele (User).
 */
export const usersRelations = relations(users, ({ many }) => ({
  createdBoards: many(boards),
  memberships: many(memberships),
}));

/**
 * Relační vazby pro Nástěnku (Board).
 */
export const boardsRelations = relations(boards, ({ one, many }) => ({
  creator: one(users, {
    fields: [boards.createdBy],
    references: [users.id],
  }),
  memberships: many(memberships),
}));

/**
 * Relační vazby pro členství (Membership).
 */
export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  board: one(boards, {
    fields: [memberships.boardId],
    references: [boards.id],
  }),
}));
