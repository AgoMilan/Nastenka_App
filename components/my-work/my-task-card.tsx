"use client";

import * as React from "react";
import Link from "next/link";
import type { MyTaskView } from "@/modules/tasks/application/use-cases/get-my-tasks.use-case.ts";
import type { TaskStatus } from "@/modules/tasks/application/ports/task-repository.port.ts";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";
import type { BoardMemberView } from "@/modules/boards/application/use-cases/index.ts";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog.tsx";
import { TaskCommentsDialog } from "@/components/tasks/task-comments-dialog.tsx";
import { UserTaskNoteDialog } from "./user-task-note-dialog.tsx";

export interface MyTaskCardProps {
  readonly task: MyTaskView;
  readonly areas?: AreaView[];
  readonly members?: BoardMemberView[];
  readonly currentUserRole?: string | null;
  readonly currentUserId?: string;
  readonly isGlobalAdmin?: boolean;
}

function isTaskOverdue(dueDate: Date | null, status: TaskStatus): boolean {
  if (!dueDate) return false;
  if (status === "HOTOVO" || status === "ARCHIVOVÁNO") return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const due = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return due < today;
}

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

function getStatusBadge(status: TaskStatus) {
  switch (status) {
    case "NOVÉ":
      return {
        label: "Nové",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "PŘEVZATÉ":
      return {
        label: "Převzaté",
        className: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    case "ROZPRACOVANÉ":
      return {
        label: "Rozpracované",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "ČEKÁ SE":
      return {
        label: "Čeká se",
        className: "bg-orange-50 text-orange-700 border-orange-200",
      };
    case "HOTOVO":
      return {
        label: "Hotovo",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    case "ARCHIVOVÁNO":
      return {
        label: "Archivováno",
        className: "bg-zinc-100 text-zinc-600 border-zinc-200",
      };
  }
}

export function MyTaskCard({
  task,
  areas = [],
  members = [],
  currentUserRole = null,
  currentUserId,
  isGlobalAdmin = false,
}: MyTaskCardProps) {
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isNoteOpen, setIsNoteOpen] = React.useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = React.useState(false);
  const [commentsCount, setCommentsCount] = React.useState(
    task.commentsCount ?? 0,
  );
  const [hasPrivateNote, setHasPrivateNote] = React.useState(
    task.hasPrivateNote ?? false,
  );

  React.useEffect(() => {
    setCommentsCount(task.commentsCount ?? 0);
  }, [task.commentsCount]);

  React.useEffect(() => {
    setHasPrivateNote(task.hasPrivateNote ?? false);
  }, [task.hasPrivateNote]);

  const statusBadge = getStatusBadge(task.status);
  const overdue = isTaskOverdue(task.dueDate, task.status);
  const formattedDueDate = formatDate(task.dueDate);
  const isArchived = task.status === "ARCHIVOVÁNO";

  // Editace je povolena pro členy nástěnky i ADMINa, pokud úkol není archivován
  const canEdit = !isArchived && (isGlobalAdmin || currentUserRole !== null);

  return (
    <>
      <div className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs hover:border-zinc-300 transition-colors">
        <div>
          {/* Horní řádek: Role, Priorita a Stav */}
          <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Odznak role v úkolu */}
              {task.userRole === "ASSIGNEE" ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                  Řešitel
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                  Spoluřešitel
                </span>
              )}

              {/* Priorita SPĚCHÁ */}
              {task.priority === "SPĚCHÁ" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                  <span className="text-red-500 font-bold">●</span> Spěchá
                </span>
              )}
            </div>

            {/* Odznak stavu */}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          </div>

          {/* Název úkolu s odkazem na nástěnku */}
          <Link
            href={`/app/board/${task.boardId}`}
            className="text-sm font-semibold text-zinc-900 hover:text-zinc-600 line-clamp-2 block transition-colors mb-1"
          >
            {task.title}
          </Link>

          {/* Popis úkolu (pokud existuje) */}
          {task.description && (
            <p className="text-xs text-zinc-500 line-clamp-2 mb-2">
              {task.description}
            </p>
          )}
        </div>

        {/* Spodní část karty: Akční tlačítka + metadata */}
        <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-col gap-2.5 text-xs text-zinc-500">
          {/* Akční tlačítka: [ Upravit ] [ 📝 Moje poznámka ] [ 💬 Diskuze ] */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-900 transition-colors cursor-pointer"
                title="Upravit úkol"
              >
                <span>✏️</span>
                <span>Upravit</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsNoteOpen(true)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                hasPrivateNote
                  ? "bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900"
              }`}
              title={
                hasPrivateNote
                  ? "Moje soukromá poznámka (obsahuje text)"
                  : "Moje soukromá poznámka"
              }
            >
              <span>📝</span>
              <span>Moje poznámka</span>
              {hasPrivateNote && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block ml-0.5"
                  title="Poznámka je uložena"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsCommentsOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-900 transition-colors cursor-pointer"
              title="Týmová diskuze k úkolu"
            >
              <span>💬</span>
              <span>Diskuze</span>
              {commentsCount > 0 && (
                <span className="text-2xs font-semibold px-1 rounded bg-zinc-200 text-zinc-800">
                  {commentsCount}
                </span>
              )}
            </button>
          </div>

          {/* Metadata řádek: Oblast, Termín */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            {/* Oblast */}
            {task.areaName ? (
              <span className="inline-flex items-center gap-1 text-zinc-600 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-200/60 text-2xs font-medium">
                🏷️ {task.areaName}
              </span>
            ) : (
              <span className="text-zinc-400 italic text-2xs">Bez oblasti</span>
            )}

            {/* Termín splnění */}
            {formattedDueDate && (
              <span
                className={`font-medium ${
                  overdue ? "text-red-600 font-semibold" : "text-zinc-600"
                }`}
              >
                📅 {formattedDueDate}
                {overdue && (
                  <span className="ml-1 text-2xs text-red-500 font-bold">
                    (po termínu)
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Odkaz na otevření nástěnky */}
          <div className="flex items-center justify-between pt-1 border-t border-zinc-50 text-2xs">
            <span className="text-zinc-400 truncate max-w-[160px]">
              {task.boardName}
            </span>
            <Link
              href={`/app/board/${task.boardId}`}
              className="text-zinc-700 hover:text-zinc-900 font-medium inline-flex items-center gap-0.5 hover:underline"
            >
              Přejít na nástěnku →
            </Link>
          </div>
        </div>
      </div>

      {/* Dialog pro úpravu úkolu */}
      {isEditOpen && (
        <EditTaskDialog
          boardId={task.boardId}
          task={task}
          areas={areas}
          members={members}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          isGlobalAdmin={isGlobalAdmin}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
        />
      )}

      {/* Dialog pro soukromou poznámku */}
      {isNoteOpen && (
        <UserTaskNoteDialog
          boardId={task.boardId}
          taskId={task.id}
          taskTitle={task.title}
          isArchived={isArchived}
          isOpen={isNoteOpen}
          onClose={() => setIsNoteOpen(false)}
          onNoteChange={(hasNote) => setHasPrivateNote(hasNote)}
        />
      )}

      {/* Dialog pro diskuzi / komentáře k úkolu */}
      {isCommentsOpen && (
        <TaskCommentsDialog
          boardId={task.boardId}
          taskId={task.id}
          taskTitle={task.title}
          isArchived={isArchived}
          isOpen={isCommentsOpen}
          onClose={() => setIsCommentsOpen(false)}
          onCommentCountChange={(newCount) => setCommentsCount(newCount)}
        />
      )}
    </>
  );
}
