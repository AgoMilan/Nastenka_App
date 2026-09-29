"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateAreaAction } from "@/app/(authenticated)/app/board/[boardId]/area-actions.ts";
import { Button } from "@/components/ui/button.tsx";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";

export interface EditAreaDialogProps {
  readonly boardId: string;
  readonly area: AreaView;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function EditAreaDialog({
  boardId,
  area,
  isOpen,
  onClose,
}: EditAreaDialogProps) {
  const [state, formAction, isPending] = useActionState(updateAreaAction, null);
  const [name, setName] = React.useState(area.name);
  const [description, setDescription] = React.useState(area.description ?? "");
  const [nameError, setNameError] = React.useState<string | null>(null);

  // Synchronizace při otevření jiné oblasti
  React.useEffect(() => {
    setName(area.name);
    setDescription(area.description ?? "");
    setNameError(null);
  }, [area, isOpen]);

  // Zavření po úspěšném uložení
  React.useEffect(() => {
    if (state?.success) {
      onClose();
    }
  }, [state, onClose]);

  // Klávesa Escape pro zavření
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setNameError(null);
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      e.preventDefault();
      setNameError("Název oblasti nesmí být prázdný");
      return;
    }

    if (trimmed.length > 255) {
      e.preventDefault();
      setNameError("Název oblasti nesmí přesáhnout 255 znaků");
      return;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-area-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
          <h2 id="edit-area-title" className="text-base font-semibold text-zinc-900">
            Upravit oblast
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-zinc-400 hover:text-zinc-600 text-sm focus:outline-none disabled:opacity-50"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </div>

        <form action={formAction} onSubmit={handleSubmit} className="space-y-4 text-left">
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="areaId" value={area.id} />

          {state?.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="edit-area-name" className="block text-sm font-medium text-zinc-900">
              Název oblasti <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-area-name"
              name="name"
              type="text"
              required
              maxLength={255}
              disabled={isPending}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50"
            />
            {nameError && (
              <p className="mt-1 text-xs text-red-600">{nameError}</p>
            )}
          </div>

          <div>
            <label htmlFor="edit-area-description" className="block text-sm font-medium text-zinc-900">
              Popis <span className="text-xs text-zinc-500 font-normal">(volitelné)</span>
            </label>
            <textarea
              id="edit-area-description"
              name="description"
              rows={3}
              maxLength={1000}
              disabled={isPending}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Zrušit
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Ukládám..." : "Uložit změny"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
