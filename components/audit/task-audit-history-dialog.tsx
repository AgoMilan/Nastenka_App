"use client";

import * as React from "react";
import { getTaskAuditHistoryAction } from "@/app/(authenticated)/app/board/[boardId]/audit-actions.ts";
import type { AuditLogView } from "@/modules/audit/domain/audit-views.ts";
import { AuditTimeline } from "./audit-timeline.tsx";
import { Button } from "@/components/ui/button.tsx";

export interface TaskAuditHistoryDialogProps {
  readonly boardId: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function TaskAuditHistoryDialog({
  boardId,
  taskId,
  taskTitle,
  isOpen,
  onClose,
}: TaskAuditHistoryDialogProps) {
  const [logs, setLogs] = React.useState<AuditLogView[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const loadHistory = React.useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await getTaskAuditHistoryAction(boardId, taskId);
      if (res.success && res.data) {
        setLogs(res.data);
      } else {
        setFetchError(res.error ?? "Nepodařilo se načíst historii úkolu.");
      }
    } catch {
      setFetchError("Chyba při komunikaci se serverem.");
    } finally {
      setIsLoading(false);
    }
  }, [boardId, taskId]);

  React.useEffect(() => {
    if (isOpen) {
      void loadHistory();
    } else {
      setLogs([]);
      setFetchError(null);
    }
  }, [isOpen, loadHistory]);

  // Ovládání klávesy Escape
  React.useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-audit-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl max-h-[85vh] flex flex-col">
        {/* Hlavička dialogu */}
        <div className="flex items-start justify-between pb-3 border-b border-zinc-100">
          <div>
            <h2
              id="task-audit-title"
              className="text-base font-semibold text-zinc-900"
            >
              Historie změn úkolu
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
              {taskTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 text-sm focus:outline-none p-1 rounded hover:bg-zinc-100 transition-colors"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </div>

        {/* Seznam změn (Timeline) */}
        <div className="flex-1 overflow-y-auto py-4 pr-1">
          <AuditTimeline
            logs={logs}
            isLoading={isLoading}
            error={fetchError}
          />
        </div>

        {/* Patička dialogu */}
        <div className="pt-3 border-t border-zinc-100 flex justify-end">
          <Button
            type="button"
            variant="outline"
            className="text-xs px-3 py-1.5"
            onClick={onClose}
          >
            Zavřít
          </Button>
        </div>
      </div>
    </div>
  );
}
