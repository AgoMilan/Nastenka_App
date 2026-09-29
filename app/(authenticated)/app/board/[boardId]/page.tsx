import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { resolveActorContext, auth } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleBoardRepository } from "@/infrastructure/database/repositories/drizzle-board-repository.ts";
import { DrizzleMembershipRepository } from "@/infrastructure/database/repositories/drizzle-membership-repository.ts";
import { DrizzleAreaRepository } from "@/infrastructure/database/repositories/drizzle-area-repository.ts";
import { DrizzleTaskRepository } from "@/infrastructure/database/repositories/drizzle-task-repository.ts";
import { DrizzleTaskParticipantRepository } from "@/infrastructure/database/repositories/drizzle-task-participant-repository.ts";
import { DrizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository.ts";
import { GetBoardDetailUseCase } from "@/modules/boards/application/use-cases/get-board-detail.use-case.ts";
import { GetUserBoardsUseCase } from "@/modules/boards/application/use-cases/get-user-boards.use-case.ts";
import { GetBoardAreasUseCase } from "@/modules/areas/application/use-cases/get-board-areas.use-case.ts";
import {
  GetBoardTasksUseCase,
  type TaskFilterMode,
} from "@/modules/tasks/application/use-cases/get-board-tasks.use-case.ts";
import { GetBoardMembersUseCase } from "@/modules/boards/application/use-cases/get-board-members.use-case.ts";
import { RoleBadge } from "@/components/boards/role-badge.tsx";
import { BoardSwitcher } from "@/components/boards/board-switcher.tsx";
import { LogoutButton } from "@/components/auth/logout-button.tsx";
import { AreaSection } from "@/components/areas/area-section.tsx";

interface BoardPageProps {
  params: Promise<{
    boardId: string;
  }>;
  searchParams?: Promise<{
    filter?: string;
  }>;
}

/**
 * Stránka detailu Nástěnky: /app/board/[boardId]
 *
 * Invarianty (STEP 3):
 * 1. Autoritativní přístup: Ověřuje existenci, aktivní stav (deleted_at IS NULL)
 *    a členství/admin práva. Při neúspěchu volá notFound().
 * 2. Zobrazuje: Název nástěnky, české označení role přihlášeného uživatele,
 *    navigaci zpět na „Moje nástěnky“ a Board Switcher pro přepínání.
 * 3. Zobrazuje Oblasti nástěnky přes GetBoardAreasUseCase a AreaSection.
 * 4. Zobrazuje Úkoly nástěnky přes GetBoardTasksUseCase propojené s oblastmi.
 * 5. Umožňuje oprávněným rolím vytvářet oblasti (OWNER, MANAGER, ADMIN)
 *    a vytvářet úkoly (OWNER, MANAGER, MEMBER, ADMIN).
 */
export default async function BoardPage({ params, searchParams }: BoardPageProps) {
  const { boardId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawFilter = resolvedSearchParams?.filter;
  const filterMode: TaskFilterMode =
    rawFilter === "ARCHIVED"
      ? "ARCHIVED"
      : rawFilter === "ALL"
        ? "ALL"
        : "ACTIVE";

  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor) {
    redirect("/login");
  }

  const db = getDb();
  const boardRepo = new DrizzleBoardRepository(db);
  const membershipRepo = new DrizzleMembershipRepository(db);
  const areaRepo = new DrizzleAreaRepository(db);
  const taskRepo = new DrizzleTaskRepository(db);
  const taskParticipantRepo = new DrizzleTaskParticipantRepository(db);
  const userRepo = new DrizzleUserRepository(db);

  const getBoardDetailUseCase = new GetBoardDetailUseCase(
    boardRepo,
    membershipRepo,
  );
  const boardDetailResult = await getBoardDetailUseCase.execute(actor, boardId);

  // Bezpečnostní pravidlo: Neexistující, soft-deleted nebo neautorizovaná nástěnka -> notFound()
  if (!boardDetailResult.success) {
    notFound();
  }

  const { board, role } = boardDetailResult.data;

  // Načtení oblastí pro tuto nástěnku
  const getBoardAreasUseCase = new GetBoardAreasUseCase(
    boardRepo,
    membershipRepo,
    areaRepo,
  );
  const areasResult = await getBoardAreasUseCase.execute(actor, boardId);
  const areas = areasResult.success ? areasResult.data : [];

  const canManageAreas =
    actor.global_role === "ADMIN" || role === "OWNER" || role === "MANAGER";

  // Načtení úkolů pro tuto nástěnku
  const getBoardTasksUseCase = new GetBoardTasksUseCase(
    boardRepo,
    membershipRepo,
    taskRepo,
    taskParticipantRepo,
    areaRepo,
    userRepo,
  );
  const tasksResult = await getBoardTasksUseCase.execute(actor, boardId, {
    filter: filterMode,
  });
  const tasks = tasksResult.success ? tasksResult.data : [];

  // Načtení členů pro výběr řešitele
  const getBoardMembersUseCase = new GetBoardMembersUseCase(
    boardRepo,
    membershipRepo,
    userRepo,
  );
  const membersResult = await getBoardMembersUseCase.execute(actor, boardId);
  const members = membersResult.success ? membersResult.data : [];

  // Právo na vytvoření úkolu: ADMIN nebo kterýkoliv člen (OWNER, MANAGER, MEMBER)
  const canCreateTask =
    actor.global_role === "ADMIN" || role !== null;

  // Načtení pouze autorizovaných nástěnek aktuálního aktéra pro Switcher
  const getUserBoardsUseCase = new GetUserBoardsUseCase(boardRepo);
  const userBoardsResult = await getUserBoardsUseCase.execute(actor);
  const availableBoards = userBoardsResult.success ? userBoardsResult.data : [];

  const session = await auth.api.getSession({ headers: headersList });
  const userName = session?.user.name ?? "Uživatel";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col">
      {/* Záhlaví nástěnky s navigací a switcherem */}
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-10 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/app"
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-900 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-zinc-100"
            >
              ← Moje nástěnky
            </Link>

            <span className="text-zinc-300">/</span>

            {/* Board Switcher pro rychlé přepnutí mezi nástěnkami */}
            {availableBoards.length > 0 && (
              <BoardSwitcher
                currentBoardId={board.id}
                boards={availableBoards}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 hidden md:inline">
              Přihlášen: <span className="font-medium text-zinc-800">{userName}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Hlavní obsah detailu Nástěnky */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Hlavička Nástěnky */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 sm:p-8 shadow-xs mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
                  {board.name}
                </h1>
                <RoleBadge role={role} />
              </div>
              {board.description && (
                <p className="mt-2 text-sm text-zinc-600 max-w-2xl">
                  {board.description}
                </p>
              )}
            </div>

            <div className="text-xs text-zinc-400 sm:text-right shrink-0">
              <p>Vytvořeno: {new Date(board.createdAt).toLocaleDateString("cs-CZ")}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
            <span>Vaše oprávnění na této nástěnce:</span>
            <span className="font-semibold text-zinc-800">
              {role === "OWNER"
                ? "Vlastník (plná správa a nastavení nástěnky)"
                : role === "MANAGER"
                  ? "Správce (správa oblastí a provozní organizace)"
                  : role === "MEMBER"
                    ? "Člen týmu (práce s úkoly)"
                    : "Systémový administrátor"}
            </span>
          </div>
        </div>

        {/* Sekce oblastí a úkolů Nástěnky */}
        <AreaSection
          boardId={board.id}
          areas={areas}
          tasks={tasks}
          members={members}
          canManageAreas={canManageAreas}
          canCreateTask={canCreateTask}
          currentFilter={filterMode}
        />
      </main>
    </div>
  );
}
