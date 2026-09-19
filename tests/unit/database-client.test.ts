import assert from "node:assert/strict";
import { test, describe, beforeEach, afterEach } from "node:test";
import { getDb, closeDb } from "../../infrastructure/database/index.ts";
import {
  resetEnvCache,
  ConfigurationError,
} from "../../infrastructure/configuration/index.ts";

describe("Database Client Infrastructure (Drizzle + PostgreSQL)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetEnvCache();
    // Odstranění z process.env pro izolované testování
    delete process.env.DATABASE_URL;
    delete process.env.BETTER_AUTH_SECRET;
  });

  afterEach(async () => {
    await closeDb();
    process.env = { ...originalEnv };
    resetEnvCache();
  });

  test("pokus o inicializaci getDb bez nastaveného DATABASE_URL vyhodí Fail-Fast ConfigurationError", () => {
    assert.throws(
      () => getDb(),
      (err: unknown) => {
        assert(err instanceof ConfigurationError);
        assert(err.message.includes("DATABASE_URL"));
        return true;
      },
    );
  });

  test("s platnou konfigurací se getDb úspěšně inicializuje jako Drizzle klient", () => {
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/nastenka_test";
    process.env.BETTER_AUTH_SECRET =
      "this_is_a_very_secure_mock_secret_longer_than_32_characters";

    const db = getDb();
    assert.ok(db, "Drizzle instance musí existovat");
    assert.equal(typeof db.select, "function", "db.select musí být funkce");
    assert.equal(
      typeof db.transaction,
      "function",
      "db.transaction musí být funkce",
    );

    // Znovuzavolání vrací stejnou instanci (singleton)
    const dbAgain = getDb();
    assert.strictEqual(db, dbAgain, "getDb musí vracet identický singleton");
  });

  test("closeDb bezpečně proběhne i bez aktivního spojení", async () => {
    await assert.doesNotReject(async () => {
      await closeDb();
    });
  });
});
