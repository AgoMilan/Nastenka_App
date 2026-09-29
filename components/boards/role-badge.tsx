import * as React from "react";
import type { BoardRole } from "@/modules/boards/application/ports/index.ts";
import { cn } from "@/shared/utils/cn.ts";

export interface RoleBadgeProps {
  readonly role: BoardRole | null;
  readonly className?: string;
}

/**
 * Komponenta pro české zobrazení role na Nástěnce:
 * - OWNER  -> Vlastník
 * - MANAGER -> Správce
 * - MEMBER -> Člen
 * - null    -> Administrátor (systémový administrátor bez přímého členství)
 */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  if (role === "OWNER") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 border border-amber-200",
          className,
        )}
      >
        Vlastník
      </span>
    );
  }

  if (role === "MANAGER") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 border border-blue-200",
          className,
        )}
      >
        Správce
      </span>
    );
  }

  if (role === "MEMBER") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 border border-zinc-200",
          className,
        )}
      >
        Člen
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-800 border border-purple-200",
        className,
      )}
    >
      Administrátor
    </span>
  );
}
