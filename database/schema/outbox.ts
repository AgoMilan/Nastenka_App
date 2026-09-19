import { pgTable, uuid, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users.ts";
import { boards } from "./boards.ts";

/**
 * Tabulka transakčního outboxu (Outbox Table).
 * Slouží k atomickému zápisu doménových událostí v téže PostgreSQL transakci
 * jako doménové změny (Transactional Outbox Pattern).
 *
 * Invarianty:
 * 1. event_id je unikátní identifikátor události pro zajištění idempotence příjemců.
 * 2. actor_user_id reprezentuje ověřeného původce akce.
 * 3. target_type a target_id identifikují cílovou entitu.
 * 4. payload neobsahuje citlivé údaje (hesla, tokeny).
 * 5. processed_at eviduje úspěšné zpracování asynchronním workerem.
 */
export const outbox = pgTable("outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventId: uuid("event_id").defaultRandom().notNull().unique(),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  actorUserId: uuid("actor_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  boardId: uuid("board_id").references(() => boards.id, {
    onDelete: "set null",
  }),
  targetType: varchar("target_type", { length: 50 }).notNull(),
  targetId: varchar("target_id", { length: 255 }).notNull(),
  payload: jsonb("payload").notNull(),
  correlationId: varchar("correlation_id", { length: 255 }),
  causationId: varchar("causation_id", { length: 255 }),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
});

export type OutboxSelect = typeof outbox.$inferSelect;
export type OutboxInsert = typeof outbox.$inferInsert;
