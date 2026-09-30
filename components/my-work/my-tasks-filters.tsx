import Link from "next/link";
import type {
  MyTaskFilterMode,
  MyTaskRoleFilter,
} from "@/modules/tasks/application/use-cases/get-my-tasks.use-case.ts";

interface MyTasksFiltersProps {
  readonly currentFilter: MyTaskFilterMode;
  readonly currentRole: MyTaskRoleFilter;
}

export function MyTasksFilters({
  currentFilter,
  currentRole,
}: MyTasksFiltersProps) {
  const statusOptions: Array<{ id: MyTaskFilterMode; label: string }> = [
    { id: "ACTIVE", label: "Aktivní" },
    { id: "COMPLETED", label: "Dokončené" },
    { id: "ARCHIVED", label: "Archivované" },
    { id: "ALL", label: "Vše" },
  ];

  const roleOptions: Array<{ id: MyTaskRoleFilter; label: string }> = [
    { id: "ALL", label: "Všechny" },
    { id: "ASSIGNEE", label: "Řešitel" },
    { id: "PARTICIPANT", label: "Spoluřešitel" },
  ];

  function buildUrl(filter: MyTaskFilterMode, role: MyTaskRoleFilter): string {
    const params = new URLSearchParams();
    if (filter !== "ACTIVE") {
      params.set("filter", filter);
    }
    if (role !== "ALL") {
      params.set("role", role);
    }
    const query = params.toString();
    return query ? `/app/my-work?${query}` : "/app/my-work";
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-2 mb-6 border-b border-zinc-200/80">
      {/* Stavové filtry */}
      <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs font-medium">
        {statusOptions.map((opt) => {
          const isActive = currentFilter === opt.id;
          return (
            <Link
              key={opt.id}
              href={buildUrl(opt.id, currentRole)}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                isActive
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* Filtry podle role */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-400 font-medium">Role:</span>
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl font-medium">
          {roleOptions.map((opt) => {
            const isActive = currentRole === opt.id;
            return (
              <Link
                key={opt.id}
                href={buildUrl(currentFilter, opt.id)}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  isActive
                    ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
