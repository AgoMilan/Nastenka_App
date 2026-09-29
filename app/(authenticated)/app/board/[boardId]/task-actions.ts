"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleUnitOfWork } from "@/infrastructure/database/repositories/drizzle-unit-of-work.ts";
import { CreateTaskUseCase } from "@/modules/tasks/application/use-cases/create-task.use-case.ts";
import { createTaskSchema } from "@/modules/tasks/api/dto/task.dto.ts";

export interface TaskActionState {
  readonly success: boolean;
  readonly error?: string;
  readonly taskId?: string;
}

/**
 * Server Action pro vytvoření nového Úkolu (CreateTask).
 *
 * Invarianty (STEP 3):
 * 1. ActorContext je získáván výhradně ze serverové session (nikdy z parametrů klienta).
 * 2. Vstup je autoritativně validován pomocí Zod schématu (createTaskSchema).
 * 3. Volá CreateTaskUseCase s UoW transakcí (žádný přímý přístup do DB mimo Use Case).
 * 4. Use Case ověřuje oprávnění přes TaskPolicy (TASK_CREATE – povoleno všem členům i ADMINovi).
 * 5. Provádí cross-board kontrolu pro oblast (areaId) a řešitele (assigneeId).
 * 6. Po úspěchu revaliduje cestu /app/board/[boardId].
 */
export async function createTaskAction(
  prevState: TaskActionState | null,
  formData: FormData,
): Promise<TaskActionState> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const rawBoardId = formData.get("boardId");
  const rawTitle = formData.get("title");
  const rawDescription = formData.get("description");
  const rawAreaId = formData.get("areaId");
  const rawAssigneeId = formData.get("assigneeId");
  const rawPriority = formData.get("priority");
  const rawDueDate = formData.get("dueDate");

  const parsed = createTaskSchema.safeParse({
    boardId: typeof rawBoardId === "string" ? rawBoardId : "",
    title: typeof rawTitle === "string" ? rawTitle : "",
    description:
      typeof rawDescription === "string" ? rawDescription : undefined,
    areaId:
      typeof rawAreaId === "string" && rawAreaId.trim() !== ""
        ? rawAreaId.trim()
        : null,
    assigneeId:
      typeof rawAssigneeId === "string" && rawAssigneeId.trim() !== ""
        ? rawAssigneeId.trim()
        : null,
    priority:
      typeof rawPriority === "string" && rawPriority ? rawPriority : "BĚŽNÁ",
    dueDate:
      typeof rawDueDate === "string" && rawDueDate.trim() !== ""
        ? rawDueDate.trim()
        : null,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný vstup formuláře.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new CreateTaskUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    areaId: parsed.data.areaId || null,
    assigneeId: parsed.data.assigneeId || null,
    priority: parsed.data.priority,
    dueDate:
      parsed.data.dueDate && parsed.data.dueDate !== ""
        ? new Date(parsed.data.dueDate)
        : null,
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
    taskId: result.data.id,
  };
}
