import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveActorContext, auth } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleBoardRepository } from "@/infrastructure/database/repositories/drizzle-board-repository.ts";
import { GetUserBoardsUseCase } from "@/modules/boards/application/use-cases/get-user-boards.use-case.ts";
import { AppHeader } from "@/components/navigation/app-header.tsx";
import { BoardCard } from "@/components/boards/board-card.tsx";
import { CreateBoardSection } from "@/components/boards/create-board-section.tsx";
import { CreateBoardForm } from "@/components/boards/create-board-form.tsx";

export default async function AppPage() {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor) {
    redirect("/login");
  }

  const session = await auth.api.getSession({ headers: headersList });
  const userName = session?.user.name ?? "Uživatel";
  const userEmail = session?.user.email ?? "";

  const db = getDb();
  const boardRepo = new DrizzleBoardRepository(db);
  const getUserBoardsUseCase = new GetUserBoardsUseCase(boardRepo);
  const boardsResult = await getUserBoardsUseCase.execute(actor);
  const boards = boardsResult.success ? boardsResult.data : [];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <AppHeader userName={userName} userEmail={userEmail} activeTab="boards" />

      {/* Obsah stránky: Moje nástěnky */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Moje nástěnky
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Přehled všech vašich pracovních prostorů a týmů.
            </p>
          </div>

          {boards.length > 0 && <CreateBoardSection />}
        </div>

        {boards.length === 0 ? (
          /* Empty State pro uživatele bez nástěnek */
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-500 mb-4">
              <span className="text-2xl font-light">📋</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Zatím nemáte žádnou nástěnku
            </h2>
            <p className="mt-2 text-sm text-zinc-500 mb-6">
              Vytvořte svou první nástěnku a začněte jednoduše organizovat práci se svým týmem.
            </p>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-6 text-left">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">
                Vytvořit první nástěnku
              </h3>
              <CreateBoardForm />
            </div>
          </div>
        ) : (
          /* Seznam dostupných nástěnek */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
