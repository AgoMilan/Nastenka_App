"use client";

import * as React from "react";
import type { BoardMemberView } from "@/modules/boards/application/use-cases/index.ts";
import type { BoardRole } from "@/modules/boards/application/ports/index.ts";
import type { AssignableUserView } from "@/modules/membership/application/use-cases/get-assignable-users.use-case.ts";
import { Button } from "@/components/ui/button.tsx";
import { AddMemberDialog } from "./add-member-dialog.tsx";
import { ChangeRoleDialog } from "./change-role-dialog.tsx";
import { RemoveMemberDialog } from "./remove-member-dialog.tsx";
import { LeaveBoardDialog } from "./leave-board-dialog.tsx";

export interface MembersSectionProps {
  readonly boardId: string;
  readonly boardName: string;
  readonly members: BoardMemberView[];
  readonly assignableUsers: AssignableUserView[];
  readonly currentUserId: string;
  readonly currentUserRole: BoardRole | null;
  readonly canManageMembers: boolean;
  readonly canChangeRoles: boolean;
  readonly canLeaveBoard: boolean;
  readonly isGlobalAdmin: boolean;
}

function getRoleLabel(role: BoardRole): string {
  switch (role) {
    case "OWNER":
      return "Vlastník";
    case "MANAGER":
      return "Správce";
    case "MEMBER":
      return "Člen";
    default:
      return role;
  }
}

function getRoleBadgeStyle(role: BoardRole): string {
  switch (role) {
    case "OWNER":
      return "bg-zinc-900 text-white border-zinc-900";
    case "MANAGER":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "MEMBER":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}

export function MembersSection({
  boardId,
  boardName,
  members,
  assignableUsers,
  currentUserId,
  currentUserRole,
  canManageMembers,
  canChangeRoles,
  canLeaveBoard,
  isGlobalAdmin,
}: MembersSectionProps) {
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [changeRoleMember, setChangeRoleMember] = React.useState<BoardMemberView | null>(null);
  const [removeMember, setRemoveMember] = React.useState<BoardMemberView | null>(null);
  const [isLeaveOpen, setIsLeaveOpen] = React.useState(false);

  const hasExistingManager = members.some((m) => m.role === "MANAGER");
  const canAssignManager = (isGlobalAdmin || currentUserRole === "OWNER") && !hasExistingManager;

  // Kontrola, zda aktuální aktér smí odebrat daného člena podle MembershipPolicy
  const canRemoveMember = (target: BoardMemberView): boolean => {
    // Nikdo nemůže odebrat sole OWNERa
    if (target.role === "OWNER") return false;
    // Nelze odebrat sám sebe administrativně (na to slouží LeaveBoard)
    if (target.userId === currentUserId) return false;

    if (isGlobalAdmin || currentUserRole === "OWNER") {
      return true; // OWNER i ADMIN mohou odebrat MANAGER i MEMBER
    }
    if (currentUserRole === "MANAGER") {
      return target.role === "MEMBER"; // MANAGER smí odebrat pouze MEMBER
    }
    return false;
  };

  return (
    <section className="space-y-4" aria-labelledby="members-heading">
      {/* Záhlaví sekce členů */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-zinc-200">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2
              id="members-heading"
              className="text-lg font-bold text-zinc-900 tracking-tight"
            >
              Členové
            </h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
              {members.length}
            </span>
          </div>

          <span className="text-zinc-300 hidden sm:inline">•</span>

          <div className="text-xs text-zinc-500 flex items-center gap-2">
            <span>
              {members.filter((m) => m.role === "OWNER").length} vlastník
            </span>
            {hasExistingManager && <span>• 1 správce</span>}
            <span>
              • {members.filter((m) => m.role === "MEMBER").length} {
                members.filter((m) => m.role === "MEMBER").length === 1
                  ? "člen"
                  : members.filter((m) => m.role === "MEMBER").length >= 2 &&
                    members.filter((m) => m.role === "MEMBER").length <= 4
                    ? "členové"
                    : "členů"
              }
            </span>
          </div>
        </div>

        {/* Akční tlačítka záhlaví */}
        <div className="flex items-center gap-2.5 shrink-0">
          {canManageMembers && (
            <Button onClick={() => setIsAddOpen(true)}>
              + Přidat člena
            </Button>
          )}

          {canLeaveBoard && (
            <Button
              variant="outline"
              onClick={() => setIsLeaveOpen(true)}
              className="text-zinc-600 hover:text-red-700"
            >
              Opustit nástěnku
            </Button>
          )}
        </div>
      </div>

      {/* Seznam členů v kartách / mřížce */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => {
          const isCurrentUser = member.userId === currentUserId;
          const showRemove = canRemoveMember(member);
          const showChangeRole =
            canChangeRoles && member.role !== "OWNER";

          return (
            <div
              key={member.userId}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs flex flex-col justify-between transition-shadow hover:shadow-xs text-left"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-700 shrink-0">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-900 truncate">
                          {member.name}
                        </span>
                        {isCurrentUser && (
                          <span className="text-[11px] font-medium text-zinc-400">
                            (Vy)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 truncate font-mono">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium shrink-0 ${getRoleBadgeStyle(
                      member.role,
                    )}`}
                  >
                    {getRoleLabel(member.role)}
                  </span>
                </div>
              </div>

              {/* Akce se členem: Změna role a Odebrání */}
              {(showChangeRole || showRemove) && (
                <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-end gap-2 text-xs">
                  {showChangeRole && (
                    <button
                      type="button"
                      onClick={() => setChangeRoleMember(member)}
                      className="px-2 py-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors font-medium"
                    >
                      {member.role === "MEMBER"
                        ? "Povýšit na Správce"
                        : "Změnit na Člena"}
                    </button>
                  )}

                  {showRemove && (
                    <button
                      type="button"
                      onClick={() => setRemoveMember(member)}
                      className="px-2 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors font-medium"
                    >
                      Odebrat
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialog pro přidání člena */}
      {canManageMembers && isAddOpen && (
        <AddMemberDialog
          boardId={boardId}
          assignableUsers={assignableUsers}
          canAssignManager={canAssignManager}
          hasExistingManager={hasExistingManager}
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
        />
      )}

      {/* Dialog pro změnu role */}
      {canChangeRoles && changeRoleMember && (
        <ChangeRoleDialog
          boardId={boardId}
          member={changeRoleMember}
          hasExistingManager={hasExistingManager}
          isOpen={changeRoleMember !== null}
          onClose={() => setChangeRoleMember(null)}
        />
      )}

      {/* Dialog pro odebrání člena */}
      {removeMember && (
        <RemoveMemberDialog
          boardId={boardId}
          member={removeMember}
          isOpen={removeMember !== null}
          onClose={() => setRemoveMember(null)}
        />
      )}

      {/* Dialog pro opuštění nástěnky */}
      {canLeaveBoard && isLeaveOpen && (
        <LeaveBoardDialog
          boardId={boardId}
          boardName={boardName}
          isOpen={isLeaveOpen}
          onClose={() => setIsLeaveOpen(false)}
        />
      )}
    </section>
  );
}
