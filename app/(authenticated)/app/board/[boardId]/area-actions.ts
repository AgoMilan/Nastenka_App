"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleUnitOfWork } from "@/infrastructure/database/repositories/drizzle-unit-of-work.ts";
import {
  CreateAreaUseCase,
  UpdateAreaUseCase,
  DeleteAreaUseCase,
} from "@/modules/areas/application/use-cases/index.ts";
import {
  createAreaSchema,
  updateAreaSchema,
  deleteAreaSchema,
} from "@/modules/areas/api/dto/area.dto.ts";

export interface AreaActionState {
  readonly success: boolean;
  readonly error?: string;
  readonly areaId?: string;
}

/**
 * Server Action pro vytvoření nové Oblasti.
 *
 * Invarianty (STEP 2):
 * 1. ActorContext je získán výhradně ze serverové session (nikdy z parametrů klienta).
 * 2. Vstup je autoritativně validován pomocí Zod schématu (createAreaSchema).
 * 3. Volá CreateAreaUseCase s UoW transakcí (žádný přímý přístup do DB mimo Use Case).
 * 4. Use Case ověří oprávnění přes AreaPolicy (AREA_CREATE – OWNER, MANAGER, ADMIN).
 * 5. Po úspěchu revaliduje cestu /app/board/[boardId].
 */
export async function createAreaAction(
  prevState: AreaActionState | null,
  formData: FormData,
): Promise<AreaActionState> {
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

  const parsed = createAreaSchema.safeParse({
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

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new CreateAreaUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    name: parsed.data.name,
    description: parsed.data.description || null,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${parsed.data.boardId}`);
  return {
    success: true,
    areaId: result.data.id,
  };
}

/**
 * Server Action pro úpravu existující Oblasti.
 *
 * Invarianty (STEP 2):
 * 1. ActorContext je získán ze serverové session.
 * 2. Validace vstupu přes Zod schéma (updateAreaSchema).
 * 3. Volá UpdateAreaUseCase (AREA_EDIT oprávnění vyhodnocuje AreaPolicy).
 * 4. Po úspěchu revaliduje cestu /app/board/[boardId].
 */
export async function updateAreaAction(
  prevState: AreaActionState | null,
  formData: FormData,
): Promise<AreaActionState> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const rawBoardId = formData.get("boardId");
  const rawAreaId = formData.get("areaId");
  const rawName = formData.get("name");
  const rawDescription = formData.get("description");

  const parsed = updateAreaSchema.safeParse({
    areaId: typeof rawAreaId === "string" ? rawAreaId : "",
    name: typeof rawName === "string" ? rawName : undefined,
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
  const useCase = new UpdateAreaUseCase(uow);

  const result = await useCase.execute(actor, {
    areaId: parsed.data.areaId,
    name: parsed.data.name,
    description: parsed.data.description || null,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  const boardId = typeof rawBoardId === "string" ? rawBoardId.trim() : "";
  if (boardId) {
    revalidatePath(`/app/board/${boardId}`);
  }

  return {
    success: true,
    areaId: result.data.id,
  };
}

/**
 * Server Action pro řízené smazání Oblasti.
 *
 * Invarianty (STEP 2):
 * 1. ActorContext je získán ze serverové session.
 * 2. Vyžaduje přesné potvrzení textem "SMAZAT" (autoritativní validace Zod + Use Case).
 * 3. Volá DeleteAreaUseCase s kaskádovým odstraněním úkolů v UoW transakci.
 * 4. Po úspěchu revaliduje cestu /app/board/[boardId].
 */
export async function deleteAreaAction(
  prevState: AreaActionState | null,
  formData: FormData,
): Promise<AreaActionState> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const rawBoardId = formData.get("boardId");
  const rawAreaId = formData.get("areaId");
  const rawConfirmation = formData.get("confirmation");

  const parsed = deleteAreaSchema.safeParse({
    areaId: typeof rawAreaId === "string" ? rawAreaId : "",
    confirmation:
      typeof rawConfirmation === "string" ? rawConfirmation : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Pro smazání oblasti je vyžadováno přesné potvrzení textem 'SMAZAT'.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new DeleteAreaUseCase(uow);

  const result = await useCase.execute(actor, {
    areaId: parsed.data.areaId,
    confirmation: parsed.data.confirmation,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  const boardId = typeof rawBoardId === "string" ? rawBoardId.trim() : "";
  if (boardId) {
    revalidatePath(`/app/board/${boardId}`);
  }

  return {
    success: true,
  };
}
