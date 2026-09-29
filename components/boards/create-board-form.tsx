"use client";

import * as React from "react";
import { useActionState } from "react";
import { createBoardAction } from "@/app/(authenticated)/app/actions.ts";
import { Button } from "@/components/ui/button.tsx";

export interface CreateBoardFormProps {
  readonly onCancel?: () => void;
}

/**
 * Formulář pro vytvoření nové Nástěnky.
 *
 * Ošetřuje:
 * - Prázdný název / limity znaků (UX validace + autoritativní serverová validace)
 * - Chybové stavy vrácené ze Server Action
 * - Indikaci odesílání formuláře
 */
export function CreateBoardForm({ onCancel }: CreateBoardFormProps) {
  const [state, formAction, isPending] = useActionState(
    createBoardAction,
    null,
  );
  const [nameError, setNameError] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setNameError(null);
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name");

    if (typeof name !== "string" || name.trim().length === 0) {
      e.preventDefault();
      setNameError("Zadejte prosím název nástěnky");
      return;
    }

    if (name.trim().length > 255) {
      e.preventDefault();
      setNameError("Název nástěnky nesmí přesáhnout 255 znaků");
      return;
    }
  };

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="space-y-4 text-left"
    >
      {state?.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="board-name"
          className="block text-sm font-medium text-zinc-900"
        >
          Název nástěnky <span className="text-red-500">*</span>
        </label>
        <input
          id="board-name"
          name="name"
          type="text"
          required
          maxLength={255}
          disabled={isPending}
          placeholder="např. Vývoj webu, Rekonstrukce chaty, Prodejna..."
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50"
        />
        {nameError && (
          <p className="mt-1 text-xs text-red-600">{nameError}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="board-description"
          className="block text-sm font-medium text-zinc-900"
        >
          Popis <span className="text-xs text-zinc-500 font-normal">(volitelné)</span>
        </label>
        <textarea
          id="board-description"
          name="description"
          rows={3}
          maxLength={1000}
          disabled={isPending}
          placeholder="Stručný popis účelu nástěnky..."
          className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50 resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Zrušit
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Vytvářím nástěnku..." : "Vytvořit nástěnku"}
        </Button>
      </div>
    </form>
  );
}
