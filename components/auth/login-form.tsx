"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/infrastructure/auth/auth-client.ts";
import { loginSchema } from "@/modules/auth/index.ts";
import { Button } from "@/components/ui/button.tsx";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);

    const validationResult = loginSchema.safeParse({ email, password });
    if (!validationResult.success) {
      const formatted: Record<string, string> = {};
      for (const issue of validationResult.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !formatted[field]) {
          formatted[field] = issue.message;
        }
      }
      setFieldErrors(formatted);
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      const { error } = await authClient.signIn.email({
        email: validationResult.data.email,
        password: validationResult.data.password,
      });

      if (error) {
        setGeneralError("Nesprávný e-mail nebo heslo.");
        setIsLoading(false);
        return;
      }

      router.push("/app");
      router.refresh();
    } catch {
      setGeneralError("Nesprávný e-mail nebo heslo.");
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          NÁSTĚNKA
        </h1>
        <p className="mt-1 text-sm font-medium text-zinc-600">Přihlášení</p>
      </div>

      {generalError && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 border border-red-200"
        >
          {generalError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 disabled:bg-zinc-100"
            placeholder="jan.novak@priklad.cz"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider text-zinc-700 mb-1"
          >
            Heslo
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-1 focus:ring-zinc-950 disabled:bg-zinc-100"
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          disabled={isLoading}
        >
          {isLoading ? "Přihlašuji..." : "Přihlásit"}
        </Button>
      </form>

      <div className="mt-6 text-center text-xs text-zinc-500">
        <p>Nemáte účet?</p>
        <Link
          href="/register"
          className="mt-1 font-semibold text-zinc-900 hover:underline"
        >
          Registrovat se
        </Link>
      </div>
    </div>
  );
}
