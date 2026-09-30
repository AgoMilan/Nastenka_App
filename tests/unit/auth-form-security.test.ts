import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { loginSchema, registerSchema } from "../../modules/auth/index.ts";

describe("Auth Form Security – Prevention of credentials in GET URLs", () => {
  const loginFormPath = path.resolve(
    process.cwd(),
    "components/auth/login-form.tsx",
  );
  const registerFormPath = path.resolve(
    process.cwd(),
    "components/auth/register-form.tsx",
  );

  const loginSource = fs.readFileSync(loginFormPath, "utf-8");
  const registerSource = fs.readFileSync(registerFormPath, "utf-8");

  // ── 1. Login Form Bezpečnost ──────────────────────────────────────────
  describe("1. LoginForm – Ochrana proti úniku hesla do URL", () => {
    test("LoginForm <form> má explicitně definovaný atribut method=\"post\"", () => {
      // Ověření, že tag form obsahuje method="post"
      const formTagMatch = loginSource.match(/<form\s+[\s\S]*?>/);
      assert.ok(formTagMatch, "Komponent LoginForm musí obsahovat element <form>");
      const formTag = formTagMatch[0];

      assert.ok(
        formTag.includes('method="post"'),
        "Element <form> v LoginForm musí explicitně obsahovat method=\"post\"",
      );
      assert.ok(
        !formTag.includes('method="get"'),
        "Element <form> nesmí mít method=\"get\"",
      );
    });

    test("LoginForm obsahuje onSubmit s handlerem handleSubmit", () => {
      const formTagMatch = loginSource.match(/<form\s+[\s\S]*?>/);
      assert.ok(formTagMatch);
      assert.ok(
        formTagMatch[0].includes("onSubmit={handleSubmit}"),
        "Element <form> musí mít navázaný handler onSubmit={handleSubmit}",
      );
    });

    test("handleSubmit v LoginForm volá e.preventDefault() na začátku", () => {
      const handleSubmitMatch = loginSource.match(
        /const\s+handleSubmit\s*=\s*async\s*\(([^)]+)\)\s*=>\s*\{([\s\S]*?)\};/,
      );
      assert.ok(handleSubmitMatch, "LoginForm musí definovat funkci handleSubmit");
      const handlerBody = handleSubmitMatch[2];

      assert.ok(
        handlerBody.includes("e.preventDefault()"),
        "handleSubmit musí volat e.preventDefault() pro zabránění nativnímu odeslání prohlížečem",
      );
    });

    test("Submit tlačítko má type=\"submit\"", () => {
      assert.ok(
        loginSource.includes('type="submit"'),
        "LoginForm musí mít tlačítko s type=\"submit\"",
      );
    });

    test("LoginForm používá authClient.signIn.email pro přihlášení", () => {
      assert.ok(
        loginSource.includes("authClient.signIn.email("),
        "LoginForm musí volat authClient.signIn.email()",
      );
    });

    test("Citlivá pole (email, password) jsou chráněna v rámci method=\"post\" formuláře", () => {
      assert.ok(loginSource.includes('name="email"'));
      assert.ok(loginSource.includes('name="password"'));
      // Protože formulář má method="post", při případném native fallback submitu se data odešlou v těle POST requestu, nikdy ne v URL query parametrech
    });

    test("loginSchema validuje přihlašovací údaje před odesláním", () => {
      const valid = loginSchema.safeParse({
        email: "uzivatel@priklad.cz",
        password: "mojeBezpecneHeslo123",
      });
      assert.equal(valid.success, true);
    });
  });

  // ── 2. Register Form Bezpečnost ───────────────────────────────────────
  describe("2. RegisterForm – Ochrana proti úniku hesla do URL", () => {
    test("RegisterForm <form> má explicitně definovaný atribut method=\"post\"", () => {
      const formTagMatch = registerSource.match(/<form\s+[\s\S]*?>/);
      assert.ok(formTagMatch, "Komponent RegisterForm musí obsahovat element <form>");
      const formTag = formTagMatch[0];

      assert.ok(
        formTag.includes('method="post"'),
        "Element <form> v RegisterForm musí explicitně obsahovat method=\"post\"",
      );
      assert.ok(
        !formTag.includes('method="get"'),
        "Element <form> nesmí mít method=\"get\"",
      );
    });

    test("RegisterForm obsahuje onSubmit s handlerem handleSubmit", () => {
      const formTagMatch = registerSource.match(/<form\s+[\s\S]*?>/);
      assert.ok(formTagMatch);
      assert.ok(
        formTagMatch[0].includes("onSubmit={handleSubmit}"),
        "Element <form> musí mít navázaný handler onSubmit={handleSubmit}",
      );
    });

    test("handleSubmit v RegisterForm volá e.preventDefault() na začátku", () => {
      const handleSubmitMatch = registerSource.match(
        /const\s+handleSubmit\s*=\s*async\s*\(([^)]+)\)\s*=>\s*\{([\s\S]*?)\};/,
      );
      assert.ok(handleSubmitMatch, "RegisterForm musí definovat funkci handleSubmit");
      const handlerBody = handleSubmitMatch[2];

      assert.ok(
        handlerBody.includes("e.preventDefault()"),
        "handleSubmit musí volat e.preventDefault() pro zabránění nativnímu odeslání prohlížečem",
      );
    });

    test("Submit tlačítko má type=\"submit\"", () => {
      assert.ok(
        registerSource.includes('type="submit"'),
        "RegisterForm musí mít tlačítko s type=\"submit\"",
      );
    });

    test("RegisterForm používá authClient.signUp.email pro registraci", () => {
      assert.ok(
        registerSource.includes("authClient.signUp.email("),
        "RegisterForm musí volat authClient.signUp.email()",
      );
    });

    test("Citlivá pole (email, password, confirmPassword) jsou chráněna v rámci method=\"post\" formuláře", () => {
      assert.ok(registerSource.includes('name="name"'));
      assert.ok(registerSource.includes('name="email"'));
      assert.ok(registerSource.includes('name="password"'));
      assert.ok(registerSource.includes('name="confirmPassword"'));
    });

    test("registerSchema validuje registrační údaje před odesláním", () => {
      const valid = registerSchema.safeParse({
        name: "Jan Novák",
        email: "uzivatel@priklad.cz",
        password: "mojeBezpecneHeslo123",
        confirmPassword: "mojeBezpecneHeslo123",
      });
      assert.equal(valid.success, true);
    });
  });
});
