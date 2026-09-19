import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users.ts";

/**
 * Tabulka uživatelských notifikací (Notification).
 * Reprezentuje osobní a privátní záznam oznámení pro konkrétního uživatele.
 *
 * Stav přečtení:
 * - read_at = NULL => nepřečteno
 * - read_at = Timestamp => přečteno
 *
 * event_id umožňuje zpětné dohledání původní doménové události a zajišťuje idempotenci.
 */
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipientUserId: uuid("recipient_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventId: uuid("event_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
});

export type NotificationSelect = typeof notifications.$inferSelect;
export type NotificationInsert = typeof notifications.$inferInsert;
