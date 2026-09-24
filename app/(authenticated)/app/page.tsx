import { headers } from "next/headers";
import { auth } from "@/infrastructure/auth/index.ts";
import { LogoutButton } from "@/components/auth/logout-button.tsx";

export default async function AppPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  const userName = session?.user.name ?? "Uživatel";
  const userEmail = session?.user.email ?? "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-zinc-50 text-zinc-900">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 shadow-sm text-center">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Nástěnka
        </h1>

        <div className="mt-6 rounded-lg bg-zinc-50 border border-zinc-200 p-4 text-left">
          <p className="text-xs uppercase font-semibold text-zinc-500 tracking-wider">
            Jste přihlášen jako:
          </p>
          <p className="mt-1 text-base font-semibold text-zinc-900">
            {userName}
          </p>
          {userEmail && (
            <p className="text-xs text-zinc-600 font-mono mt-0.5">
              {userEmail}
            </p>
          )}
        </div>

        <p className="mt-6 text-sm text-zinc-500">Nástěnka bude následovat.</p>

        <div className="mt-6 flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
