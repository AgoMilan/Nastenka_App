"use client";

import * as React from "react";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";
import type { BoardTaskView } from "@/modules/tasks/application/use-cases/get-board-tasks.use-case.ts";
import { EditAreaDialog } from "./edit-area-dialog.tsx";
import { DeleteAreaDialog } from "./delete-area-dialog.tsx";
import { TaskCard } from "@/components/tasks/task-card.tsx";

export interface AreaCardProps {
  readonly boardId: string;
  readonly area: AreaView;
  readonly tasks: BoardTaskView[];
  readonly canManage: boolean;
  readonly canCreateTask: boolean;
  readonly onAddTask?: () => void;
}

export function AreaCard({
  boardId,
  area,
  tasks,
  canManage,
  canCreateTask,
  onAddTask,
}: AreaCardProps) {
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs flex flex-col justify-between transition-shadow hover:shadow-xs">
        <div>
          {/* Záhlaví oblasti: Název + Počet úkolů + Akční tlačítka */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-zinc-900 tracking-tight break-words">
                {area.name}
              </h3>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                {tasks.length} {tasks.length === 1 ? "úkol" : tasks.length >= 2 && tasks.length <= 4 ? "úkoly" : "úkolů"}
              </span>
            </div>

            {canManage && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="rounded p-1 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                  title="Upravit oblast"
                  aria-label={`Upravit oblast ${area.name}`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(true)}
                  className="rounded p-1 text-xs text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Smazat oblast"
                  aria-label={`Smazat oblast ${area.name}`}
                >
                  🗑
                </button>
              </div>
            )}
          </div>

          {area.description && (
            <p className="mt-2 text-xs text-zinc-600 break-words whitespace-pre-line line-clamp-3">
              {area.description}
            </p>
          )}
        </div>

        {/* Sekce úkolů patřících do této oblasti */}
        <div className="mt-5 pt-4 border-t border-zinc-100 space-y-3">
          {tasks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-4 text-center text-xs text-zinc-500">
              <p>V této oblasti zatím nejsou žádné úkoly.</p>
              {canCreateTask && onAddTask && (
                <button
                  type="button"
                  onClick={onAddTask}
                  className="mt-2 text-xs font-semibold text-zinc-800 hover:text-zinc-950 underline decoration-zinc-300 transition-colors"
                >
                  + Přidat úkol
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {tasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>

              {canCreateTask && onAddTask && (
                <button
                  type="button"
                  onClick={onAddTask}
                  className="w-full py-1.5 px-3 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md border border-dashed border-zinc-200 transition-colors text-center"
                >
                  + Přidat úkol
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {canManage && isEditOpen && (
        <EditAreaDialog
          boardId={boardId}
          area={area}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
        />
      )}

      {canManage && isDeleteOpen && (
        <DeleteAreaDialog
          boardId={boardId}
          area={area}
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}
    </>
  );
}
