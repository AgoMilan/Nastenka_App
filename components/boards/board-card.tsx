import * as React from "react";
import Link from "next/link";
import type { UserBoardRecord } from "@/modules/boards/application/ports/index.ts";
import { RoleBadge } from "./role-badge.tsx";

export interface BoardCardProps {
  readonly board: UserBoardRecord;
}

/**
 * Karta Nástěnky v přehledu „Moje nástěnky“.
 * Zobrazuje název, roli uživatele, volitelný popis a odkaz na detail nástěnky.
 */
export function BoardCard({ board }: BoardCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-xs hover:border-zinc-300 hover:shadow-sm transition-all">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 group-hover:text-zinc-600 line-clamp-1">
            <Link
              href={`/app/board/${board.id}`}
              className="hover:underline focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 rounded"
            >
              {board.name}
            </Link>
          </h2>
          <RoleBadge role={board.role} />
        </div>

        {board.description ? (
          <p className="mt-2 text-sm text-zinc-600 line-clamp-2">
            {board.description}
          </p>
        ) : (
          <p className="mt-2 text-xs italic text-zinc-400">Bez popisu</p>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-zinc-100 flex items-center justify-between">
        <span className="text-xs text-zinc-400">
          Vytvořeno: {new Date(board.createdAt).toLocaleDateString("cs-CZ")}
        </span>
        <Link
          href={`/app/board/${board.id}`}
          className="text-xs font-semibold text-zinc-900 hover:text-zinc-700 hover:underline"
        >
          Otevřít nástěnku →
        </Link>
      </div>
    </div>
  );
}
