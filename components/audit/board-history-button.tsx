"use client";

import * as React from "react";
import { Button } from "@/components/ui/button.tsx";
import { BoardAuditHistoryDialog } from "./board-audit-history-dialog.tsx";

export interface BoardHistoryButtonProps {
  readonly boardId: string;
  readonly boardName: string;
}

export function BoardHistoryButton({
  boardId,
  boardName,
}: BoardHistoryButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 border-zinc-200 px-3 py-1.5"
        title="Historie změn nástěnky"
      >
        <svg
          className="w-3.5 h-3.5 text-zinc-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>Historie</span>
      </Button>

      <BoardAuditHistoryDialog
        boardId={boardId}
        boardName={boardName}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
