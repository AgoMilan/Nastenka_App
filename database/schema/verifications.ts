import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Tabulka verifikací (Verification).
 * Odpovídá Better Auth 1.7.5 persistence schema.
 * Slouží k ukládání verifikačních tokenů a jednorázových kódů.
 * Záměrně nemá FK na users, protože Better Auth váže tokeny na textový identifier.
 */
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export type VerificationSelect = typeof verifications.$inferSelect;
export type VerificationInsert = typeof verifications.$inferInsert;
