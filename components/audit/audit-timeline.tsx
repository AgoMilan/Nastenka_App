import * as React from "react";
import type { AuditLogView } from "@/modules/audit/domain/audit-views.ts";
import { formatAuditEvent } from "@/modules/audit/presentation/audit-event-formatter.ts";

export interface AuditTimelineProps {
  readonly logs: AuditLogView[];
  readonly isLoading?: boolean;
  readonly error?: string | null;
}

function formatDateTime(date: Date | string): string {
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

export function AuditTimeline({ logs, isLoading, error }: AuditTimelineProps) {
  if (isLoading) {
    return (
      <div className="py-6 space-y-4">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-zinc-200 shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 bg-zinc-200 rounded w-1/3" />
              <div className="h-3 bg-zinc-100 rounded w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-sm text-red-600 bg-red-50/50 rounded-lg border border-red-100 p-4">
        <svg
          className="w-8 h-8 mx-auto text-red-400 mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="font-medium">Historii změn se nepodařilo načíst.</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Historie změn je zatím prázdná.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200">
      {logs.map((log) => {
        const formatted = formatAuditEvent(log);
        return (
          <div key={log.id} className="relative group">
            {/* Timeline bullet */}
            <div className="absolute -left-6 top-1.5 w-2 h-2 rounded-full bg-blue-600 ring-4 ring-white" />

            <div className="bg-zinc-50/70 border border-zinc-200/80 rounded-lg p-3 text-sm hover:bg-zinc-50 transition-colors">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-zinc-900 text-xs sm:text-sm">
                  {formatted.title}
                </span>
                <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                  {formatDateTime(log.timestamp)}
                </span>
              </div>

              <p className="text-xs text-zinc-600 mb-1.5 leading-relaxed">
                {formatted.description}
              </p>

              <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 border-t border-zinc-200/60 pt-1.5 mt-1.5">
                <svg
                  className="w-3.5 h-3.5 text-zinc-400 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                <span className="font-medium text-zinc-700">
                  {log.actor.name}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
