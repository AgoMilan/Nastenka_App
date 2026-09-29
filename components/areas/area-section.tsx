"use client";

import * as React from "react";
import Link from "next/link";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";
import type { BoardTaskView } from "@/modules/tasks/application/use-cases/get-board-tasks.use-case.ts";
import type { BoardMemberView } from "@/modules/boards/application/use-cases/index.ts";
import { Button } from "@/components/ui/button.tsx";
import { AreaCard } from "./area-card.tsx";
import { CreateAreaDialog } from "./create-area-dialog.tsx";
import { CreateTaskDialog } from "@/components/tasks/create-task-dialog.tsx";
import { TaskCard } from "@/components/tasks/task-card.tsx";

export interface AreaSectionProps {
  readonly boardId: string;
  readonly areas: AreaView[];
  readonly tasks: BoardTaskView[];
  readonly members: BoardMemberView[];
  readonly canManageAreas: boolean;
  readonly canCreateTask: boolean;
  readonly currentFilter?: "ACTIVE" | "ARCHIVED" | "ALL";
}

export function AreaSection({
  boardId,
  areas,
  tasks,
  members,
  canManageAreas,
  canCreateTask,
  currentFilter = "ACTIVE",
}: AreaSectionProps) {
  const [isCreateAreaOpen, setIsCreateAreaOpen] = React.useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = React.useState(false);
  const [selectedAreaId, setSelectedAreaId] = React.useState<string | null>(null);

  const handleOpenCreateTask = (areaId?: string | null) => {
    setSelectedAreaId(areaId ?? null);
    setIsCreateTaskOpen(true);
  };

  const unassignedTasks = tasks.filter((t) => t.areaId === null);

  return (
    <section className="space-y-6" aria-labelledby="areas-heading">
      {/* Záhlaví sekce oblastí a úkolů */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-zinc-200">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2
              id="areas-heading"
              className="text-lg font-bold text-zinc-900 tracking-tight"
            >
              Oblasti
            </h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
              {areas.length}
            </span>
          </div>

          <span className="text-zinc-300 hidden sm:inline">•</span>

          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span>Úkoly:</span>
            <span className="font-semibold text-zinc-800">{tasks.length}</span>
          </div>

          {/* Přepínání filtrů: Aktivní / Archivované */}
          <div className="flex items-center rounded-lg bg-zinc-100 p-0.5 text-xs font-medium text-zinc-600 ml-0 sm:ml-2">
            <Link
              href={`/app/board/${boardId}`}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                currentFilter === "ACTIVE"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "hover:text-zinc-900"
              }`}
            >
              Aktivní
            </Link>
            <Link
              href={`/app/board/${boardId}?filter=ARCHIVED`}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                currentFilter === "ARCHIVED"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "hover:text-zinc-900"
              }`}
            >
              Archivované
            </Link>
          </div>
        </div>

        {/* Akční tlačítka: + Nový úkol a + Nová oblast */}
        <div className="flex items-center gap-2.5 shrink-0">
          {canCreateTask && (
            <Button onClick={() => handleOpenCreateTask(null)}>
              + Nový úkol
            </Button>
          )}

          {canManageAreas && (
            <Button
              variant="outline"
              onClick={() => setIsCreateAreaOpen(true)}
            >
              + Nová oblast
            </Button>
          )}
        </div>
      </div>

      {/* Prázdný stav nebo seznam oblastí */}
      {areas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 sm:p-12 text-center text-zinc-500">
          <span className="text-3xl block mb-3">📁</span>
          <h3 className="text-base font-semibold text-zinc-800">
            Zatím zde nejsou žádné oblasti
          </h3>
          <p className="mt-1 text-sm max-w-md mx-auto text-zinc-500">
            {canManageAreas
              ? "Vytvořte první oblast pro organizaci témat a úkolů na této nástěnce."
              : "Na této nástěnce zatím nebyly vytvořeny žádné oblasti."}
          </p>

          <div className="mt-5 flex items-center justify-center gap-3">
            {canManageAreas && (
              <Button onClick={() => setIsCreateAreaOpen(true)} variant="outline">
                + Vytvořit první oblast
              </Button>
            )}
            {canCreateTask && (
              <Button onClick={() => handleOpenCreateTask(null)}>
                + Nový úkol
              </Button>
            )}
          </div>

          {/* Pokud jsou úkoly bez oblasti i když nejsou definovány oblasti */}
          {unassignedTasks.length > 0 && (
            <div className="mt-8 pt-6 border-t border-zinc-200 text-left max-w-xl mx-auto">
              <h4 className="text-sm font-semibold text-zinc-900 mb-3">
                Nezařazené úkoly ({unassignedTasks.length})
              </h4>
              <div className="space-y-2.5">
                {unassignedTasks.map((t) => (
                  <TaskCard key={t.id} task={t} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {areas.map((area) => (
            <AreaCard
              key={area.id}
              boardId={boardId}
              area={area}
              tasks={tasks.filter((t) => t.areaId === area.id)}
              canManage={canManageAreas}
              canCreateTask={canCreateTask}
              onAddTask={() => handleOpenCreateTask(area.id)}
            />
          ))}

          {/* Box pro úkoly bez přiřazené oblasti, pokud nějaké existují */}
          {unassignedTasks.length > 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/70 p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-base font-semibold text-zinc-800 tracking-tight">
                    Bez oblasti
                  </h3>
                  <span className="rounded-full bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                    {unassignedTasks.length} {unassignedTasks.length === 1 ? "úkol" : unassignedTasks.length >= 2 && unassignedTasks.length <= 4 ? "úkoly" : "úkolů"}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mb-4">
                  Úkoly nezařazené do žádné z oblastí nástěnky.
                </p>

                <div className="space-y-2.5">
                  {unassignedTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </div>

              {canCreateTask && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateTask(null)}
                  className="w-full mt-4 py-1.5 px-3 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md border border-dashed border-zinc-300 transition-colors text-center"
                >
                  + Přidat nezařazený úkol
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dialog pro vytvoření oblasti */}
      {canManageAreas && isCreateAreaOpen && (
        <CreateAreaDialog
          boardId={boardId}
          isOpen={isCreateAreaOpen}
          onClose={() => setIsCreateAreaOpen(false)}
        />
      )}

      {/* Dialog pro vytvoření úkolu */}
      {canCreateTask && isCreateTaskOpen && (
        <CreateTaskDialog
          boardId={boardId}
          areas={areas}
          members={members}
          defaultAreaId={selectedAreaId}
          isOpen={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
        />
      )}
    </section>
  );
}
