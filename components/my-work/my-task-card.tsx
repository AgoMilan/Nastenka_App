"use client";

import * as React from "react";
import Link from "next/link";
import type { MyTaskView } from "@/modules/tasks/application/use-cases/get-my-tasks.use-case.ts";
import type { TaskStatus } from "@/modules/tasks/application/ports/task-repository.port.ts";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";
import type { BoardMemberView } from "@/modules/boards/application/use-cases/index.ts";
import { EditTaskDialog } from "@/components/tasks/edit-task-dialog.tsx";
import { TaskCommentsDialog } from "@/components/tasks/task-comments-dialog.tsx";
import { TaskAuditHistoryDialog } from "@/components/audit/task-audit-history-dialog.tsx";
import { UserTaskNoteDialog } from "./user-task-note-dialog.tsx";
import { changeTaskStatusAction } from "@/app/(authenticated)/app/board/[boardId]/task-actions.ts";

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

const ACTIVE_STATUSES: readonly TaskStatus[] = [
  "NOVÉ",
  "PŘEVZATÉ",
  "ROZPRACOVANÉ",
  "ČEKÁ SE",
  "HOTOVO",
];

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
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const statusMenuRef = React.useRef<HTMLDivElement>(null);

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

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(event.target as Node)
      ) {
        setIsStatusMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const statusConfig = STATUS_CONFIG[task.status] ?? {
    label: task.status,
    className: "bg-zinc-100 text-zinc-700 border-zinc-200",
  };
  const overdue = isTaskOverdue(task.dueDate, task.status);
  const formattedDueDate = formatDate(task.dueDate);
  const isArchived = task.status === "ARCHIVOVÁNO";

  // TASK_CHANGE_STATUS: ASSIGNEE, PARTICIPANT, MANAGER, OWNER, ADMIN (pokud není archivován)
  const canChangeStatus =
    !isArchived &&
    (isGlobalAdmin ||
      currentUserRole === "OWNER" ||
      currentUserRole === "MANAGER" ||
      task.userRole === "ASSIGNEE" ||
      task.userRole === "PARTICIPANT");

  // Editace je povolena pro členy nástěnky i ADMINa, pokud úkol není archivován
  const canEdit = !isArchived && (isGlobalAdmin || currentUserRole !== null);

  const handleStatusChange = (newStatus: TaskStatus) => {
    if (!task.boardId || newStatus === task.status || isPending) return;
    setIsStatusMenuOpen(false);
    setActionError(null);

    const formData = new FormData();
    formData.append("boardId", task.boardId);
    formData.append("taskId", task.id);
    formData.append("status", newStatus);

    startTransition(async () => {
      const res = await changeTaskStatusAction(null, formData);
      if (!res.success && res.error) {
        setActionError(res.error);
      }
    });
  };

  return (
    <>
      <div className={`flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs hover:border-zinc-300 transition-colors ${
        isPending ? "opacity-70 pointer-events-none" : ""
      }`}>
        {/* Chybová zpráva akce */}
        {actionError && (
          <div className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700 border border-red-200 flex items-center justify-between gap-2">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-500 hover:text-red-800 text-xs font-bold cursor-pointer"
              aria-label="Zavřít chybu"
            >
              ✕
            </button>
          </div>
        )}

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

            {/* Stavový badge nebo Quick Status dropdown */}
            {canChangeStatus ? (
              <div className="relative" ref={statusMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                  disabled={isPending}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors hover:brightness-95 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${
                    statusConfig.className
                  } ${isPending ? "opacity-70 cursor-not-allowed" : ""}`}
                  title="Změnit stav úkolu"
                  aria-expanded={isStatusMenuOpen}
                  aria-haspopup="true"
                >
                  <span>{statusConfig.label}</span>
                  <span className="text-[10px] opacity-70">▾</span>
                </button>

                {isStatusMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-30 min-w-36 rounded-md border border-zinc-200 bg-white py-1 shadow-lg animate-in fade-in">
                    <div className="px-2.5 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Změnit stav
                    </div>
                    {ACTIVE_STATUSES.map((statusKey) => {
                      const cfg = STATUS_CONFIG[statusKey];
                      const isCurrent = task.status === statusKey;
                      return (
                        <button
                          key={statusKey}
                          type="button"
                          onClick={() => handleStatusChange(statusKey)}
                          className={`flex items-center justify-between w-full px-2.5 py-1.5 text-xs text-left transition-colors hover:bg-zinc-50 cursor-pointer ${
                            isCurrent
                              ? "font-semibold text-zinc-900 bg-zinc-50/70"
                              : "text-zinc-700"
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span
                              className={`inline-block w-2 h-2 rounded-full border ${cfg.className}`}
                            />
                            {cfg.label}
                          </span>
                          {isCurrent && (
                            <span className="text-zinc-500">✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusConfig.className}`}
              >
                {statusConfig.label}
              </span>
            )}
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

            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 hover:text-zinc-900 transition-colors cursor-pointer"
              title="Historie změn úkolu"
            >
              <span>🕒</span>
              <span>Historie</span>
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

      {/* Dialog pro historii změn úkolu */}
      {isHistoryOpen && (
        <TaskAuditHistoryDialog
          boardId={task.boardId}
          taskId={task.id}
          taskTitle={task.title}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </>
  );
}
