import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

/**
 * Globální systémové role uživatele.
 * POZOR: Role na Nástěnce (OWNER, MANAGER, MEMBER) sem NEPATŘÍ – jsou definovány v Membership!
 */
export const globalRoleEnum = pgEnum("global_role", ["USER", "ADMIN"]);

/**
 * Tabulka uživatelů (User).
 * Reprezentuje fyzickou osobu v systému.
 * Uživatelský účet využívá soft-delete/deaktivaci (is_active, deleted_at).
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  globalRole: globalRoleEnum("global_role").default("USER").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

export type UserSelect = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
