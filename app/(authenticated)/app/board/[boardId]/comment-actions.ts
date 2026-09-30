"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleUnitOfWork } from "@/infrastructure/database/repositories/drizzle-unit-of-work.ts";
import { DrizzleBoardRepository } from "@/infrastructure/database/repositories/drizzle-board-repository.ts";
import { DrizzleMembershipRepository } from "@/infrastructure/database/repositories/drizzle-membership-repository.ts";
import { DrizzleTaskRepository } from "@/infrastructure/database/repositories/drizzle-task-repository.ts";
import { DrizzleTaskCommentRepository } from "@/infrastructure/database/repositories/drizzle-task-comment-repository.ts";
import { DrizzleUserRepository } from "@/infrastructure/database/repositories/drizzle-user-repository.ts";
import { DrizzleTaskParticipantRepository } from "@/infrastructure/database/repositories/drizzle-task-participant-repository.ts";
import {
  GetTaskCommentsUseCase,
  AddTaskCommentUseCase,
  UpdateTaskCommentUseCase,
  DeleteTaskCommentUseCase,
  type TaskCommentView,
} from "@/modules/tasks/application/use-cases/index.ts";
import {
  createTaskCommentSchema,
  updateTaskCommentSchema,
  deleteTaskCommentSchema,
  getTaskCommentsSchema,
} from "@/modules/tasks/api/dto/task-comment.dto.ts";

export interface CommentActionResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

/**
 * Server Action: Načtení komentářů k úkolu.
 */
export async function getTaskCommentsAction(
  boardId: string,
  taskId: string,
): Promise<CommentActionResult<TaskCommentView[]>> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const parsed = getTaskCommentsSchema.safeParse({ boardId, taskId });
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
  const taskCommentRepo = new DrizzleTaskCommentRepository(db);
  const userRepo = new DrizzleUserRepository(db);
  const taskParticipantRepo = new DrizzleTaskParticipantRepository(db);

  const useCase = new GetTaskCommentsUseCase(
    boardRepo,
    membershipRepo,
    taskRepo,
    taskCommentRepo,
    userRepo,
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
 * Server Action: Přidání komentáře k úkolu.
 */
export async function addTaskCommentAction(
  boardId: string,
  taskId: string,
  content: string,
): Promise<CommentActionResult<{ id: string }>> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const parsed = createTaskCommentSchema.safeParse({ boardId, taskId, content });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Neplatná vstupní data.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new AddTaskCommentUseCase(uow);

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

  revalidatePath(`/app/board/${boardId}`);
  revalidatePath("/app/my-work");

  return {
    success: true,
    data: { id: result.data.id },
  };
}

/**
 * Server Action: Úprava existujícího komentáře (výhradně autor).
 */
export async function updateTaskCommentAction(
  boardId: string,
  taskId: string,
  commentId: string,
  content: string,
): Promise<CommentActionResult<void>> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const parsed = updateTaskCommentSchema.safeParse({
    boardId,
    taskId,
    commentId,
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
  const useCase = new UpdateTaskCommentUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    taskId: parsed.data.taskId,
    commentId: parsed.data.commentId,
    content: parsed.data.content,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${boardId}`);
  revalidatePath("/app/my-work");

  return {
    success: true,
  };
}

/**
 * Server Action: Smazání komentáře (výhradně autor).
 */
export async function deleteTaskCommentAction(
  boardId: string,
  taskId: string,
  commentId: string,
): Promise<CommentActionResult<void>> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const parsed = deleteTaskCommentSchema.safeParse({
    boardId,
    taskId,
    commentId,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Neplatná vstupní data.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new DeleteTaskCommentUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    taskId: parsed.data.taskId,
    commentId: parsed.data.commentId,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${boardId}`);
  revalidatePath("/app/my-work");

  return {
    success: true,
  };
}
