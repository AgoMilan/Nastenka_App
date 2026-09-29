"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleUnitOfWork } from "@/infrastructure/database/repositories/drizzle-unit-of-work.ts";
import {
  AddMemberUseCase,
  ChangeMemberRoleUseCase,
  RemoveMemberUseCase,
  LeaveBoardUseCase,
  addMemberSchema,
  changeMemberRoleSchema,
  removeMemberSchema,
  leaveBoardSchema,
} from "@/modules/membership/index.ts";

export interface MemberActionState {
  readonly success: boolean;
  readonly error?: string;
  readonly memberId?: string;
}

/**
 * Server Action pro přidání nového člena do Nástěnky (AddMember).
 *
 * Invarianty (STEP 4):
 * 1. ActorContext je získán výhradně ze serverové session (nikdy z parametrů klienta).
 * 2. Vstup je autoritativně validován pomocí Zod schématu (addMemberSchema).
 * 3. Volá AddMemberUseCase s UoW transakcí (žádný přímý přístup do DB mimo Use Case).
 * 4. Use Case ověří oprávnění přes MembershipPolicy (MEMBER_ADD – OWNER, MANAGER, ADMIN).
 * 5. Po úspěchu revaliduje cestu /app/board/[boardId].
 */
export async function addMemberAction(
  prevState: MemberActionState | null,
  formData: FormData,
): Promise<MemberActionState> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const rawBoardId = formData.get("boardId");
  const rawUserId = formData.get("userId");
  const rawRole = formData.get("role");

  const parsed = addMemberSchema.safeParse({
    boardId: typeof rawBoardId === "string" ? rawBoardId : "",
    userId: typeof rawUserId === "string" ? rawUserId : "",
    role: typeof rawRole === "string" && rawRole ? rawRole : "MEMBER",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný vstup formuláře.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new AddMemberUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    targetUserId: parsed.data.userId,
    role: parsed.data.role,
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
    memberId: result.data.id,
  };
}

/**
 * Server Action pro změnu role člena na Nástěnce (ChangeMemberRole).
 *
 * Invarianty (STEP 4):
 * 1. ActorContext je získán ze serverové session.
 * 2. Validace vstupu přes Zod schéma (changeMemberRoleSchema).
 * 3. Volá ChangeMemberRoleUseCase (MEMBER_CHANGE_ROLE – pouze OWNER a ADMIN).
 * 4. Po úspěchu revaliduje cestu /app/board/[boardId].
 */
export async function changeMemberRoleAction(
  prevState: MemberActionState | null,
  formData: FormData,
): Promise<MemberActionState> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const rawBoardId = formData.get("boardId");
  const rawTargetUserId = formData.get("targetUserId");
  const rawNewRole = formData.get("newRole");

  const parsed = changeMemberRoleSchema.safeParse({
    boardId: typeof rawBoardId === "string" ? rawBoardId : "",
    targetUserId: typeof rawTargetUserId === "string" ? rawTargetUserId : "",
    newRole: typeof rawNewRole === "string" ? rawNewRole : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný vstup formuláře.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new ChangeMemberRoleUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    targetUserId: parsed.data.targetUserId,
    newRole: parsed.data.newRole,
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
  };
}

/**
 * Server Action pro odebrání člena z Nástěnky (RemoveMember).
 *
 * Invarianty (STEP 4):
 * 1. ActorContext je získán ze serverové session.
 * 2. Validace vstupu přes Zod schéma (removeMemberSchema).
 * 3. Volá RemoveMemberUseCase (MEMBER_REMOVE vyhodnocuje MembershipPolicy).
 * 4. Zákaz odebrání jediného platného OWNERa.
 * 5. Kaskáda: úkoly odebraného člena přechází do stavu Nepřiřazeno, je odebrán ze spoluřešitelů.
 * 6. Po úspěchu revaliduje cestu /app/board/[boardId].
 */
export async function removeMemberAction(
  prevState: MemberActionState | null,
  formData: FormData,
): Promise<MemberActionState> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const rawBoardId = formData.get("boardId");
  const rawTargetUserId = formData.get("targetUserId");

  const parsed = removeMemberSchema.safeParse({
    boardId: typeof rawBoardId === "string" ? rawBoardId : "",
    targetUserId: typeof rawTargetUserId === "string" ? rawTargetUserId : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný vstup formuláře.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new RemoveMemberUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    targetUserId: parsed.data.targetUserId,
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
  };
}

/**
 * Server Action pro dobrovolný odchod z Nástěnky (LeaveBoard).
 *
 * Invarianty (STEP 4 / STEP 21):
 * 1. ActorContext je získán ze serverové session (identita je dána serverem).
 * 2. Validace vstupu přes Zod schéma (leaveBoardSchema).
 * 3. Volá LeaveBoardUseCase (MEMBER_LEAVE vyhodnocuje MembershipPolicy).
 * 4. Zákaz odchodu pro OWNERa bez předchozího převodu vlastnictví.
 * 5. Kaskáda: úkoly přechází do stavu Nepřiřazeno, odstranění ze spoluřešitelů.
 * 6. Po úspěšném odchodu přesměruje na /app (Moje nástěnky).
 */
export async function leaveBoardAction(
  prevState: MemberActionState | null,
  formData: FormData,
): Promise<MemberActionState> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const rawBoardId = formData.get("boardId");

  const parsed = leaveBoardSchema.safeParse({
    boardId: typeof rawBoardId === "string" ? rawBoardId : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný vstup formuláře.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new LeaveBoardUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath("/app");
  redirect("/app");
}
