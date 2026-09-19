import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  validateEnv,
  ConfigurationError,
} from "../../infrastructure/configuration/index.ts";

describe("Environment Configuration & Validation (Fail-Fast)", () => {
  const validMockEnv = {
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/nastenka_test",
    BETTER_AUTH_SECRET: "this_is_a_very_secure_random_mock_secret_32chars_long",
    BETTER_AUTH_URL: "http://localhost:3000",
  };

  test("platná konfigurace úspěšně projde validací a doplní výchozí hodnoty", () => {
    const env = validateEnv(validMockEnv);
    assert.equal(env.NODE_ENV, "development");
    assert.equal(env.PORT, 3000);
    assert.equal(env.DATABASE_URL, validMockEnv.DATABASE_URL);
    assert.equal(env.BETTER_AUTH_SECRET, validMockEnv.BETTER_AUTH_SECRET);
    assert.equal(env.BETTER_AUTH_URL, "http://localhost:3000");
  });

  test("chybějící DATABASE_URL vyvolá Fail-Fast ConfigurationError", () => {
    const invalidEnv = {
      BETTER_AUTH_SECRET:
        "this_is_a_very_secure_random_mock_secret_32chars_long",
    };

    assert.throws(
      () => validateEnv(invalidEnv),
      (err: unknown) => {
        assert(err instanceof ConfigurationError);
        assert(err.message.includes("DATABASE_URL"));
        return true;
      },
    );
  });

  test("příliš krátký BETTER_AUTH_SECRET (< 32 znaků) je odmítnut", () => {
    const invalidEnv = {
      DATABASE_URL:
        "postgresql://postgres:postgres@localhost:5432/nastenka_test",
      BETTER_AUTH_SECRET: "too_short_secret",
    };

    assert.throws(
      () => validateEnv(invalidEnv),
      (err: unknown) => {
        assert(err instanceof ConfigurationError);
        assert(err.message.includes("BETTER_AUTH_SECRET"));
        return true;
      },
    );
  });

  test("neplatné schéma databáze (jiné než postgresql://) je odmítnuto", () => {
    const invalidEnv = {
      DATABASE_URL: "mysql://user:pass@localhost:3306/db",
      BETTER_AUTH_SECRET:
        "this_is_a_very_secure_random_mock_secret_32chars_long",
    };

    assert.throws(
      () => validateEnv(invalidEnv),
      (err: unknown) => {
        assert(err instanceof ConfigurationError);
        assert(err.message.includes("DATABASE_URL"));
        return true;
      },
    );
  });

  test("chybová zpráva neobsahuje zadanou tajnou hodnotu", () => {
    const secretValue = "super_secret_that_must_never_leak_in_logs";
    const invalidEnv = {
      DATABASE_URL: "invalid-url",
      BETTER_AUTH_SECRET: secretValue,
    };

    try {
      validateEnv(invalidEnv);
      assert.fail("Mělo dojít k chybě validace");
    } catch (err: unknown) {
      assert(err instanceof ConfigurationError);
      assert(!err.message.includes(secretValue));
    }
  });
});
