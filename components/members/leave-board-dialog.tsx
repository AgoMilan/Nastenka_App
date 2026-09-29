"use client";

import * as React from "react";
import { useActionState } from "react";
import { leaveBoardAction } from "@/app/(authenticated)/app/board/[boardId]/member-actions.ts";
import { Button } from "@/components/ui/button.tsx";

export interface LeaveBoardDialogProps {
  readonly boardId: string;
  readonly boardName: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function LeaveBoardDialog({
  boardId,
  boardName,
  isOpen,
  onClose,
}: LeaveBoardDialogProps) {
  const [state, formAction, isPending] = useActionState(leaveBoardAction, null);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-board-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
          <h2
            id="leave-board-title"
            className="text-base font-semibold text-zinc-900"
          >
            Opustit nástěnku?
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

        <form action={formAction} className="space-y-4 text-left">
          <input type="hidden" name="boardId" value={boardId} />

          {state?.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {state.error}
            </div>
          )}

          <p className="text-sm text-zinc-700">
            Opravdu chcete dobrovolně opustit nástěnku{" "}
            <span className="font-semibold text-zinc-900">{boardName}</span>?
          </p>

          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 space-y-1">
            <p className="font-semibold">Upozornění:</p>
            <p>
              Ztratíte přístup k této nástěnce. Veškeré úkoly, kde jste byl/a hlavním řešitelem, přejdou do stavu Nepřiřazeno a budete odebrán/a ze všech spoluřešitelů.
            </p>
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
            <Button type="submit" variant="danger" disabled={isPending}>
              {isPending ? "Opouštím..." : "Opustit nástěnku"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
