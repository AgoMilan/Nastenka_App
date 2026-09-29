"use client";

import * as React from "react";
import { useActionState } from "react";
import { addMemberAction } from "@/app/(authenticated)/app/board/[boardId]/member-actions.ts";
import { Button } from "@/components/ui/button.tsx";
import type { AssignableUserView } from "@/modules/membership/application/use-cases/get-assignable-users.use-case.ts";

export interface AddMemberDialogProps {
  readonly boardId: string;
  readonly assignableUsers: AssignableUserView[];
  readonly canAssignManager: boolean;
  readonly hasExistingManager: boolean;
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export function AddMemberDialog({
  boardId,
  assignableUsers,
  canAssignManager,
  hasExistingManager,
  isOpen,
  onClose,
}: AddMemberDialogProps) {
  const [state, formAction, isPending] = useActionState(addMemberAction, null);
  const [selectedUserError, setSelectedUserError] = React.useState<string | null>(null);

  // Zavření po úspěšném přidání
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setSelectedUserError(null);
    const formData = new FormData(e.currentTarget);
    const userId = formData.get("userId");

    if (typeof userId !== "string" || userId.trim().length === 0) {
      e.preventDefault();
      setSelectedUserError("Vyberte prosím uživatele");
      return;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-title"
    >
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4">
          <h2
            id="add-member-title"
            className="text-base font-semibold text-zinc-900"
          >
            Přidat člena
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

        {assignableUsers.length === 0 ? (
          <div className="text-center py-4 space-y-4">
            <p className="text-sm text-zinc-600">
              Všichni dostupní uživatelé v systému již jsou členy této nástěnky.
            </p>
            <div className="pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Zavřít
              </Button>
            </div>
          </div>
        ) : (
          <form
            action={formAction}
            onSubmit={handleSubmit}
            className="space-y-4 text-left"
          >
            <input type="hidden" name="boardId" value={boardId} />

            {state?.error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
                {state.error}
              </div>
            )}

            {/* Výběr uživatele */}
            <div>
              <label
                htmlFor="member-userId"
                className="block text-sm font-medium text-zinc-900"
              >
                Uživatel <span className="text-red-500">*</span>
              </label>
              <select
                id="member-userId"
                name="userId"
                required
                autoFocus
                disabled={isPending}
                defaultValue=""
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50 bg-white"
              >
                <option value="" disabled>
                  -- Vyberte uživatele --
                </option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
              {selectedUserError && (
                <p className="mt-1 text-xs text-red-600">{selectedUserError}</p>
              )}
            </div>

            {/* Výběr role */}
            <div>
              <label
                htmlFor="member-role"
                className="block text-sm font-medium text-zinc-900"
              >
                Role na nástěnce
              </label>
              <select
                id="member-role"
                name="role"
                defaultValue="MEMBER"
                disabled={isPending}
                className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50 bg-white"
              >
                <option value="MEMBER">Člen (běžný člen týmu)</option>
                {canAssignManager && (
                  <option value="MANAGER">Správce (provozní organizace)</option>
                )}
              </select>
              {hasExistingManager && (
                <p className="mt-1 text-xs text-zinc-500">
                  Nástěnka již má přiděleného správce (limit max. 1 správce).
                </p>
              )}
            </div>

            {/* Akční tlačítka */}
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
                {isPending ? "Přidávám..." : "Přidat člena"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
