"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { UserBoardRecord } from "@/modules/boards/application/ports/index.ts";

export interface BoardSwitcherProps {
  readonly currentBoardId: string;
  readonly boards: UserBoardRecord[];
}

/**
 * Jednoduchý a přístupný Board Switcher.
 * Umožňuje přepnout mezi autorizovanými Nástěnkami aktuálního uživatele nebo návrat na přehled.
 *
 * Bezpečnost: Využívá výhradně seznam Nástěnek již autorizovaných pro daného aktéra (GetUserBoardsUseCase).
 */
export function BoardSwitcher({ currentBoardId, boards }: BoardSwitcherProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "all") {
      router.push("/app");
    } else if (value && value !== currentBoardId) {
      router.push(`/app/board/${value}`);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="board-switcher-select" className="sr-only">
        Přepnout nástěnku
      </label>
      <select
        id="board-switcher-select"
        value={currentBoardId}
        onChange={handleChange}
        className="rounded-md border border-zinc-200 bg-white py-1.5 pl-3 pr-8 text-sm font-medium text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
      >
        <optgroup label="Dostupné nástěnky">
          {boards.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </optgroup>
        <option value="all">← Zpět na Moje nástěnky</option>
      </select>
    </div>
  );
}
