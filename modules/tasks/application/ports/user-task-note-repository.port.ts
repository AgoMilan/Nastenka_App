/**
 * Port (rozhraní) pro repozitář soukromých poznámek uživatele k úkolu (UserTaskNoteRepository).
 *
 * Invarianty (Osobní poznámky, ADR-009):
 * 1. Žádný přímý import Drizzle ani konkrétní databáze do aplikační vrstvy.
 * 2. Poznámky jsou striktně soukromé pro daného uživatele (userId) a úkol (taskId).
 * 3. Každý uživatel má nejvýše jednu aktivní poznámku k úkolu: UNIQUE(userId, taskId).
 * 4. Kaskádové mazání při smazání úkolu nebo uživatele.
 */

export interface UserTaskNoteRecord {
  readonly id: string;
  readonly userId: string;
  readonly taskId: string;
  readonly content: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertUserTaskNoteData {
  readonly userId: string;
  readonly taskId: string;
  readonly content: string;
}

export interface UserTaskNoteRepository {
  findById(id: string): Promise<UserTaskNoteRecord | null>;
  findByUserAndTask(
    userId: string,
    taskId: string,
  ): Promise<UserTaskNoteRecord | null>;
  findByUserAndTaskIds(
    userId: string,
    taskIds: string[],
  ): Promise<Map<string, UserTaskNoteRecord>>;
  upsert(data: UpsertUserTaskNoteData): Promise<UserTaskNoteRecord>;
  delete(userId: string, taskId: string): Promise<void>;
  deleteAllForTask(taskId: string): Promise<void>;
  deleteAllForUser(userId: string): Promise<void>;
}
