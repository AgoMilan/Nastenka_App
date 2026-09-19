import assert from "node:assert/strict";
import { test, describe } from "node:test";
import fs from "node:fs";
import path from "node:path";

describe("Database Migration Verification (Drizzle Kit Artefacts)", () => {
  const migrationsDir = path.join(process.cwd(), "database", "migrations");
  const metaDir = path.join(migrationsDir, "meta");
  const journalFile = path.join(metaDir, "_journal.json");

  test("adresář database/migrations obsahuje vygenerované artefakty", () => {
    assert.ok(
      fs.existsSync(migrationsDir),
      "database/migrations adresář musí existovat",
    );
    assert.ok(
      fs.existsSync(journalFile),
      "metadata žurnál meta/_journal.json musí existovat",
    );

    const files = fs.readdirSync(migrationsDir);
    const sqlFiles = files.filter((f) => f.endsWith(".sql"));
    assert.ok(
      sqlFiles.length >= 1,
      "musí existovat alespoň jeden .sql soubor migrace",
    );
  });

  test("první migrace obsahuje všech 9 tabulek a odpovídající enumy", () => {
    const files = fs.readdirSync(migrationsDir);
    const firstSqlFile = files.find((f) => f.endsWith(".sql"));
    assert.ok(firstSqlFile, "nalezena první migrace");

    const sqlContent = fs.readFileSync(
      path.join(migrationsDir, firstSqlFile),
      "utf-8",
    );

    const expectedTables = [
      "users",
      "boards",
      "memberships",
      "areas",
      "tasks",
      "task_participants",
      "audit_logs",
      "notifications",
      "outbox",
    ];

    for (const table of expectedTables) {
      assert.ok(
        sqlContent.includes(`CREATE TABLE "${table}"`),
        `Migrace musí obsahovat CREATE TABLE "${table}"`,
      );
    }

    const expectedEnums = [
      "global_role",
      "membership_role",
      "task_priority",
      "task_status",
    ];

    for (const en of expectedEnums) {
      assert.ok(
        sqlContent.includes(`CREATE TYPE "public"."${en}"`),
        `Migrace musí obsahovat enum "${en}"`,
      );
    }
  });

  test("audit_logs.target_id nemá cizí klíč (FK) na aplikační tabulky", () => {
    const files = fs.readdirSync(migrationsDir);
    const firstSqlFile = files.find((f) => f.endsWith(".sql"));
    assert.ok(firstSqlFile);

    const sqlContent = fs.readFileSync(
      path.join(migrationsDir, firstSqlFile),
      "utf-8",
    );

    assert.ok(
      !sqlContent.includes("target_id") ||
        !sqlContent.includes(
          'FOREIGN KEY ("target_id") REFERENCES "public"."tasks"',
        ),
      "target_id nesmí mít cizí klíč na tasks",
    );
    assert.ok(
      !sqlContent.includes(
        'FOREIGN KEY ("target_id") REFERENCES "public"."areas"',
      ),
      "target_id nesmí mít cizí klíč na areas",
    );
  });

  test("soft-delete (deleted_at) je přítomen výhradně u users a boards", () => {
    const files = fs.readdirSync(migrationsDir);
    const firstSqlFile = files.find((f) => f.endsWith(".sql"));
    assert.ok(firstSqlFile);

    const sqlContent = fs.readFileSync(
      path.join(migrationsDir, firstSqlFile),
      "utf-8",
    );

    // Rozparsování CREATE TABLE bloků
    const tableBlocks = sqlContent.split("--> statement-breakpoint");
    for (const block of tableBlocks) {
      if (block.includes('CREATE TABLE "users"')) {
        assert.ok(
          block.includes('"deleted_at"'),
          "users musí obsahovat deleted_at",
        );
      } else if (block.includes('CREATE TABLE "boards"')) {
        assert.ok(
          block.includes('"deleted_at"'),
          "boards musí obsahovat deleted_at",
        );
      } else if (
        block.includes('CREATE TABLE "areas"') ||
        block.includes('CREATE TABLE "tasks"') ||
        block.includes('CREATE TABLE "task_participants"') ||
        block.includes('CREATE TABLE "audit_logs"') ||
        block.includes('CREATE TABLE "notifications"') ||
        block.includes('CREATE TABLE "outbox"')
      ) {
        assert.ok(
          !block.includes('"deleted_at"'),
          `Tabulka v bloku nesmí obsahovat deleted_at: ${block.slice(0, 40)}`,
        );
      }
    }
  });

  test("journal metadata obsahuje záznam o první migraci", () => {
    const journalContent = JSON.parse(fs.readFileSync(journalFile, "utf-8"));
    assert.ok(
      Array.isArray(journalContent.entries),
      "entries musí být pole v journalu",
    );
    assert.ok(
      journalContent.entries.length >= 1,
      "journal musí mít alespoň 1 záznam",
    );
    assert.equal(journalContent.entries[0].idx, 0);
  });
});
