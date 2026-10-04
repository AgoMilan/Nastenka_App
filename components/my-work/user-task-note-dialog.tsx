"use client";

import * as React from "react";
import {
  getUserTaskNoteAction,
  upsertUserTaskNoteAction,
  deleteUserTaskNoteAction,
} from "@/app/(authenticated)/app/my-work/note-actions.ts";
import { Button } from "@/components/ui/button.tsx";

export interface UserTaskNoteDialogProps {
  readonly boardId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly isArchived: boolean;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onNoteChange?: (hasNote: boolean) => void;
}

export function UserTaskNoteDialog({
  boardId,
  taskId,
  taskTitle,
  isArchived,
  isOpen,
  onClose,
  onNoteChange,
}: UserTaskNoteDialogProps) {
  const [content, setContent] = React.useState("");
  const [hasExistingNote, setHasExistingNote] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Načtení stávající poznámky při otevření dialogu
  React.useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getUserTaskNoteAction(boardId, taskId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setContent(res.data.content);
          setHasExistingNote(true);
        } else {
          setContent("");
          setHasExistingNote(false);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Chyba při načítání soukromé poznámky.",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, boardId, taskId]);

  // Klávesa Escape pro zavření
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSubmitting && !isDeleting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, isDeleting, onClose]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isArchived || isSubmitting || isDeleting) return;

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      setError("Poznámka nesmí být prázdná.");
      return;
    }
    if (trimmed.length > 5000) {
      setError("Poznámka nesmí přesáhnout 5000 znaků.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await upsertUserTaskNoteAction(boardId, taskId, trimmed);
      if (!res.success) {
        setError(res.error ?? "Uložení poznámky se nezdařilo.");
      } else {
        onNoteChange?.(true);
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Chyba při ukládání poznámky.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isArchived || isSubmitting || isDeleting || !hasExistingNote) return;

    setIsDeleting(true);
    setError(null);

    try {
      const res = await deleteUserTaskNoteAction(boardId, taskId);
      if (!res.success) {
        setError(res.error ?? "Smazání poznámky se nezdařilo.");
      } else {
        setContent("");
        setHasExistingNote(false);
        onNoteChange?.(false);
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Chyba při mazání poznámky.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-task-note-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl max-h-[90vh] flex flex-col text-left">
        {/* Hlavička dialogu */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3">
          <div className="min-w-0 pr-2">
            <h2
              id="user-task-note-title"
              className="text-base font-semibold text-zinc-900 flex items-center gap-2"
            >
              <span>📝</span>
              <span>Moje soukromá poznámka</span>
            </h2>
            <p className="text-xs text-zinc-500 truncate mt-0.5" title={taskTitle}>
              k úkolu: <span className="font-medium text-zinc-700">{taskTitle}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isDeleting}
            className="text-zinc-400 hover:text-zinc-600 text-sm focus:outline-none disabled:opacity-50"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </div>

        {/* Informační banner o soukromí */}
        <div className="mb-4 rounded-lg bg-amber-50/80 border border-amber-200/80 p-3 text-xs text-amber-900 flex items-start gap-2">
          <span className="text-sm shrink-0">🔒</span>
          <div>
            <p className="font-semibold text-amber-950">
              Soukromá poznámka – vidíte ji pouze vy.
            </p>
            <p className="text-amber-800/90 mt-0.5">
              Tento obsah je váš osobní prostor. Žádný jiný člen týmu, správce ani administrátor k této poznámce nemá přístup.
            </p>
          </div>
        </div>

        {/* Upozornění na archivovaný úkol */}
        {isArchived && (
          <div className="mb-4 rounded-lg bg-zinc-100 border border-zinc-200 p-2.5 text-xs text-zinc-600">
            ℹ️ Tento úkol je archivován – soukromou poznámku lze pouze prohlížet.
          </div>
        )}

        {/* Chybová hláška */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {/* Formulář s obsahem poznámky */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col space-y-3">
          <div className="flex-1 flex flex-col">
            <label
              htmlFor="user-task-note-textarea"
              className="block text-xs font-medium text-zinc-700 mb-1"
            >
              Text poznámky
            </label>
            {isLoading ? (
              <div className="h-40 flex items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
                Načítám poznámku...
              </div>
            ) : (
              <textarea
                id="user-task-note-textarea"
                rows={6}
                maxLength={5000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={isArchived || isSubmitting || isDeleting}
                placeholder="Zapište si své soukromé postřehy, mezikroky nebo koncepty..."
                autoFocus={!isArchived}
                className="w-full flex-1 rounded-md border border-zinc-300 p-3 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-75 disabled:bg-zinc-50 resize-y"
              />
            )}
            <div className="flex justify-end mt-1">
              <span className="text-2xs text-zinc-400">
                {content.length} / 5000 znaků
              </span>
            </div>
          </div>

          {/* Ovládací tlačítka */}
          <div className="flex items-center justify-between pt-3 border-t border-zinc-100">
            <div>
              {hasExistingNote && !isArchived && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDelete}
                  disabled={isSubmitting || isDeleting || isLoading}
                >
                  {isDeleting ? "Mažu..." : "Smazat poznámku"}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting || isDeleting}
              >
                {isArchived ? "Zavřít" : "Zrušit"}
              </Button>
              {!isArchived && (
                <Button
                  type="submit"
                  disabled={isSubmitting || isDeleting || isLoading}
                >
                  {isSubmitting ? "Ukládám..." : "Uložit"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
