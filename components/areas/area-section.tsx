"use client";

import * as React from "react";
import type { AreaView } from "@/modules/areas/application/use-cases/index.ts";
import { Button } from "@/components/ui/button.tsx";
import { AreaCard } from "./area-card.tsx";
import { CreateAreaDialog } from "./create-area-dialog.tsx";

export interface AreaSectionProps {
  readonly boardId: string;
  readonly areas: AreaView[];
  readonly canManage: boolean;
}

export function AreaSection({ boardId, areas, canManage }: AreaSectionProps) {
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  return (
    <section className="space-y-6" aria-labelledby="areas-heading">
      {/* Záhlaví sekce oblastí */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <h2 id="areas-heading" className="text-lg font-bold text-zinc-900 tracking-tight">
            Oblasti
          </h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
            {areas.length}
          </span>
        </div>

        {canManage && (
          <Button onClick={() => setIsCreateOpen(true)}>
            + Nová oblast
          </Button>
        )}
      </div>

      {/* Prázdný stav nebo seznam oblastí */}
      {areas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 sm:p-12 text-center text-zinc-500">
          <span className="text-3xl block mb-3">📁</span>
          <h3 className="text-base font-semibold text-zinc-800">
            Zatím zde nejsou žádné oblasti
          </h3>
          <p className="mt-1 text-sm max-w-md mx-auto text-zinc-500">
            {canManage
              ? "Vytvořte první oblast pro organizaci témat a úkolů na této nástěnce."
              : "Na této nástěnce zatím nebyly vytvořeny žádné oblasti."}
          </p>

          {canManage && (
            <div className="mt-5">
              <Button onClick={() => setIsCreateOpen(true)} variant="outline">
                + Vytvořit první oblast
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          {areas.map((area) => (
            <AreaCard
              key={area.id}
              boardId={boardId}
              area={area}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      {/* Dialog pro vytvoření oblasti */}
      {canManage && isCreateOpen && (
        <CreateAreaDialog
          boardId={boardId}
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </section>
  );
}
