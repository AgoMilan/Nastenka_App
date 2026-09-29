"use client";

import * as React from "react";
import { useActionState } from "react";
import { updateTaskAction } from "@/app/(authenticated)/app/board/[boardId]/task-actions.ts";
import { Button } from "@/components/ui/button.tsx";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";
import type { BoardMemberView } from "@/modules/boards/application/use-cases/index.ts";
import type { BoardTaskView } from "@/modules/tasks/application/use-cases/get-board-tasks.use-case.ts";

export interface EditTaskDialogProps {
  readonly boardId: string;
  readonly task: BoardTaskView;
  readonly areas: AreaView[];
  readonly members: BoardMemberView[];
  readonly currentUserRole?: string | null;
  readonly currentUserId?: string;
  readonly isGlobalAdmin?: boolean;
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

function formatDueDateForInput(dueDate: Date | string | null): string {
  if (!dueDate) return "";
  const d = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EditTaskDialog({
  boardId,
  task,
  areas,
  members,
  currentUserRole,
  currentUserId,
  isGlobalAdmin = false,
  isOpen,
  onClose,
}: EditTaskDialogProps) {
  const [state, formAction, isPending] = useActionState(updateTaskAction, null);
  const [titleError, setTitleError] = React.useState<string | null>(null);

  // Oprávnění pro specifické operace dle TaskPolicy:
  // Změna oblasti a termínu vyžaduje roli Řešitele, Spoluřešitele, Správce, Vlastníka nebo Admina.
  const isTaskWorker =
    (currentUserId !== undefined && task.assignee?.userId === currentUserId) ||
    (currentUserId !== undefined &&
      task.participants.some((p) => p.userId === currentUserId));

  const canChangeArea =
    isGlobalAdmin ||
    currentUserRole === "OWNER" ||
    currentUserRole === "MANAGER" ||
    isTaskWorker;

  const canChangeDueDate =
    isGlobalAdmin ||
    currentUserRole === "OWNER" ||
    currentUserRole === "MANAGER" ||
    isTaskWorker;

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

  const formattedDueDate = formatDueDateForInput(task.dueDate);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
          <h2
            id="edit-task-title"
            className="text-base font-semibold text-zinc-900"
          >
            Upravit úkol
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
          <input type="hidden" name="taskId" value={task.id} />

          {state?.error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
              {state.error}
            </div>
          )}

          {/* Název úkolu */}
          <div>
            <label
              htmlFor="edit-task-title-input"
              className="block text-sm font-medium text-zinc-900"
            >
              Název úkolu <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-task-title-input"
              name="title"
              type="text"
              required
              autoFocus
              maxLength={255}
              defaultValue={task.title}
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
              htmlFor="edit-task-description"
              className="block text-sm font-medium text-zinc-900"
            >
              Popis úkolu{" "}
              <span className="text-xs text-zinc-400 font-normal">
                (volitelné)
              </span>
            </label>
            <textarea
              id="edit-task-description"
              name="description"
              rows={3}
              maxLength={10000}
              defaultValue={task.description ?? ""}
              disabled={isPending}
              placeholder="Doplňující informace, instrukce nebo poznámky..."
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50"
            />
          </div>

          {/* Výběr oblasti */}
          <div>
            <label
              htmlFor="edit-task-area"
              className="block text-sm font-medium text-zinc-900"
            >
              Oblast{" "}
              <span className="text-xs text-zinc-400 font-normal">
                (volitelné)
              </span>
            </label>
            {canChangeArea ? (
              <select
                id="edit-task-area"
                name="areaId"
                defaultValue={task.areaId ?? ""}
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50"
              >
                <option value="">Bez oblasti</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <select
                  id="edit-task-area"
                  disabled={true}
                  defaultValue={task.areaId ?? ""}
                  className="mt-1 block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-500 bg-zinc-50 cursor-not-allowed shadow-xs"
                >
                  <option value="">Bez oblasti</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="areaId" value={task.areaId ?? ""} />
                <p className="mt-1 text-xs text-zinc-500">
                  Přesun do jiné oblasti může provést Řešitel, Správce nebo Vlastník.
                </p>
              </>
            )}
          </div>

          {/* Výběr řešitele */}
          <div>
            <label
              htmlFor="edit-task-assignee"
              className="block text-sm font-medium text-zinc-900"
            >
              Hlavní řešitel{" "}
              <span className="text-xs text-zinc-400 font-normal">
                (volitelné)
              </span>
            </label>
            <select
              id="edit-task-assignee"
              name="assigneeId"
              defaultValue={task.assignee?.userId ?? ""}
              disabled={isPending}
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50"
            >
              <option value="">Nepřiřazeno</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name} ({getRoleLabel(member.role)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priorita */}
            <div>
              <label
                htmlFor="edit-task-priority"
                className="block text-sm font-medium text-zinc-900"
              >
                Priorita
              </label>
              <select
                id="edit-task-priority"
                name="priority"
                defaultValue={task.priority}
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50"
              >
                <option value="BĚŽNÁ">Běžná</option>
                <option value="SPĚCHÁ">SPĚCHÁ</option>
              </select>
            </div>

            {/* Termín */}
            <div>
              <label
                htmlFor="edit-task-due-date"
                className="block text-sm font-medium text-zinc-900"
              >
                Termín splnění{" "}
                <span className="text-xs text-zinc-400 font-normal">
                  (volitelné)
                </span>
              </label>
              {canChangeDueDate ? (
                <input
                  id="edit-task-due-date"
                  name="dueDate"
                  type="date"
                  defaultValue={formattedDueDate}
                  disabled={isPending}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50"
                />
              ) : (
                <>
                  <input
                    id="edit-task-due-date"
                    type="date"
                    disabled={true}
                    defaultValue={formattedDueDate}
                    className="mt-1 block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-500 bg-zinc-50 cursor-not-allowed shadow-xs"
                  />
                  <input
                    type="hidden"
                    name="dueDate"
                    value={formattedDueDate}
                  />
                  <p className="mt-1 text-xs text-zinc-500">
                    Změnu termínu může provést Řešitel, Správce nebo Vlastník.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Tlačítka */}
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
