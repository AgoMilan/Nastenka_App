import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loginSchema, registerSchema } from "../../modules/auth/index.ts";

describe("Auth Validation Schemas (Zod)", () => {
  describe("loginSchema", () => {
    test("úspěšně zvaliduje platné přihlašovací údaje", () => {
      const result = loginSchema.safeParse({
        email: "jan.novak@priklad.cz",
        password: "securePassword123",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.email, "jan.novak@priklad.cz");
        assert.equal(result.data.password, "securePassword123");
      }
    });

    test("ořízne (trim) bílé znaky u e-mailu", () => {
      const result = loginSchema.safeParse({
        email: "  jan.novak@priklad.cz  ",
        password: "securePassword123",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.email, "jan.novak@priklad.cz");
      }
    });

    test("odmítne prázdný e-mail", () => {
      const result = loginSchema.safeParse({
        email: "",
        password: "securePassword123",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const emailIssue = result.error.issues.find(
          (i) => i.path[0] === "email",
        );
        assert.ok(emailIssue);
        assert.equal(emailIssue.message, "Zadejte prosím e-mail");
      }
    });

    test("odmítne neplatný formát e-mailu", () => {
      const result = loginSchema.safeParse({
        email: "neplatny-email-bez-zavinace",
        password: "securePassword123",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const emailIssue = result.error.issues.find(
          (i) => i.path[0] === "email",
        );
        assert.ok(emailIssue);
        assert.equal(emailIssue.message, "Zadejte platnou e-mailovou adresu");
      }
    });

    test("odmítne prázdné heslo", () => {
      const result = loginSchema.safeParse({
        email: "jan.novak@priklad.cz",
        password: "",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const passIssue = result.error.issues.find(
          (i) => i.path[0] === "password",
        );
        assert.ok(passIssue);
        assert.equal(passIssue.message, "Zadejte prosím heslo");
      }
    });

    test("odmítne chybějící pole (undefined)", () => {
      const result = loginSchema.safeParse({});

      assert.equal(result.success, false);
      if (!result.success) {
        assert.equal(result.error.issues.length >= 2, true);
      }
    });
  });

  describe("registerSchema", () => {
    const validRegistration = {
      name: "Jan Novák",
      email: "jan.novak@priklad.cz",
      password: "securePassword123",
      confirmPassword: "securePassword123",
    };

    test("úspěšně zvaliduje platnou registraci", () => {
      const result = registerSchema.safeParse(validRegistration);

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.name, "Jan Novák");
        assert.equal(result.data.email, "jan.novak@priklad.cz");
        assert.equal(result.data.password, "securePassword123");
        assert.equal(result.data.confirmPassword, "securePassword123");
      }
    });

    test("ořízne (trim) bílé znaky u jména a e-mailu", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        name: "  Jan Novák  ",
        email: "  jan.novak@priklad.cz  ",
      });

      assert.equal(result.success, true);
      if (result.success) {
        assert.equal(result.data.name, "Jan Novák");
        assert.equal(result.data.email, "jan.novak@priklad.cz");
      }
    });

    test("odmítne prázdné jméno", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        name: "   ",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "name");
        assert.ok(issue);
        assert.equal(issue.message, "Jméno je povinné");
      }
    });

    test("odmítne jméno delší než 255 znaků", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        name: "A".repeat(256),
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "name");
        assert.ok(issue);
        assert.equal(issue.message, "Jméno může mít maximálně 255 znaků");
      }
    });

    test("odmítne prázdný e-mail", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        email: "",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "email");
        assert.ok(issue);
      }
    });

    test("odmítne neplatný formát e-mailu", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        email: "invalid-email-format",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "email");
        assert.ok(issue);
        assert.equal(issue.message, "Zadejte platnou e-mailovou adresu");
      }
    });

    test("odmítne heslo kratší než 8 znaků", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        password: "short",
        confirmPassword: "short",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const issue = result.error.issues.find((i) => i.path[0] === "password");
        assert.ok(issue);
        assert.equal(issue.message, "Heslo musí mít alespoň 8 znaků");
      }
    });

    test("odmítne neshodu hesel (password !== confirmPassword)", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        password: "securePassword123",
        confirmPassword: "differentPassword456",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const issue = result.error.issues.find(
          (i) => i.path[0] === "confirmPassword",
        );
        assert.ok(issue);
        assert.equal(issue.message, "Hesla se neshodují");
      }
    });

    test("odmítne prázdné potvrzení hesla", () => {
      const result = registerSchema.safeParse({
        ...validRegistration,
        confirmPassword: "",
      });

      assert.equal(result.success, false);
      if (!result.success) {
        const issue = result.error.issues.find(
          (i) => i.path[0] === "confirmPassword",
        );
        assert.ok(issue);
      }
    });
  });
});
