"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleUnitOfWork } from "@/infrastructure/database/repositories/drizzle-unit-of-work.ts";
import { CreateBoardUseCase } from "@/modules/boards/application/use-cases/create-board.use-case.ts";
import { createBoardSchema } from "@/modules/boards/api/dto/board.dto.ts";

export interface CreateBoardActionState {
  readonly success: boolean;
  readonly error?: string;
  readonly boardId?: string;
}

/**
 * Server Action pro vytvoření nové Nástěnky.
 *
 * Bezpečnostní invarianty:
 * 1. ActorContext je získán výhradně ze serverové session (nikdy z parametrů klienta).
 * 2. Vstup je autoritativně validován pomocí Zod schématu.
 * 3. Volá CreateBoardUseCase (žádný přímý přístup do databáze mimo Use Case / Unit of Work).
 * 4. Po úspěchu revaliduje cestu /app a přesměruje na detail nové Nástěnky.
 */
export async function createBoardAction(
  prevState: CreateBoardActionState | null,
  formData: FormData,
): Promise<CreateBoardActionState> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const rawName = formData.get("name");
  const rawDescription = formData.get("description");

  const parsed = createBoardSchema.safeParse({
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

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new CreateBoardUseCase(uow);

  const result = await useCase.execute(actor, {
    name: parsed.data.name,
    description: parsed.data.description || null,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath("/app");
  redirect(`/app/board/${result.data.board.id}`);
}
