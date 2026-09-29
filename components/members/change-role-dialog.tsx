"use client";

import * as React from "react";
import { useActionState } from "react";
import { changeMemberRoleAction } from "@/app/(authenticated)/app/board/[boardId]/member-actions.ts";
import { Button } from "@/components/ui/button.tsx";
import type { BoardMemberView } from "@/modules/boards/application/use-cases/index.ts";

export interface ChangeRoleDialogProps {
  readonly boardId: string;
  readonly member: BoardMemberView | null;
  readonly hasExistingManager: boolean;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function ChangeRoleDialog({
  boardId,
  member,
  hasExistingManager,
  isOpen,
  onClose,
}: ChangeRoleDialogProps) {
  const [state, formAction, isPending] = useActionState(changeMemberRoleAction, null);

  // Zavření po úspěchu
  React.useEffect(() => {
    if (state?.success) {
      onClose();
    }
  }, [state, onClose]);

  // Klávesa Escape pro zavření
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isPending) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isPending, onClose]);

  if (!isOpen || !member) return null;

  const targetRole = member.role === "MEMBER" ? "MANAGER" : "MEMBER";
  const targetRoleLabel = targetRole === "MANAGER" ? "Správce" : "Člen";
  const cannotPromoteDueToLimit = member.role === "MEMBER" && hasExistingManager;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-role-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
          <h2
            id="change-role-title"
            className="text-base font-semibold text-zinc-900"
          >
            Změna role člena
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-zinc-400 hover:text-zinc-600 text-sm focus:outline-none disabled:opacity-50"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </div>

        {cannotPromoteDueToLimit ? (
          <div className="space-y-4 text-left">
            <p className="text-sm text-zinc-700">
              Člena <span className="font-semibold">{member.name}</span> nelze povýšit na Správce, protože tato nástěnka již má přiděleného správce (platí pravidlo max. 1 správce).
            </p>
            <p className="text-xs text-zinc-500">
              Pro jmenování nového správce nejprve změňte roli stávajícího správce na Člena.
            </p>
            <div className="flex justify-end pt-3 border-t border-zinc-100">
              <Button type="button" variant="outline" onClick={onClose}>
                Rozumím
              </Button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="space-y-4 text-left">
            <input type="hidden" name="boardId" value={boardId} />
            <input type="hidden" name="targetUserId" value={member.userId} />
            <input type="hidden" name="newRole" value={targetRole} />

            {state?.error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                {state.error}
              </div>
            )}

            <p className="text-sm text-zinc-700">
              Chcete změnit roli člena <span className="font-semibold">{member.name}</span> na{" "}
              <span className="font-semibold text-zinc-900">{targetRoleLabel}</span>?
            </p>

            <div className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-500 space-y-1 border border-zinc-100">
              <p className="font-medium text-zinc-700">Podrobnosti role:</p>
              {targetRole === "MANAGER" ? (
                <p>
                  Správce může spravovat oblasti na nástěnce a přidávat či odebírat řadové členy.
                </p>
              ) : (
                <p>
                  Člen může pracovat s úkoly, ale nemá práva ke správě oblastí ani členů.
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-100">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
              >
                Zrušit
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Ukládám..." : `Změnit na ${targetRoleLabel}`}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
