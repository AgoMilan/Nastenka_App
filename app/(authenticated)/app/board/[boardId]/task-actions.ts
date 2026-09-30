"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import { DrizzleUnitOfWork } from "@/infrastructure/database/repositories/drizzle-unit-of-work.ts";
import { DrizzleTaskRepository } from "@/infrastructure/database/repositories/drizzle-task-repository.ts";
import {
  CreateTaskUseCase,
  UpdateTaskUseCase,
  ChangeTaskAssigneeUseCase,
  ChangeTaskAreaUseCase,
  ChangeTaskDueDateUseCase,
  ChangeTaskPriorityUseCase,
  ChangeTaskStatusUseCase,
  TakeOverTaskUseCase,
  JoinTaskAsParticipantUseCase,
  LeaveTaskAsParticipantUseCase,
  RemoveTaskParticipantUseCase,
  ArchiveTaskUseCase,
  DeleteTaskUseCase,
  ReorderTaskUseCase,
} from "@/modules/tasks/application/use-cases/index.ts";
import {
  createTaskSchema,
  editTaskSchema,
  changeTaskAssigneeSchema,
  changeTaskStatusSchema,
  takeOverTaskSchema,
  joinTaskAsParticipantSchema,
  leaveTaskAsParticipantSchema,
  removeTaskParticipantSchema,
  archiveTaskSchema,
  deleteTaskSchema,
  reorderTaskSchema,
} from "@/modules/tasks/api/dto/task.dto.ts";

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

/**
 * Server Action pro úpravu existujícího Úkolu (UpdateTask).
 *
 * Invarianty (STEP 5A):
 * 1. ActorContext je získáván výhradně ze serverové session (nikdy z parametrů klienta).
 * 2. Vstup je autoritativně validován pomocí Zod schématu (editTaskSchema).
 * 3. Zkontroluje existenci úkolu a shodu boardId (cross-board izolace).
 * 4. Změněná pole deleguje na odpovídající doménové Use Casy (UpdateTaskUseCase,
 *    ChangeTaskAssigneeUseCase, ChangeTaskAreaUseCase, ChangeTaskDueDateUseCase, ChangeTaskPriorityUseCase).
 * 5. Žádná přímá DB operace mimo Use Casy a repozitáře.
 * 6. Autorizace každého pole je striktně řízena backendovou TaskPolicy:
 *    - title, description, priority, assigneeId: povoleno všem členům Nástěnky
 *    - areaId, dueDate: vyžaduje roli Řešitele, Spoluřešitele, Správce nebo Vlastníka
 * 7. Po úspěchu revaliduje cestu /app/board/[boardId].
 */
export async function updateTaskAction(
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
  const rawTaskId = formData.get("taskId");
  const rawTitle = formData.get("title");
  const rawDescription = formData.get("description");
  const rawAreaId = formData.get("areaId");
  const rawAssigneeId = formData.get("assigneeId");
  const rawPriority = formData.get("priority");
  const rawDueDate = formData.get("dueDate");

  const parsed = editTaskSchema.safeParse({
    boardId: typeof rawBoardId === "string" ? rawBoardId : "",
    taskId: typeof rawTaskId === "string" ? rawTaskId : "",
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
  const taskRepo = new DrizzleTaskRepository(db);
  const existingTask = await taskRepo.findById(parsed.data.taskId);

  if (!existingTask) {
    return {
      success: false,
      error: "Úkol nebyl nalezen.",
    };
  }

  if (existingTask.boardId !== parsed.data.boardId) {
    return {
      success: false,
      error: "Úkol nepatří do zadané Nástěnky.",
    };
  }

  const uow = new DrizzleUnitOfWork(db);

  // 1. Úprava názvu a/nebo popisu (UpdateTaskUseCase)
  const newTitle = parsed.data.title.trim();
  const newDescription =
    parsed.data.description && parsed.data.description.trim().length > 0
      ? parsed.data.description.trim()
      : null;
  const currentDescription =
    existingTask.description && existingTask.description.trim().length > 0
      ? existingTask.description.trim()
      : null;

  if (newTitle !== existingTask.title || newDescription !== currentDescription) {
    const updateTaskUseCase = new UpdateTaskUseCase(uow);
    const updateResult = await updateTaskUseCase.execute(actor, {
      taskId: parsed.data.taskId,
      title: newTitle,
      description: newDescription,
    });
    if (!updateResult.success) {
      return {
        success: false,
        error: updateResult.error.message,
      };
    }
  }

  // 2. Změna řešitele (ChangeTaskAssigneeUseCase)
  const newAssigneeId =
    parsed.data.assigneeId && parsed.data.assigneeId.trim().length > 0
      ? parsed.data.assigneeId.trim()
      : null;
  const currentAssigneeId = existingTask.assigneeId;

  if (newAssigneeId !== currentAssigneeId) {
    const changeAssigneeUseCase = new ChangeTaskAssigneeUseCase(uow);
    const assigneeResult = await changeAssigneeUseCase.execute(actor, {
      taskId: parsed.data.taskId,
      assigneeId: newAssigneeId,
    });
    if (!assigneeResult.success) {
      return {
        success: false,
        error: assigneeResult.error.message,
      };
    }
  }

  // 3. Změna oblasti (ChangeTaskAreaUseCase)
  const newAreaId =
    parsed.data.areaId && parsed.data.areaId.trim().length > 0
      ? parsed.data.areaId.trim()
      : null;
  const currentAreaId = existingTask.areaId;

  if (newAreaId !== currentAreaId) {
    const changeAreaUseCase = new ChangeTaskAreaUseCase(uow);
    const areaResult = await changeAreaUseCase.execute(actor, {
      taskId: parsed.data.taskId,
      newAreaId: newAreaId,
    });
    if (!areaResult.success) {
      return {
        success: false,
        error: areaResult.error.message,
      };
    }
  }

  // 4. Změna termínu (ChangeTaskDueDateUseCase)
  let newDueDate: Date | null = null;
  if (
    parsed.data.dueDate &&
    typeof parsed.data.dueDate === "string" &&
    parsed.data.dueDate.trim().length > 0
  ) {
    newDueDate = new Date(parsed.data.dueDate.trim());
  } else if (parsed.data.dueDate instanceof Date) {
    newDueDate = parsed.data.dueDate;
  }

  const currentDueDate = existingTask.dueDate
    ? new Date(existingTask.dueDate)
    : null;

  const dueDateChanged =
    (newDueDate === null && currentDueDate !== null) ||
    (newDueDate !== null && currentDueDate === null) ||
    (newDueDate !== null &&
      currentDueDate !== null &&
      newDueDate.getTime() !== currentDueDate.getTime());

  if (dueDateChanged) {
    const changeDueDateUseCase = new ChangeTaskDueDateUseCase(uow);
    const dueDateResult = await changeDueDateUseCase.execute(actor, {
      taskId: parsed.data.taskId,
      dueDate: newDueDate,
    });
    if (!dueDateResult.success) {
      return {
        success: false,
        error: dueDateResult.error.message,
      };
    }
  }

  // 5. Změna priority (ChangeTaskPriorityUseCase)
  const newPriority = parsed.data.priority;
  const currentPriority = existingTask.priority;

  if (newPriority !== currentPriority) {
    const changePriorityUseCase = new ChangeTaskPriorityUseCase(uow);
    const priorityResult = await changePriorityUseCase.execute(actor, {
      taskId: parsed.data.taskId,
      priority: newPriority,
    });
    if (!priorityResult.success) {
      return {
        success: false,
        error: priorityResult.error.message,
      };
    }
  }

  revalidatePath(`/app/board/${parsed.data.boardId}`);

  return {
    success: true,
    taskId: parsed.data.taskId,
  };
}

/**
 * Server Action pro samostatnou změnu řešitele úkolu (ChangeTaskAssignee).
 */
export async function changeTaskAssigneeAction(
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
  const rawTaskId = formData.get("taskId");
  const rawAssigneeId = formData.get("assigneeId");

  const parsed = changeTaskAssigneeSchema.safeParse({
    taskId: typeof rawTaskId === "string" ? rawTaskId : "",
    assigneeId:
      typeof rawAssigneeId === "string" && rawAssigneeId.trim() !== ""
        ? rawAssigneeId.trim()
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
  const changeAssigneeUseCase = new ChangeTaskAssigneeUseCase(uow);

  const result = await changeAssigneeUseCase.execute(actor, {
    taskId: parsed.data.taskId,
    assigneeId: parsed.data.assigneeId || null,
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
    taskId: parsed.data.taskId,
  };
}

/**
 * Server Action pro změnu stavu úkolu (ChangeTaskStatus).
 */
export async function changeTaskStatusAction(
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
  const rawTaskId = formData.get("taskId");
  const rawStatus = formData.get("status");

  const parsed = changeTaskStatusSchema.safeParse({
    taskId: typeof rawTaskId === "string" ? rawTaskId : "",
    status: typeof rawStatus === "string" ? rawStatus : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný stav úkolu.",
    };
  }

  const boardId = typeof rawBoardId === "string" ? rawBoardId.trim() : "";
  if (!boardId) {
    return {
      success: false,
      error: "ID Nástěnky je povinné.",
    };
  }

  const db = getDb();
  const taskRepo = new DrizzleTaskRepository(db);
  const existingTask = await taskRepo.findById(parsed.data.taskId);

  if (!existingTask) {
    return {
      success: false,
      error: "Úkol nebyl nalezen.",
    };
  }

  if (existingTask.boardId !== boardId) {
    return {
      success: false,
      error: "Úkol nepatří do zadané Nástěnky.",
    };
  }

  const uow = new DrizzleUnitOfWork(db);
  const useCase = new ChangeTaskStatusUseCase(uow);

  const result = await useCase.execute(actor, {
    taskId: parsed.data.taskId,
    newStatus: parsed.data.status,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${boardId}`);
  return {
    success: true,
    taskId: parsed.data.taskId,
  };
}

/**
 * Server Action pro převzetí úkolu na sebe (TakeOverTask).
 */
export async function takeOverTaskAction(
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
  const rawTaskId = formData.get("taskId");

  const parsed = takeOverTaskSchema.safeParse({
    taskId: typeof rawTaskId === "string" ? rawTaskId : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný identifikátor úkolu.",
    };
  }

  const boardId = typeof rawBoardId === "string" ? rawBoardId.trim() : "";
  if (!boardId) {
    return {
      success: false,
      error: "ID Nástěnky je povinné.",
    };
  }

  const db = getDb();
  const taskRepo = new DrizzleTaskRepository(db);
  const existingTask = await taskRepo.findById(parsed.data.taskId);

  if (!existingTask) {
    return {
      success: false,
      error: "Úkol nebyl nalezen.",
    };
  }

  if (existingTask.boardId !== boardId) {
    return {
      success: false,
      error: "Úkol nepatří do zadané Nástěnky.",
    };
  }

  const uow = new DrizzleUnitOfWork(db);
  const useCase = new TakeOverTaskUseCase(uow);

  const result = await useCase.execute(actor, {
    taskId: parsed.data.taskId,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${boardId}`);
  return {
    success: true,
    taskId: parsed.data.taskId,
  };
}

/**
 * Server Action pro dobrovolné připojení k úkolu jako spoluřešitel (JoinTaskAsParticipant).
 */
export async function joinTaskAction(
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
  const rawTaskId = formData.get("taskId");

  const parsed = joinTaskAsParticipantSchema.safeParse({
    taskId: typeof rawTaskId === "string" ? rawTaskId : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný identifikátor úkolu.",
    };
  }

  const boardId = typeof rawBoardId === "string" ? rawBoardId.trim() : "";
  if (!boardId) {
    return {
      success: false,
      error: "ID Nástěnky je povinné.",
    };
  }

  const db = getDb();
  const taskRepo = new DrizzleTaskRepository(db);
  const existingTask = await taskRepo.findById(parsed.data.taskId);

  if (!existingTask) {
    return {
      success: false,
      error: "Úkol nebyl nalezen.",
    };
  }

  if (existingTask.boardId !== boardId) {
    return {
      success: false,
      error: "Úkol nepatří do zadané Nástěnky.",
    };
  }

  const uow = new DrizzleUnitOfWork(db);
  const useCase = new JoinTaskAsParticipantUseCase(uow);

  const result = await useCase.execute(actor, {
    taskId: parsed.data.taskId,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${boardId}`);
  return {
    success: true,
    taskId: parsed.data.taskId,
  };
}

/**
 * Server Action pro odpojení se z úkolu jako spoluřešitel (LeaveTaskAsParticipant).
 */
export async function leaveTaskAction(
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
  const rawTaskId = formData.get("taskId");

  const parsed = leaveTaskAsParticipantSchema.safeParse({
    taskId: typeof rawTaskId === "string" ? rawTaskId : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný identifikátor úkolu.",
    };
  }

  const boardId = typeof rawBoardId === "string" ? rawBoardId.trim() : "";
  if (!boardId) {
    return {
      success: false,
      error: "ID Nástěnky je povinné.",
    };
  }

  const db = getDb();
  const taskRepo = new DrizzleTaskRepository(db);
  const existingTask = await taskRepo.findById(parsed.data.taskId);

  if (!existingTask) {
    return {
      success: false,
      error: "Úkol nebyl nalezen.",
    };
  }

  if (existingTask.boardId !== boardId) {
    return {
      success: false,
      error: "Úkol nepatří do zadané Nástěnky.",
    };
  }

  const uow = new DrizzleUnitOfWork(db);
  const useCase = new LeaveTaskAsParticipantUseCase(uow);

  const result = await useCase.execute(actor, {
    taskId: parsed.data.taskId,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${boardId}`);
  return {
    success: true,
    taskId: parsed.data.taskId,
  };
}

/**
 * Server Action pro nucené odebrání spoluřešitele z úkolu (RemoveTaskParticipant).
 */
export async function removeTaskParticipantAction(
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
  const rawTaskId = formData.get("taskId");
  const rawParticipantUserId = formData.get("participantUserId");

  const parsed = removeTaskParticipantSchema.safeParse({
    taskId: typeof rawTaskId === "string" ? rawTaskId : "",
    participantUserId:
      typeof rawParticipantUserId === "string" ? rawParticipantUserId : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Neplatný identifikátor spoluřešitele.",
    };
  }

  const boardId = typeof rawBoardId === "string" ? rawBoardId.trim() : "";
  if (!boardId) {
    return {
      success: false,
      error: "ID Nástěnky je povinné.",
    };
  }

  const db = getDb();
  const taskRepo = new DrizzleTaskRepository(db);
  const existingTask = await taskRepo.findById(parsed.data.taskId);

  if (!existingTask) {
    return {
      success: false,
      error: "Úkol nebyl nalezen.",
    };
  }

  if (existingTask.boardId !== boardId) {
    return {
      success: false,
      error: "Úkol nepatří do zadané Nástěnky.",
    };
  }

  const uow = new DrizzleUnitOfWork(db);
  const useCase = new RemoveTaskParticipantUseCase(uow);

  const result = await useCase.execute(actor, {
    taskId: parsed.data.taskId,
    targetUserId: parsed.data.participantUserId,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${boardId}`);
  return {
    success: true,
    taskId: parsed.data.taskId,
  };
}

/**
 * Server Action pro archivaci úkolu (ArchiveTask).
 */
export async function archiveTaskAction(
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
  const rawTaskId = formData.get("taskId");

  const parsed = archiveTaskSchema.safeParse({
    taskId: typeof rawTaskId === "string" ? rawTaskId : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný identifikátor úkolu.",
    };
  }

  const boardId = typeof rawBoardId === "string" ? rawBoardId.trim() : "";
  if (!boardId) {
    return {
      success: false,
      error: "ID Nástěnky je povinné.",
    };
  }

  const db = getDb();
  const taskRepo = new DrizzleTaskRepository(db);
  const existingTask = await taskRepo.findById(parsed.data.taskId);

  if (!existingTask) {
    return {
      success: false,
      error: "Úkol nebyl nalezen.",
    };
  }

  if (existingTask.boardId !== boardId) {
    return {
      success: false,
      error: "Úkol nepatří do zadané Nástěnky.",
    };
  }

  const uow = new DrizzleUnitOfWork(db);
  const useCase = new ArchiveTaskUseCase(uow);

  const result = await useCase.execute(actor, {
    taskId: parsed.data.taskId,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${boardId}`);
  return {
    success: true,
    taskId: parsed.data.taskId,
  };
}

/**
 * Server Action pro řízené trvalé smazání úkolu (DeleteTask).
 */
export async function deleteTaskAction(
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
  const rawTaskId = formData.get("taskId");
  const rawConfirmation = formData.get("confirmation");

  const parsed = deleteTaskSchema.safeParse({
    taskId: typeof rawTaskId === "string" ? rawTaskId : "",
    confirmation: typeof rawConfirmation === "string" ? rawConfirmation : "",
  });

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Pro smazání úkolu je vyžadováno přesné potvrzení textem 'SMAZAT'.",
    };
  }

  const boardId = typeof rawBoardId === "string" ? rawBoardId.trim() : "";
  if (!boardId) {
    return {
      success: false,
      error: "ID Nástěnky je povinné.",
    };
  }

  const db = getDb();
  const taskRepo = new DrizzleTaskRepository(db);
  const existingTask = await taskRepo.findById(parsed.data.taskId);

  if (!existingTask) {
    return {
      success: false,
      error: "Úkol nebyl nalezen.",
    };
  }

  if (existingTask.boardId !== boardId) {
    return {
      success: false,
      error: "Úkol nepatří do zadané Nástěnky.",
    };
  }

  const uow = new DrizzleUnitOfWork(db);
  const useCase = new DeleteTaskUseCase(uow);

  const result = await useCase.execute(actor, {
    taskId: parsed.data.taskId,
    confirmation: parsed.data.confirmation,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error.message,
    };
  }

  revalidatePath(`/app/board/${boardId}`);
  return {
    success: true,
    taskId: parsed.data.taskId,
  };
}

/**
 * Server Action pro změnu osobního pořadí úkolů (ReorderTask).
 *
 * Invarianty (STEP 6 – Personal Ordering):
 * 1. ActorContext je získáván výhradně ze serverové session (nikdy z parametrů klienta).
 * 2. Vstup je autoritativně validován pomocí Zod schématu (reorderTaskSchema).
 * 3. Změna ovlivní výhradně profil přihlášeného uživatele (žádný cross-user dopad).
 * 4. Use Case ověřuje oprávnění přes TaskPolicy (TASK_REORDER).
 * 5. Provádí cross-board kontrolu (taskId musí patřit do boardId).
 * 6. Po úspěchu revaliduje cestu /app/board/[boardId].
 */
export async function reorderTaskAction(
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
  const rawTaskId = formData.get("taskId");
  const rawDirection = formData.get("direction");
  const rawTargetTaskId = formData.get("targetTaskId");
  const rawPosition = formData.get("position");

  const parsed = reorderTaskSchema.safeParse({
    boardId: typeof rawBoardId === "string" ? rawBoardId : "",
    taskId: typeof rawTaskId === "string" ? rawTaskId : "",
    direction:
      rawDirection === "UP" || rawDirection === "DOWN"
        ? rawDirection
        : undefined,
    targetTaskId:
      typeof rawTargetTaskId === "string" && rawTargetTaskId.trim() !== ""
        ? rawTargetTaskId.trim()
        : undefined,
    position:
      rawPosition === "BEFORE" || rawPosition === "AFTER"
        ? rawPosition
        : undefined,
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatný vstup požadavku.",
    };
  }

  const db = getDb();
  const uow = new DrizzleUnitOfWork(db);
  const useCase = new ReorderTaskUseCase(uow);

  const result = await useCase.execute(actor, {
    boardId: parsed.data.boardId,
    taskId: parsed.data.taskId,
    direction: parsed.data.direction,
    targetTaskId: parsed.data.targetTaskId,
    position: parsed.data.position,
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
    taskId: parsed.data.taskId,
  };
}

