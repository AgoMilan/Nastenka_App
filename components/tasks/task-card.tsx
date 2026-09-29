import * as React from "react";
import type { BoardTaskView } from "@/modules/tasks/application/use-cases/get-board-tasks.use-case.ts";
import type { TaskStatus } from "@/modules/tasks/application/ports/task-repository.port.ts";

export interface TaskCardProps {
  readonly task: BoardTaskView;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; className: string }
> = {
  NOVÉ: {
    label: "Nové",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  PŘEVZATÉ: {
    label: "Převzaté",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  ROZPRACOVANÉ: {
    label: "Rozpracované",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  "ČEKÁ SE": {
    label: "Čeká se",
    className: "bg-orange-50 text-orange-700 border-orange-200",
  },
  HOTOVO: {
    label: "Hotovo",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  ARCHIVOVÁNO: {
    label: "Archivováno",
    className: "bg-zinc-100 text-zinc-500 border-zinc-200",
  },
};

export function TaskCard({ task }: TaskCardProps) {
  const statusConfig = STATUS_CONFIG[task.status] ?? {
    label: task.status,
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };

  const isOverdue =
    task.dueDate !== null &&
    task.status !== "HOTOVO" &&
    task.status !== "ARCHIVOVÁNO" &&
    new Date(task.dueDate).getTime() < Date.now();

  const formattedDueDate = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("cs-CZ")
    : null;

  return (
    <article
      className="rounded-lg border border-zinc-200 bg-white p-3.5 shadow-2xs transition-shadow hover:shadow-xs text-left"
      aria-labelledby={`task-title-${task.id}`}
    >
      {/* Horní řádek: Stav + Priorita */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusConfig.className}`}
        >
          {statusConfig.label}
        </span>

        {task.priority === "SPĚCHÁ" && (
          <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
            <span>●</span> Spěchá
          </span>
        )}
      </div>

      {/* Název úkolu */}
      <h4
        id={`task-title-${task.id}`}
        className="text-sm font-semibold text-zinc-900 tracking-tight break-words"
      >
        {task.title}
      </h4>

      {/* Popis úkolu (pokud existuje) */}
      {task.description && (
        <p className="mt-1 text-xs text-zinc-600 line-clamp-2 break-words whitespace-pre-line">
          {task.description}
        </p>
      )}

      {/* Spodní metadata: Termín, Řešitel, Spoluřešitelé, Autor */}
      <div className="mt-3 pt-2.5 border-t border-zinc-100 space-y-1.5 text-xs text-zinc-500">
        {/* Termín */}
        {formattedDueDate && (
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Termín:</span>
            <span
              className={
                isOverdue
                  ? "font-semibold text-red-600"
                  : "text-zinc-700"
              }
            >
              {formattedDueDate}
              {isOverdue && " (po termínu)"}
            </span>
          </div>
        )}

        {/* Řešitel */}
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-400">Řešitel:</span>
          {task.assignee ? (
            <span className="font-medium text-zinc-800">
              {task.assignee.name || "Neznámý uživatel"}
            </span>
          ) : (
            <span className="text-zinc-400 italic">Nepřiřazeno</span>
          )}
        </div>

        {/* Spoluřešitelé (pokud existují) */}
        {task.participants.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400">Spoluřešitelé:</span>
            <span className="text-zinc-700">
              {task.participants.map((p) => p.name || "Neznámý uživatel").join(", ")}
            </span>
          </div>
        )}

        {/* Autor */}
        <div className="text-[11px] text-zinc-400 pt-0.5">
          Zadal/a: {task.createdBy.name || "Neznámý uživatel"}
        </div>
      </div>
    </article>
  );
}
