"use client";

import * as React from "react";
import { useActionState } from "react";
import { createTaskAction } from "@/app/(authenticated)/app/board/[boardId]/task-actions.ts";
import { Button } from "@/components/ui/button.tsx";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";
import type { BoardMemberView } from "@/modules/boards/application/use-cases/index.ts";

export interface CreateTaskDialogProps {
  readonly boardId: string;
  readonly areas: AreaView[];
  readonly members: BoardMemberView[];
  readonly defaultAreaId?: string | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "OWNER":
      return "Vlastník";
    case "MANAGER":
      return "Správce";
    case "MEMBER":
      return "Člen";
    default:
      return role;
  }
}

export function CreateTaskDialog({
  boardId,
  areas,
  members,
  defaultAreaId,
  isOpen,
  onClose,
}: CreateTaskDialogProps) {
  const [state, formAction, isPending] = useActionState(createTaskAction, null);
  const [titleError, setTitleError] = React.useState<string | null>(null);

  // Zavření po úspěšném vytvoření
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
    setTitleError(null);
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title");

    if (typeof title !== "string" || title.trim().length === 0) {
      e.preventDefault();
      setTitleError("Zadejte prosím název úkolu");
      return;
    }

    if (title.trim().length > 255) {
      e.preventDefault();
      setTitleError("Název úkolu nesmí přesáhnout 255 znaků");
      return;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
          <h2
            id="create-task-title"
            className="text-base font-semibold text-zinc-900"
          >
            Nový úkol
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

        <form
          action={formAction}
          onSubmit={handleSubmit}
          className="space-y-4 text-left"
        >
          <input type="hidden" name="boardId" value={boardId} />

          {state?.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {state.error}
            </div>
          )}

          {/* Název úkolu */}
          <div>
            <label
              htmlFor="task-title"
              className="block text-sm font-medium text-zinc-900"
            >
              Název úkolu <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title"
              name="title"
              type="text"
              required
              autoFocus
              maxLength={255}
              disabled={isPending}
              placeholder="např. Koupit nový regál, Zkontrolovat zásoby..."
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50"
            />
            {titleError && (
              <p className="mt-1 text-xs text-red-600">{titleError}</p>
            )}
          </div>

          {/* Popis úkolu */}
          <div>
            <label
              htmlFor="task-description"
              className="block text-sm font-medium text-zinc-900"
            >
              Popis úkolu{" "}
              <span className="text-xs text-zinc-500 font-normal">
                (volitelné)
              </span>
            </label>
            <textarea
              id="task-description"
              name="description"
              rows={3}
              maxLength={10000}
              disabled={isPending}
              placeholder="Podrobnější informace nebo zadání k úkolu..."
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50 resize-none"
            />
          </div>

          {/* Oblast a Řešitel (vedle sebe) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Oblast */}
            <div>
              <label
                htmlFor="task-areaId"
                className="block text-sm font-medium text-zinc-900"
              >
                Oblast
              </label>
              <select
                id="task-areaId"
                name="areaId"
                defaultValue={defaultAreaId ?? ""}
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50 bg-white"
              >
                <option value="">-- Bez oblasti --</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Řešitel */}
            <div>
              <label
                htmlFor="task-assigneeId"
                className="block text-sm font-medium text-zinc-900"
              >
                Přiřazený řešitel
              </label>
              <select
                id="task-assigneeId"
                name="assigneeId"
                defaultValue=""
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50 bg-white"
              >
                <option value="">Nepřiřazeno</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} ({getRoleLabel(m.role)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Priorita a Termín (vedle sebe) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priorita */}
            <div>
              <label
                htmlFor="task-priority"
                className="block text-sm font-medium text-zinc-900"
              >
                Priorita
              </label>
              <select
                id="task-priority"
                name="priority"
                defaultValue="BĚŽNÁ"
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50 bg-white"
              >
                <option value="BĚŽNÁ">○ Běžná</option>
                <option value="SPĚCHÁ">🔴 Spěchá</option>
              </select>
            </div>

            {/* Termín */}
            <div>
              <label
                htmlFor="task-dueDate"
                className="block text-sm font-medium text-zinc-900"
              >
                Termín splnění{" "}
                <span className="text-xs text-zinc-500 font-normal">
                  (volitelné)
                </span>
              </label>
              <input
                id="task-dueDate"
                name="dueDate"
                type="date"
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50 bg-white"
              />
            </div>
          </div>

          {/* Akční tlačítka */}
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
              {isPending ? "Vytvářím..." : "Vytvořit úkol"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
