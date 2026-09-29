"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateBoardAction } from "@/app/(authenticated)/app/board/[boardId]/board-actions.ts";
import { Button } from "@/components/ui/button.tsx";

export interface EditBoardDialogProps {
  readonly boardId: string;
  readonly boardName: string;
  readonly boardDescription: string | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function EditBoardDialog({
  boardId,
  boardName,
  boardDescription,
  isOpen,
  onClose,
}: EditBoardDialogProps) {
  const [state, formAction, isPending] = useActionState(updateBoardAction, null);
  const [name, setName] = React.useState(boardName);
  const [description, setDescription] = React.useState(boardDescription ?? "");
  const [nameError, setNameError] = React.useState<string | null>(null);

  // Synchronizace při otevření dialogu nebo změně hodnot nástěnky
  React.useEffect(() => {
    setName(boardName);
    setDescription(boardDescription ?? "");
    setNameError(null);
  }, [boardName, boardDescription, isOpen]);

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
      setNameError("Název nástěnky nesmí být prázdný");
      return;
    }

    if (trimmed.length > 255) {
      e.preventDefault();
      setNameError("Název nástěnky nesmí přesáhnout 255 znaků");
      return;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-board-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
          <h2 id="edit-board-title" className="text-base font-semibold text-zinc-900">
            Upravit nástěnku
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

          {state?.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="edit-board-name" className="block text-sm font-medium text-zinc-900">
              Název nástěnky <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-board-name"
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
            <label htmlFor="edit-board-description" className="block text-sm font-medium text-zinc-900">
              Popis <span className="text-xs text-zinc-500 font-normal">(volitelné)</span>
            </label>
            <textarea
              id="edit-board-description"
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

export interface EditBoardButtonProps {
  readonly boardId: string;
  readonly boardName: string;
  readonly boardDescription: string | null;
}

/**
 * Tlačítko pro vyvolání dialogu editace nástěnky na Board Detailu.
 */
export function EditBoardButton({
  boardId,
  boardName,
  boardDescription,
}: EditBoardButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 hover:text-zinc-900 px-3 py-1.5"
      >
        <span>✏️</span>
        <span>Upravit nástěnku</span>
      </Button>
      <EditBoardDialog
        boardId={boardId}
        boardName={boardName}
        boardDescription={boardDescription}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
