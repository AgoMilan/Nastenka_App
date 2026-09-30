import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button.tsx";

interface AppHeaderProps {
  readonly userName: string;
  readonly userEmail?: string;
  readonly activeTab: "boards" | "my-work";
}

export function AppHeader({ userName, userEmail, activeTab }: AppHeaderProps) {
  return (
    <header className="border-b border-zinc-200 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/app"
            className="text-xl font-bold tracking-tight text-zinc-900 hover:text-zinc-700 transition-colors"
          >
            Nástěnka
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/app"
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeTab === "boards"
                  ? "bg-zinc-100 text-zinc-900 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 font-medium"
              }`}
            >
              Moje nástěnky
            </Link>
            <Link
              href="/app/my-work"
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                activeTab === "my-work"
                  ? "bg-zinc-100 text-zinc-900 font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 font-medium"
              }`}
            >
              Moje úkoly
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-zinc-900">{userName}</p>
            {userEmail && (
              <p className="text-xs text-zinc-500 font-mono">{userEmail}</p>
            )}
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
