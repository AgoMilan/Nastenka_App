"use client";

import * as React from "react";
import type { BoardTaskView } from "@/modules/tasks/application/use-cases/get-board-tasks.use-case.ts";
import type { TaskStatus } from "@/modules/tasks/application/ports/task-repository.port.ts";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";
import type { BoardMemberView } from "@/modules/boards/application/use-cases/index.ts";
import { EditTaskDialog } from "./edit-task-dialog.tsx";
import { DeleteTaskDialog } from "./delete-task-dialog.tsx";
import {
  changeTaskStatusAction,
  takeOverTaskAction,
  joinTaskAction,
  leaveTaskAction,
  removeTaskParticipantAction,
  archiveTaskAction,
  reorderTaskAction,
} from "@/app/(authenticated)/app/board/[boardId]/task-actions.ts";

export interface TaskCardProps {
  readonly task: BoardTaskView;
  readonly boardId?: string;
  readonly areas?: AreaView[];
  readonly members?: BoardMemberView[];
  readonly currentUserRole?: string | null;
  readonly currentUserId?: string;
  readonly isGlobalAdmin?: boolean;
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

export function TaskCard({
  task,
  boardId,
  areas,
  members,
  currentUserRole,
  currentUserId,
  isGlobalAdmin = false,
}: TaskCardProps) {
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = React.useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = React.useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const [isPending, startTransition] = React.useTransition();

  const isAssignee =
    currentUserId !== undefined && task.assignee?.userId === currentUserId;
  const isParticipant =
    currentUserId !== undefined &&
    task.participants.some((p) => p.userId === currentUserId);
  const isTaskWorker = isAssignee || isParticipant;

  const isArchived = task.status === "ARCHIVOVÁNO";

  // TASK_CHANGE_STATUS: ASSIGNEE, PARTICIPANT, MANAGER, OWNER, ADMIN (and not archived)
  const canChangeStatus =
    !isArchived &&
    (isGlobalAdmin ||
      currentUserRole === "OWNER" ||
      currentUserRole === "MANAGER" ||
      isTaskWorker);

  // TASK_TAKE_OVER: any member or ADMIN, not already assignee, not archived
  const canTakeOver =
    !isArchived &&
    (isGlobalAdmin || currentUserRole !== null) &&
    !isAssignee;

  // TASK_JOIN_AS_PARTICIPANT: any member or ADMIN, not assignee, not already participant, task HAS assignee, not archived
  const canJoin =
    !isArchived &&
    (isGlobalAdmin || currentUserRole !== null) &&
    !isAssignee &&
    !isParticipant &&
    task.assignee !== null;

  // TASK_LEAVE_AS_PARTICIPANT: participant can leave, not archived
  const canLeave = !isArchived && isParticipant;

  // TASK_REMOVE_PARTICIPANT: ASSIGNEE, MANAGER, OWNER, ADMIN, not archived
  const canRemoveParticipant =
    !isArchived &&
    (isGlobalAdmin ||
      currentUserRole === "OWNER" ||
      currentUserRole === "MANAGER" ||
      isAssignee);

  // TASK_ARCHIVE: ASSIGNEE, PARTICIPANT, MANAGER, OWNER, ADMIN, not already archived
  const canArchive =
    !isArchived &&
    (isGlobalAdmin ||
      currentUserRole === "OWNER" ||
      currentUserRole === "MANAGER" ||
      isTaskWorker);

  // TASK_DELETE: ASSIGNEE, PARTICIPANT, MANAGER, OWNER, ADMIN
  const canDelete =
    isGlobalAdmin ||
    currentUserRole === "OWNER" ||
    currentUserRole === "MANAGER" ||
    isTaskWorker;

  // Edit task is allowed for members/admin when not archived
  const canEdit = !isArchived && (isGlobalAdmin || currentUserRole !== null);

  // TASK_REORDER: povoleno všem členům i ADMINovi pro aktivní úkoly na desce
  const canReorder =
    !isArchived &&
    Boolean(boardId) &&
    (isGlobalAdmin || currentUserRole !== null);

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

  // Zavření dropdownů při kliknutí mimo
  const statusMenuRef = React.useRef<HTMLDivElement>(null);
  const actionsMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(event.target as Node)
      ) {
        setIsStatusMenuOpen(false);
      }
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(event.target as Node)
      ) {
        setIsActionsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handlery Server Actions
  const handleStatusChange = (newStatus: TaskStatus) => {
    if (!boardId || newStatus === task.status || isPending) return;
    setIsStatusMenuOpen(false);
    setActionError(null);

    const formData = new FormData();
    formData.append("boardId", boardId);
    formData.append("taskId", task.id);
    formData.append("status", newStatus);

    startTransition(async () => {
      const res = await changeTaskStatusAction(null, formData);
      if (!res.success && res.error) {
        setActionError(res.error);
      }
    });
  };

  const handleTakeOver = () => {
    if (!boardId || isPending) return;
    setActionError(null);

    const formData = new FormData();
    formData.append("boardId", boardId);
    formData.append("taskId", task.id);

    startTransition(async () => {
      const res = await takeOverTaskAction(null, formData);
      if (!res.success && res.error) {
        setActionError(res.error);
      }
    });
  };

  const handleJoin = () => {
    if (!boardId || isPending) return;
    setActionError(null);

    const formData = new FormData();
    formData.append("boardId", boardId);
    formData.append("taskId", task.id);

    startTransition(async () => {
      const res = await joinTaskAction(null, formData);
      if (!res.success && res.error) {
        setActionError(res.error);
      }
    });
  };

  const handleLeave = () => {
    if (!boardId || isPending) return;
    setActionError(null);

    const formData = new FormData();
    formData.append("boardId", boardId);
    formData.append("taskId", task.id);

    startTransition(async () => {
      const res = await leaveTaskAction(null, formData);
      if (!res.success && res.error) {
        setActionError(res.error);
      }
    });
  };

  const handleRemoveParticipant = (participantUserId: string) => {
    if (!boardId || isPending) return;
    setActionError(null);

    const formData = new FormData();
    formData.append("boardId", boardId);
    formData.append("taskId", task.id);
    formData.append("participantUserId", participantUserId);

    startTransition(async () => {
      const res = await removeTaskParticipantAction(null, formData);
      if (!res.success && res.error) {
        setActionError(res.error);
      }
    });
  };

  const handleArchiveConfirm = () => {
    if (!boardId || isPending) return;
    setIsArchiveConfirmOpen(false);
    setActionError(null);

    const formData = new FormData();
    formData.append("boardId", boardId);
    formData.append("taskId", task.id);

    startTransition(async () => {
      const res = await archiveTaskAction(null, formData);
      if (!res.success && res.error) {
        setActionError(res.error);
      }
    });
  };

  const handleMove = (direction: "UP" | "DOWN") => {
    if (!boardId || !canReorder || isPending) return;
    setActionError(null);

    const formData = new FormData();
    formData.append("boardId", boardId);
    formData.append("taskId", task.id);
    formData.append("direction", direction);

    startTransition(async () => {
      const res = await reorderTaskAction(null, formData);
      if (!res.success && res.error) {
        setActionError(res.error);
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!boardId || !canReorder || isPending) return;
    const sourceTaskId = e.dataTransfer.getData("text/plain");
    if (!sourceTaskId || sourceTaskId === task.id) return;

    setActionError(null);
    const formData = new FormData();
    formData.append("boardId", boardId);
    formData.append("taskId", sourceTaskId);
    formData.append("targetTaskId", task.id);
    formData.append("position", "BEFORE");

    startTransition(async () => {
      const res = await reorderTaskAction(null, formData);
      if (!res.success && res.error) {
        setActionError(res.error);
      }
    });
  };

  return (
    <>
      <article
        draggable={canReorder}
        onDragStart={(e) => {
          if (!canReorder) return;
          e.dataTransfer.setData("text/plain", task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={(e) => {
          if (!canReorder) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={handleDrop}
        className={`relative rounded-lg border border-zinc-200 bg-white p-3.5 shadow-2xs transition-shadow hover:shadow-xs text-left ${
          canReorder ? "cursor-grab active:cursor-grabbing" : ""
        } ${isPending ? "opacity-70 pointer-events-none" : ""}`}
        aria-labelledby={`task-title-${task.id}`}
      >
        {/* Chybová zpráva akce */}
        {actionError && (
          <div className="mb-2 rounded bg-red-50 p-2 text-xs text-red-700 border border-red-200 flex items-center justify-between gap-2">
            <span>{actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="text-red-500 hover:text-red-800 text-xs font-bold"
              aria-label="Zavřít chybu"
            >
              ✕
            </button>
          </div>
        )}

        {/* Horní řádek: Stav + Priorita + Tlačítka Upravit a Menu */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Stavový badge nebo interaktivní výběr stavu */}
            {canChangeStatus && boardId ? (
              <div className="relative" ref={statusMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                  disabled={isPending}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium cursor-pointer transition-colors hover:brightness-95 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${statusConfig.className}`}
                  title="Změnit stav úkolu"
                  aria-expanded={isStatusMenuOpen}
                  aria-haspopup="true"
                >
                  <span>{statusConfig.label}</span>
                  <span className="text-[10px] opacity-70">▾</span>
                </button>

                {isStatusMenuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-30 min-w-36 rounded-md border border-zinc-200 bg-white py-1 shadow-lg animate-in fade-in">
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
                          className={`flex items-center justify-between w-full px-2.5 py-1.5 text-xs text-left transition-colors hover:bg-zinc-50 ${
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
                          {isCurrent && <span className="text-zinc-500">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${statusConfig.className}`}
              >
                {statusConfig.label}
              </span>
            )}

            {task.priority === "SPĚCHÁ" && (
              <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                <span>●</span> Spěchá
              </span>
            )}
          </div>

          {/* Ovládací prvky vpravo nahoře */}
          <div className="flex items-center gap-1">
            {/* Osobní pořadí: Posunout nahoru / dolů */}
            {canReorder && (
              <div className="flex items-center gap-0.5 border-r border-zinc-200 pr-1 mr-0.5">
                <button
                  type="button"
                  onClick={() => handleMove("UP")}
                  disabled={isPending}
                  className="rounded p-1 text-xs text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-40"
                  title="Posunout úkol nahoru v mém pořadí"
                  aria-label="Posunout úkol nahoru"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => handleMove("DOWN")}
                  disabled={isPending}
                  className="rounded p-1 text-xs text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors disabled:opacity-40"
                  title="Posunout úkol dolů v mém pořadí"
                  aria-label="Posunout úkol dolů"
                >
                  ▼
                </button>
              </div>
            )}

            {canEdit && boardId && (
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="rounded p-1 text-xs text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                title="Upravit úkol"
                aria-label={`Upravit úkol ${task.title}`}
              >
                ✏️
              </button>
            )}

            {(canArchive || canDelete) && boardId && (
              <div className="relative" ref={actionsMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsActionsMenuOpen(!isActionsMenuOpen)}
                  className="rounded p-1 text-xs text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                  title="Další akce"
                  aria-label={`Další akce pro úkol ${task.title}`}
                  aria-expanded={isActionsMenuOpen}
                  aria-haspopup="true"
                >
                  ⋯
                </button>

                {isActionsMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-30 min-w-36 rounded-md border border-zinc-200 bg-white py-1 shadow-lg animate-in fade-in">
                    {canArchive && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setIsArchiveConfirmOpen(true);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors text-left"
                      >
                        <span>📦</span> Archivovat úkol
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          setIsDeleteOpen(true);
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors text-left font-medium"
                      >
                        <span>🗑</span> Smazat úkol
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Název úkolu */}
        <h4
          id={`task-title-${task.id}`}
          className={`text-sm font-semibold tracking-tight break-words ${
            isArchived ? "text-zinc-500 line-through" : "text-zinc-900"
          }`}
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
                  isOverdue ? "font-semibold text-red-600" : "text-zinc-700"
                }
              >
                {formattedDueDate}
                {isOverdue && " (po termínu)"}
              </span>
            </div>
          )}

          {/* Řešitel + Tlačítko Převzít úkol */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-zinc-400 shrink-0">Řešitel:</span>
              {task.assignee ? (
                <span className="font-medium text-zinc-800 truncate">
                  {task.assignee.name || "Neznámý uživatel"}
                </span>
              ) : (
                <span className="text-zinc-400 italic">Nepřiřazeno</span>
              )}
            </div>

            {canTakeOver && boardId && (
              <button
                type="button"
                onClick={handleTakeOver}
                disabled={isPending}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline transition-colors shrink-0"
                title="Převzít řešení úkolu na sebe"
              >
                Převzít úkol
              </button>
            )}
          </div>

          {/* Spoluřešitelé + Připojit / Opustit / Odebrat */}
          <div className="flex items-start justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="text-zinc-400 shrink-0">Spoluřešitelé:</span>
              {task.participants.length > 0 ? (
                <div className="flex items-center gap-1 flex-wrap">
                  {task.participants.map((p) => {
                    const isSelf = currentUserId === p.userId;
                    const canRemoveThis =
                      canRemoveParticipant && (!isSelf || canLeave);
                    return (
                      <span
                        key={p.userId}
                        className="inline-flex items-center gap-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-700"
                      >
                        <span>{p.name || "Neznámý uživatel"}</span>
                        {canRemoveThis && boardId && (
                          <button
                            type="button"
                            onClick={() =>
                              isSelf
                                ? handleLeave()
                                : handleRemoveParticipant(p.userId)
                            }
                            disabled={isPending}
                            className="text-zinc-400 hover:text-red-600 transition-colors ml-0.5 font-bold"
                            title={
                              isSelf
                                ? "Opustit úkol"
                                : `Odebrat ${p.name || "uživatele"}`
                            }
                            aria-label={`Odebrat spoluřešitele ${p.name || ""}`}
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <span className="text-zinc-400 italic text-[11px]">Žádní</span>
              )}
            </div>

            {/* Tlačítko Připojit se nebo Opustit vpravo */}
            <div className="shrink-0">
              {canJoin && boardId && (
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={isPending}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  title="Připojit se k úkolu jako spoluřešitel"
                >
                  + Připojit se
                </button>
              )}
              {canLeave && boardId && task.participants.length > 0 && (
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={isPending}
                  className="text-[11px] font-medium text-zinc-500 hover:text-red-600 hover:underline transition-colors"
                  title="Odpojit se z pozice spoluřešitele"
                >
                  Opustit
                </button>
              )}
            </div>
          </div>

          {/* Autor */}
          <div className="text-[11px] text-zinc-400 pt-0.5">
            Zadal/a: {task.createdBy.name || "Neznámý uživatel"}
          </div>
        </div>
      </article>

      {/* Dialog pro úpravu úkolu */}
      {isEditOpen && boardId && (
        <EditTaskDialog
          boardId={boardId}
          task={task}
          areas={areas ?? []}
          members={members ?? []}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          isGlobalAdmin={isGlobalAdmin}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
        />
      )}

      {/* Dialog pro definitivní smazání úkolu (hard-delete s textem SMAZAT) */}
      {isDeleteOpen && boardId && (
        <DeleteTaskDialog
          boardId={boardId}
          taskId={task.id}
          taskTitle={task.title}
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}

      {/* Potvrzovací dialog pro archivaci úkolu */}
      {isArchiveConfirmOpen && boardId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-dialog-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-xl text-left">
            <h3
              id="archive-dialog-title"
              className="text-base font-semibold text-zinc-900 mb-2"
            >
              Archivovat úkol?
            </h3>
            <p className="text-xs text-zinc-600 mb-4">
              Úkol <span className="font-semibold text-zinc-900">„{task.title}“</span> bude přesunut do archivu. V archivu bude úkol pouze pro čtení a nebude zobrazen v aktivním přehledu.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsArchiveConfirmOpen(false)}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded-md hover:bg-zinc-50 transition-colors"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleArchiveConfirm}
                disabled={isPending}
                className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-800 rounded-md hover:bg-zinc-900 transition-colors"
              >
                {isPending ? "Archivuji..." : "Archivovat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
