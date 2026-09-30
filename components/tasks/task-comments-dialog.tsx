"use client";

import * as React from "react";
import {
  getTaskCommentsAction,
  addTaskCommentAction,
  updateTaskCommentAction,
  deleteTaskCommentAction,
} from "@/app/(authenticated)/app/board/[boardId]/comment-actions.ts";
import type { TaskCommentView } from "@/modules/tasks/application/use-cases/index.ts";
import { Button } from "@/components/ui/button.tsx";

export interface TaskCommentsDialogProps {
  readonly boardId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly isArchived: boolean;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onCommentCountChange?: (newCount: number) => void;
}

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function TaskCommentsDialog({
  boardId,
  taskId,
  taskTitle,
  isArchived,
  isOpen,
  onClose,
  onCommentCountChange,
}: TaskCommentsDialogProps) {
  const [comments, setComments] = React.useState<TaskCommentView[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  // Přidání nového komentáře
  const [newContent, setNewContent] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Editace existujícího komentáře
  const [editingCommentId, setEditingCommentId] = React.useState<string | null>(
    null,
  );
  const [editingContent, setEditingContent] = React.useState("");
  const [isUpdating, setIsUpdating] = React.useState(false);

  // Mazání komentáře
  const [deletingCommentId, setDeletingCommentId] = React.useState<string | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Reference pro automatické scrollování dolů po přidání komentáře
  const commentsEndRef = React.useRef<HTMLDivElement>(null);

  const loadComments = React.useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await getTaskCommentsAction(boardId, taskId);
      if (res.success && res.data) {
        setComments(res.data);
        onCommentCountChange?.(res.data.length);
      } else {
        setFetchError(res.error ?? "Nepodařilo se načíst komentáře.");
      }
    } catch {
      setFetchError("Chyba při komunikaci se serverem.");
    } finally {
      setIsLoading(false);
    }
  }, [boardId, taskId, onCommentCountChange]);

  React.useEffect(() => {
    if (isOpen) {
      void loadComments();
    } else {
      setComments([]);
      setNewContent("");
      setEditingCommentId(null);
      setEditingContent("");
      setActionError(null);
      setFetchError(null);
      setDeletingCommentId(null);
    }
  }, [isOpen, loadComments]);

  // Klávesa Escape pro zavření
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Přidání nového komentáře
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || isSubmitting || isArchived) return;

    setIsSubmitting(true);
    setActionError(null);

    try {
      const res = await addTaskCommentAction(boardId, taskId, newContent.trim());
      if (res.success) {
        setNewContent("");
        await loadComments();
        commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        setActionError(res.error ?? "Nepodařilo se odeslat komentář.");
      }
    } catch {
      setActionError("Chyba při odesílání komentáře.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Zahájení editace komentáře
  const handleStartEdit = (comment: TaskCommentView) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
    setActionError(null);
  };

  // Uložení upraveného komentáře
  const handleSaveEdit = async (commentId: string) => {
    if (!editingContent.trim() || isUpdating) return;

    setIsUpdating(true);
    setActionError(null);

    try {
      const res = await updateTaskCommentAction(
        boardId,
        taskId,
        commentId,
        editingContent.trim(),
      );
      if (res.success) {
        setEditingCommentId(null);
        setEditingContent("");
        await loadComments();
      } else {
        setActionError(res.error ?? "Nepodařilo se uložit změny.");
      }
    } catch {
      setActionError("Chyba při ukládání komentáře.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Smazání komentáře
  const handleDeleteComment = async (commentId: string) => {
    setIsDeleting(true);
    setActionError(null);

    try {
      const res = await deleteTaskCommentAction(boardId, taskId, commentId);
      if (res.success) {
        setDeletingCommentId(null);
        await loadComments();
      } else {
        setActionError(res.error ?? "Nepodařilo se smazat komentář.");
      }
    } catch {
      setActionError("Chyba při mazání komentáře.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-comments-title"
    >
      <div className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
        {/* Hlavička dialogu */}
        <div className="flex items-start justify-between pb-3 border-b border-zinc-100">
          <div>
            <h2
              id="task-comments-title"
              className="text-base font-semibold text-zinc-900"
            >
              Diskuze k úkolu
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
              {taskTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-sm focus:outline-none p-1"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </div>

        {/* Chybová hlášení */}
        {actionError && (
          <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
            {actionError}
          </div>
        )}

        {/* Upozornění na archivovaný úkol */}
        {isArchived && (
          <div className="mt-3 rounded-lg bg-zinc-50 p-2.5 text-xs text-zinc-600 border border-zinc-200 flex items-center gap-1.5">
            <svg
              className="w-4 h-4 text-zinc-400 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <span>
              Tento úkol je archivován. Diskuze je pouze pro čtení.
            </span>
          </div>
        )}

        {/* Seznam komentářů */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3.5 pr-1">
          {isLoading ? (
            <div className="text-center py-8 text-sm text-zinc-400">
              Načítání diskuze...
            </div>
          ) : fetchError ? (
            <div className="text-center py-8 text-sm text-red-600">
              {fetchError}
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-10 text-zinc-400 text-sm">
              <svg
                className="w-10 h-10 mx-auto text-zinc-300 mb-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Zatím žádné komentáře. Buďte první, kdo se zapojí do diskuze.
            </div>
          ) : (
            comments.map((comment) => {
              const isEditing = editingCommentId === comment.id;
              const isDeletingThis = deletingCommentId === comment.id;
              const isEdited =
                new Date(comment.updatedAt).getTime() -
                  new Date(comment.createdAt).getTime() >
                1000;

              return (
                <div
                  key={comment.id}
                  className={`rounded-lg p-3 text-sm border transition-colors ${
                    comment.isOwn
                      ? "bg-blue-50/40 border-blue-100"
                      : "bg-zinc-50/70 border-zinc-200/70"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-semibold text-zinc-900">
                        {comment.author.name}
                      </span>
                      {comment.isOwn && (
                        <span className="bg-blue-100 text-blue-700 text-[10px] font-medium px-1.5 py-0.5 rounded">
                          Vy
                        </span>
                      )}
                      <span className="text-zinc-400">•</span>
                      <span className="text-zinc-400">
                        {formatDate(comment.createdAt)}
                      </span>
                      {isEdited && (
                        <span className="text-zinc-400 italic text-[11px]">
                          (upraveno)
                        </span>
                      )}
                    </div>

                    {/* Akce komentáře (pouze autor) */}
                    {!isArchived && comment.canEdit && !isEditing && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(comment)}
                          className="text-xs text-zinc-500 hover:text-zinc-900 px-1 py-0.5 rounded transition-colors"
                        >
                          Upravit
                        </button>
                        <span className="text-zinc-300">|</span>
                        <button
                          type="button"
                          onClick={() => setDeletingCommentId(comment.id)}
                          className="text-xs text-red-500 hover:text-red-700 px-1 py-0.5 rounded transition-colors"
                        >
                          Smazat
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Obsah komentáře nebo editační formulář */}
                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        disabled={isUpdating}
                        rows={3}
                        maxLength={5000}
                        className="w-full rounded-md border border-zinc-300 p-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2.5 py-1 text-xs"
                          disabled={isUpdating}
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditingContent("");
                          }}
                        >
                          Zrušit
                        </Button>
                        <Button
                          type="button"
                          className="px-2.5 py-1 text-xs"
                          disabled={isUpdating || !editingContent.trim()}
                          onClick={() => handleSaveEdit(comment.id)}
                        >
                          {isUpdating ? "Ukládání..." : "Uložit"}
                        </Button>
                      </div>
                    </div>
                  ) : isDeletingThis ? (
                    <div className="mt-2 p-2 bg-red-50 rounded border border-red-100 space-y-2">
                      <p className="text-xs text-red-700">
                        Opravdu si přejete smazat tento komentář?
                      </p>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="px-2.5 py-1 text-xs"
                          disabled={isDeleting}
                          onClick={() => setDeletingCommentId(null)}
                        >
                          Zrušit
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          className="px-2.5 py-1 text-xs"
                          disabled={isDeleting}
                          onClick={() => handleDeleteComment(comment.id)}
                        >
                          {isDeleting ? "Mazání..." : "Smazat"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-zinc-800 whitespace-pre-wrap break-words leading-relaxed text-sm">
                      {comment.content}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={commentsEndRef} />
        </div>

        {/* Formulář pro přidání nového komentáře */}
        {!isArchived ? (
          <form
            onSubmit={handleAddComment}
            className="pt-3 border-t border-zinc-100 flex flex-col gap-2"
          >
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Napište komentář k úkolu..."
              disabled={isSubmitting}
              rows={2}
              maxLength={5000}
              className="w-full rounded-md border border-zinc-300 p-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none disabled:bg-zinc-50 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void handleAddComment(e);
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400">
                Tip: Odeslat lze pomocí Ctrl+Enter
              </span>
              <Button
                type="submit"
                className="px-3 py-1.5 text-xs"
                disabled={isSubmitting || !newContent.trim()}
              >
                {isSubmitting ? "Odesílání..." : "Odeslat komentář"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="pt-3 border-t border-zinc-100 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5 text-xs"
              onClick={onClose}
            >
              Zavřít
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
