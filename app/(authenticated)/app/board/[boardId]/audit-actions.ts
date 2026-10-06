"use server";

import { headers } from "next/headers";
import { resolveActorContext } from "@/infrastructure/auth/index.ts";
import { getDb } from "@/infrastructure/database/index.ts";
import {
  DrizzleBoardRepository,
  DrizzleMembershipRepository,
  DrizzleTaskRepository,
  DrizzleTaskParticipantRepository,
  DrizzleAuditLogRepository,
  DrizzleUserRepository,
} from "@/infrastructure/database/repositories/index.ts";
import {
  GetTaskAuditHistoryUseCase,
  GetBoardAuditHistoryUseCase,
  type AuditLogView,
} from "@/modules/audit/index.ts";
import {
  getTaskAuditHistorySchema,
  getBoardAuditHistorySchema,
} from "@/modules/audit/api/dto/audit-query.dto.ts";

export interface AuditActionResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
}

/**
 * Server Action: Získání auditní historie konkrétního úkolu.
 */
export async function getTaskAuditHistoryAction(
  boardId: string,
  taskId: string,
): Promise<AuditActionResult<AuditLogView[]>> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const parsed = getTaskAuditHistorySchema.safeParse({ boardId, taskId });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatná vstupní data.",
    };
  }

  const db = getDb();
  const boardRepo = new DrizzleBoardRepository(db);
  const membershipRepo = new DrizzleMembershipRepository(db);
  const taskRepo = new DrizzleTaskRepository(db);
  const auditLogRepo = new DrizzleAuditLogRepository(db);
  const userRepo = new DrizzleUserRepository(db);
  const taskParticipantRepo = new DrizzleTaskParticipantRepository(db);

  const useCase = new GetTaskAuditHistoryUseCase(
    boardRepo,
    membershipRepo,
    taskRepo,
    auditLogRepo,
    userRepo,
    taskParticipantRepo,
  );

  const result = await useCase.execute(actor, parsed.data);
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
 * Server Action: Získání auditní historie celé nástěnky.
 */
export async function getBoardAuditHistoryAction(
  boardId: string,
): Promise<AuditActionResult<AuditLogView[]>> {
  const headersList = await headers();
  const actor = await resolveActorContext(headersList);

  if (!actor || !actor.is_active) {
    return {
      success: false,
      error: "Uživatel není přihlášen nebo je účet neaktivní.",
    };
  }

  const parsed = getBoardAuditHistorySchema.safeParse({ boardId });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Neplatná vstupní data.",
    };
  }

  const db = getDb();
  const boardRepo = new DrizzleBoardRepository(db);
  const membershipRepo = new DrizzleMembershipRepository(db);
  const auditLogRepo = new DrizzleAuditLogRepository(db);
  const userRepo = new DrizzleUserRepository(db);

  const useCase = new GetBoardAuditHistoryUseCase(
    boardRepo,
    membershipRepo,
    auditLogRepo,
    userRepo,
  );

  const result = await useCase.execute(actor, parsed.data);
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
