"use client";

import * as React from "react";
import { useActionState } from "react";
import { deleteAreaAction } from "@/app/(authenticated)/app/board/[boardId]/area-actions.ts";
import { Button } from "@/components/ui/button.tsx";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";

export interface DeleteAreaDialogProps {
  readonly boardId: string;
  readonly area: AreaView;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function DeleteAreaDialog({
  boardId,
  area,
  isOpen,
  onClose,
}: DeleteAreaDialogProps) {
  const [state, formAction, isPending] = useActionState(deleteAreaAction, null);
  const [confirmation, setConfirmation] = React.useState("");

  // Reset při otevření
  React.useEffect(() => {
    setConfirmation("");
  }, [area, isOpen]);

  // Zavření po úspěšném smazání
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

  const isConfirmed = confirmation === "SMAZAT";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-area-title"
    >
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600 text-lg">⚠️</span>
            <h2 id="delete-area-title" className="text-base font-semibold text-zinc-900">
              Smazat oblast?
            </h2>
          </div>
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

        <div className="space-y-3 text-sm text-zinc-600 mb-6 text-left">
          <p>
            Chystáte se smazat oblast{" "}
            <span className="font-semibold text-zinc-900">„{area.name}“</span>.
          </p>
          <p className="text-xs text-red-600 font-medium">
            Tato akce odstraní oblast a související vazby podle existující doménové logiky.
            Tuto akci nelze vrátit zpět.
          </p>
          <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 mt-2">
            <label htmlFor="delete-confirm" className="block text-xs font-medium text-zinc-700 mb-1">
              Pro potvrzení napište: <span className="font-bold text-red-600">SMAZAT</span>
            </label>
            <input
              id="delete-confirm"
              type="text"
              required
              autoFocus
              autoComplete="off"
              disabled={isPending}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="SMAZAT"
              className="block w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-900 shadow-xs focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 disabled:opacity-50"
            />
          </div>
        </div>

        {state?.error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200 mb-4 text-left">
            {state.error}
          </div>
        )}

        <form action={formAction}>
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="areaId" value={area.id} />
          <input type="hidden" name="confirmation" value={confirmation} />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Zrušit
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={!isConfirmed || isPending}
            >
              {isPending ? "Mazání..." : "Smazat"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
