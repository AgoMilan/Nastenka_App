"use client";

import * as React from "react";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";
import { EditAreaDialog } from "./edit-area-dialog.tsx";
import { DeleteAreaDialog } from "./delete-area-dialog.tsx";

export interface AreaCardProps {
  readonly boardId: string;
  readonly area: AreaView;
  readonly canManage: boolean;
}

export function AreaCard({ boardId, area, canManage }: AreaCardProps) {
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  return (
    <>
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-2xs flex flex-col justify-between transition-shadow hover:shadow-xs">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-zinc-900 tracking-tight break-words">
              {area.name}
            </h3>

            {canManage && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="rounded p-1 text-xs text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                  title="Upravit oblast"
                  aria-label={`Upravit oblast ${area.name}`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(true)}
                  className="rounded p-1 text-xs text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Smazat oblast"
                  aria-label={`Smazat oblast ${area.name}`}
                >
                  🗑
                </button>
              </div>
            )}
          </div>

          {area.description && (
            <p className="mt-2 text-xs text-zinc-600 break-words whitespace-pre-line line-clamp-3">
              {area.description}
            </p>
          )}
        </div>

        {/* Placeholder pro úkoly – úkoly budou implementovány v navazujícím kroku */}
        <div className="mt-5 pt-4 border-t border-zinc-100">
          <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 p-5 text-center text-xs text-zinc-400">
            <span>Úkoly budou následovat v dalším kroku</span>
          </div>
        </div>
      </div>

      {canManage && isEditOpen && (
        <EditAreaDialog
          boardId={boardId}
          area={area}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
        />
      )}

      {canManage && isDeleteOpen && (
        <DeleteAreaDialog
          boardId={boardId}
          area={area}
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
        />
      )}
    </>
  );
}
