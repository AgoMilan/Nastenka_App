"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleUnitOfWork } from "@/infrastructure/database/repositories/drizzle-unit-of-work.ts";
import { DrizzleBoardRepository } from "@/infrastructure/database/repositories/drizzle-board-repository.ts";
import { DrizzleMembershipRepository } from "@/infrastructure/database/repositories/drizzle-membership-repository.ts";
import { DrizzleTaskRepository } from "@/infrastructure/database/repositories/drizzle-task-repository.ts";
import { DrizzleUserTaskNoteRepository } from "@/infrastructure/database/repositories/drizzle-user-task-note-repository.ts";
import { DrizzleTaskParticipantRepository } from "@/infrastructure/database/repositories/drizzle-task-participant-repository.ts";
import {
  GetUserTaskNoteUseCase,
  UpsertUserTaskNoteUseCase,
  DeleteUserTaskNoteUseCase,
  type UserTaskNoteView,
} from "@/modules/tasks/application/use-cases/index.ts";
import {
  getUserTaskNoteSchema,
  upsertUserTaskNoteSchema,
  deleteUserTaskNoteSchema,
} from "@/modules/tasks/api/dto/user-task-note.dto.ts";

export interface NoteActionResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

/**
 * Server Action: Načtení soukromé poznámky uživatele k úkolu.
 *
 * Invarianty (Soukromé poznámky):
 * 1. ActorContext je získáván výhradně ze serverové session (nikdy z parametrů klienta).
 * 2. Klient nesmí určovat userId.
 * 3. Uživatel načítá pouze svou vlastní poznámku.
 */
export async function getUserTaskNoteAction(
  boardId: string,
  taskId: string,
): Promise<NoteActionResult<UserTaskNoteView | null>> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const parsed = getUserTaskNoteSchema.safeParse({ boardId, taskId });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Neplatná vstupní data.",
    };
  }

  const db = getDb();
  const boardRepo = new DrizzleBoardRepository(db);
  const membershipRepo = new DrizzleMembershipRepository(db);
  const taskRepo = new DrizzleTaskRepository(db);
  const userTaskNoteRepo = new DrizzleUserTaskNoteRepository(db);
  const taskParticipantRepo = new DrizzleTaskParticipantRepository(db);

  const useCase = new GetUserTaskNoteUseCase(
    boardRepo,
    membershipRepo,
    taskRepo,
    userTaskNoteRepo,
    taskParticipantRepo,
  );

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    taskId: parsed.data.taskId,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Server Action: Vytvoření nebo úprava soukromé poznámky uživatele k úkolu.
 */
export async function upsertUserTaskNoteAction(
  boardId: string,
  taskId: string,
  content: string,
): Promise<NoteActionResult<UserTaskNoteView>> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const parsed = upsertUserTaskNoteSchema.safeParse({
    boardId,
    taskId,
    content,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Neplatná vstupní data.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new UpsertUserTaskNoteUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    taskId: parsed.data.taskId,
    content: parsed.data.content,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath("/app/my-work");
  revalidatePath(`/app/board/${parsed.data.boardId}`);

  return {
    success: true,
    data: {
      id: result.data.id,
      userId: result.data.userId,
      taskId: result.data.taskId,
      content: result.data.content,
      createdAt: result.data.createdAt,
      updatedAt: result.data.updatedAt,
      isArchived: false,
    },
  };
}

/**
 * Server Action: Smazání soukromé poznámky uživatele k úkolu.
 */
export async function deleteUserTaskNoteAction(
  boardId: string,
  taskId: string,
): Promise<NoteActionResult> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const parsed = deleteUserTaskNoteSchema.safeParse({ boardId, taskId });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Neplatná vstupní data.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new DeleteUserTaskNoteUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    taskId: parsed.data.taskId,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath("/app/my-work");
  revalidatePath(`/app/board/${parsed.data.boardId}`);

  return {
    success: true,
  };
}
