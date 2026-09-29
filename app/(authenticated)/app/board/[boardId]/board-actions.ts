"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleBoardRepository } from "@/infrastructure/database/repositories/drizzle-board-repository.ts";
import { DrizzleMembershipRepository } from "@/infrastructure/database/repositories/drizzle-membership-repository.ts";
import { UpdateBoardUseCase } from "@/modules/boards/application/use-cases/index.ts";
import { updateBoardSchema } from "@/modules/boards/api/dto/board.dto.ts";

export interface BoardActionState {
  readonly success: boolean;
  readonly error?: string;
  readonly boardId?: string;
}

/**
 * Server Action pro úpravu metadat Nástěnky (název a popis).
 *
 * Invarianty:
 * 1. ActorContext je získán výhradně ze serverové session (nikdy z parametrů klienta).
 * 2. Vstup je autoritativně validován pomocí Zod schématu (updateBoardSchema).
 * 3. Volá UpdateBoardUseCase (žádný přímý zápis do DB mimo Use Case).
 * 4. Use Case ověří oprávnění přes BoardPolicy (BOARD_EDIT – OWNER, MANAGER, ADMIN).
 * 5. Po úspěchu revaliduje cestu /app/board/[boardId] i /app.
 */
export async function updateBoardAction(
  prevState: BoardActionState | null,
  formData: FormData,
): Promise<BoardActionState> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const rawBoardId = formData.get("boardId");
  const rawName = formData.get("name");
  const rawDescription = formData.get("description");

  const parsed = updateBoardSchema.safeParse({
    boardId: typeof rawBoardId === "string" ? rawBoardId : "",
    name: typeof rawName === "string" ? rawName : "",
    description:
      typeof rawDescription === "string" ? rawDescription : undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný vstup formuláře.",
    };
  }

  const boardId =
    parsed.data.boardId ?? (typeof rawBoardId === "string" ? rawBoardId.trim() : "");
  if (!boardId) {
    return {
      success: false,
      error: "ID Nástěnky je povinné.",
    };
  }

  const db = getDb();
  const boardRepo = new DrizzleBoardRepository(db);
  const membershipRepo = new DrizzleMembershipRepository(db);
  const useCase = new UpdateBoardUseCase(boardRepo, membershipRepo);

  const result = await useCase.execute(actor, {
    boardId,
    name: parsed.data.name,
    description: parsed.data.description ? parsed.data.description.trim() : null,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${boardId}`);
  revalidatePath("/app");

  return {
    success: true,
    boardId: result.data.board.id,
  };
}
