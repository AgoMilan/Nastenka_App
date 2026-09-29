"use client";

import * as React from "react";
import { useActionState } from "react";
import { deleteTaskAction } from "@/app/(authenticated)/app/board/[boardId]/task-actions.ts";
import { Button } from "@/components/ui/button.tsx";

export interface DeleteTaskDialogProps {
  readonly boardId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function DeleteTaskDialog({
  boardId,
  taskId,
  taskTitle,
  isOpen,
  onClose,
}: DeleteTaskDialogProps) {
  const [state, formAction, isPending] = useActionState(deleteTaskAction, null);
  const [confirmation, setConfirmation] = React.useState("");

  // Reset při otevření
  React.useEffect(() => {
    setConfirmation("");
  }, [taskId, isOpen]);

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
      aria-labelledby="delete-task-title"
    >
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600 text-lg">⚠️</span>
            <h2 id="delete-task-title" className="text-base font-semibold text-zinc-900">
              Smazat úkol trvale?
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
            Chystáte se definitivně smazat úkol{" "}
            <span className="font-semibold text-zinc-900">„{taskTitle}“</span>.
          </p>
          <p className="text-xs text-red-600 font-medium">
            Tato akce představuje řízený hard-delete. Úkol bude nevratně odstraněn ze systému včetně všech přiřazení spoluřešitelů. Tuto akci nelze vrátit zpět.
          </p>
          <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3 mt-2">
            <label htmlFor="delete-task-confirm" className="block text-xs font-medium text-zinc-700 mb-1">
              Pro potvrzení napište: <span className="font-bold text-red-600">SMAZAT</span>
            </label>
            <input
              id="delete-task-confirm"
              type="text"
              required
              autoFocus
              autoComplete="off"
              disabled={isPending}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="SMAZAT"
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 bg-white"
            />
          </div>
        </div>

        {state?.error && (
          <div className="mb-4 rounded-md bg-red-50 p-2.5 text-xs text-red-700 border border-red-200 text-left">
            {state.error}
          </div>
        )}

        <form action={formAction}>
          <input type="hidden" name="boardId" value={boardId} />
          <input type="hidden" name="taskId" value={taskId} />
          <input type="hidden" name="confirmation" value={confirmation} />

          <div className="flex items-center justify-end gap-3 pt-2">
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
              {isPending ? "Mažu..." : "Smazat úkol"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
