"use client";

import * as React from "react";
import { Button } from "@/components/ui/button.tsx";
import { CreateBoardForm } from "./create-board-form.tsx";

/**
 * Sekce pro vytvoření nové Nástěnky na stránce „Moje nástěnky“.
 * Umožňuje otevřít/zavřít formulář pro vytvoření Nástěnky.
 */
export function CreateBoardSection() {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)}>
        + Vytvořit nástěnku
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
        <h2 className="text-base font-semibold text-zinc-900">
          Nová nástěnka
        </h2>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-zinc-400 hover:text-zinc-600 text-sm focus:outline-none"
        >
          ✕
        </button>
      </div>
      <CreateBoardForm onCancel={() => setIsOpen(false)} />
    </div>
  );
}
