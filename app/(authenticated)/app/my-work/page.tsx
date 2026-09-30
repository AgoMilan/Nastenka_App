import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveActorContext, auth } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleBoardRepository } from "@/infrastructure/database/repositories/drizzle-board-repository.ts";
import { DrizzleTaskRepository } from "@/infrastructure/database/repositories/drizzle-task-repository.ts";
import { DrizzleTaskParticipantRepository } from "@/infrastructure/database/repositories/drizzle-task-participant-repository.ts";
import { DrizzleAreaRepository } from "@/infrastructure/database/repositories/drizzle-area-repository.ts";
import { DrizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository.ts";
import { DrizzleUserTaskOrderRepository } from "@/infrastructure/database/repositories/drizzle-user-task-order-repository.ts";
import { DrizzleTaskCommentRepository } from "@/infrastructure/database/repositories/drizzle-task-comment-repository.ts";
import {
  GetMyTasksUseCase,
  type MyTaskFilterMode,
  type MyTaskRoleFilter,
  type MyTaskView,
} from "@/modules/tasks/application/use-cases/get-my-tasks.use-case.ts";
import { AppHeader } from "@/components/navigation/app-header.tsx";
import { MyTasksFilters } from "@/components/my-work/my-tasks-filters.tsx";
import { MyTaskCard } from "@/components/my-work/my-task-card.tsx";

interface MyWorkPageProps {
  searchParams?: Promise<{
    filter?: string;
    role?: string;
  }>;
}

function formatTaskCount(count: number): string {
  if (count === 1) return "1 úkol";
  if (count >= 2 && count <= 4) return `${count} úkoly`;
  return `${count} úkolů`;
}

export default async function MyWorkPage({ searchParams }: MyWorkPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  // Normalizace parametrů filtru
  const rawFilter = resolvedSearchParams.filter?.toUpperCase();
  const filter: MyTaskFilterMode =
    rawFilter === "COMPLETED" || rawFilter === "ARCHIVED" || rawFilter === "ALL"
      ? rawFilter
      : "ACTIVE";

  const rawRole = resolvedSearchParams.role?.toUpperCase();
  const role: MyTaskRoleFilter =
    rawRole === "ASSIGNEE" || rawRole === "PARTICIPANT" ? rawRole : "ALL";

  // Autentizace přes ActorContext
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor) {
    redirect("/login");
  }

  const session = await auth.api.getSession({ headers: headersList });
  const userName = session?.user.name ?? "Uživatel";
  const userEmail = session?.user.email ?? "";

  // Příprava repozitářů a spuštění GetMyTasksUseCase
  const db = getDb();
  const boardRepo = new DrizzleBoardRepository(db);
  const taskRepo = new DrizzleTaskRepository(db);
  const taskParticipantRepo = new DrizzleTaskParticipantRepository(db);
  const areaRepo = new DrizzleAreaRepository(db);
  const userRepo = new DrizzleUserRepository(db);
  const userTaskOrderRepo = new DrizzleUserTaskOrderRepository(db);
  const taskCommentRepo = new DrizzleTaskCommentRepository(db);

  const getMyTasksUseCase = new GetMyTasksUseCase(
    boardRepo,
    taskRepo,
    taskParticipantRepo,
    areaRepo,
    userRepo,
    userTaskOrderRepo,
    taskCommentRepo,
  );

  const tasksResult = await getMyTasksUseCase.execute(actor, {
    filter,
    roleFilter: role,
  });
  const tasks = tasksResult.success ? tasksResult.data : [];

  // Seskupení úkolů podle nástěnky
  const groupedByBoard = new Map<
    string,
    { boardName: string; tasks: MyTaskView[] }
  >();

  for (const t of tasks) {
    const existing = groupedByBoard.get(t.boardId);
    if (existing) {
      existing.tasks.push(t);
    } else {
      groupedByBoard.set(t.boardId, {
        boardName: t.boardName,
        tasks: [t],
      });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <AppHeader userName={userName} userEmail={userEmail} activeTab="my-work" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Záhlaví stránky */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Moje úkoly
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Přehled úkolů, které řešíte nebo na kterých spolupracujete napříč
              všemi vašimi nástěnkami.
            </p>
          </div>

          <div className="text-sm text-zinc-500 font-medium">
            Celkem: {formatTaskCount(tasks.length)}
          </div>
        </div>

        {/* Filtry */}
        <MyTasksFilters currentFilter={filter} currentRole={role} />

        {/* Obsah – Empty state nebo seskupený seznam úkolů */}
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs my-8">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-500 mb-4">
              <span className="text-2xl font-light">🎯</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {filter === "ACTIVE"
                ? "Nemáte žádné aktivní úkoly"
                : filter === "COMPLETED"
                  ? "Nemáte žádné dokončené úkoly"
                  : filter === "ARCHIVED"
                    ? "Nemáte žádné archivované úkoly"
                    : "Nebyly nalezeny žádné úkoly"}
            </h2>
            <p className="mt-2 text-sm text-zinc-500 mb-6">
              {filter === "ACTIVE"
                ? "Skvělá práce! Žádné úkoly v této chvíli nečekají na vaše vyřešení."
                : "Zkuste změnit nastavení filtrů nebo přejděte na své nástěnky."}
            </p>
            <Link
              href="/app"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
            >
              Přejít na Moje nástěnky
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(groupedByBoard.entries()).map(([boardId, group]) => (
              <section
                key={boardId}
                className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-2xs"
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4 flex-wrap gap-2">
                  <Link
                    href={`/app/board/${boardId}`}
                    className="font-bold text-lg text-zinc-900 hover:text-zinc-600 flex items-center gap-2 transition-colors"
                  >
                    <span>📋 {group.boardName}</span>
                    <span className="text-xs text-zinc-400 font-normal hover:underline">
                      (Otevřít nástěnku →)
                    </span>
                  </Link>

                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                    {formatTaskCount(group.tasks.length)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {group.tasks.map((task) => (
                    <MyTaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
