/**
 * Port (rozhraní) pro transakční jednotku práce (Unit of Work).
 *
 * Umožňuje spustit blok operací uvnitř atomické transakce.
 * Pokud je vyhozena výjimka nebo operace selže, transakce se automaticky vrátí (ROLLBACK).
 *
 * Invarianty (ADR-009):
 * 1. Žádný přímý import Drizzle ani konkrétní databáze do aplikační vrstvy.
 * 2. Poskytuje přístup k transakčním verzím repozitářů.
 */

import type { BoardRepository } from "./board-repository.port.ts";
import type { MembershipRepository } from "./membership-repository.port.ts";
import type { UserRepository } from "./user-repository.port.ts";
import type { AreaRepository } from "../../../areas/application/ports/area-repository.port.ts";
import type {
  TaskRepository,
  TaskParticipantRepository,
  UserTaskOrderRepository,
  TaskCommentRepository,
  UserTaskNoteRepository,
} from "../../../tasks/application/ports/index.ts";
import type { AuditLogRepository } from "../../../audit/application/ports/audit-log-repository.port.ts";

export interface UnitOfWorkRepositories {
  readonly boards: BoardRepository;
  readonly memberships: MembershipRepository;
  readonly users: UserRepository;
  readonly areas?: AreaRepository;
  readonly tasks?: TaskRepository;
  readonly taskParticipants?: TaskParticipantRepository;
  readonly userTaskOrders?: UserTaskOrderRepository;
  readonly taskComments?: TaskCommentRepository;
  readonly userTaskNotes?: UserTaskNoteRepository;
  readonly auditLogs?: AuditLogRepository;
}

export interface UnitOfWork {
  runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T>;
}
