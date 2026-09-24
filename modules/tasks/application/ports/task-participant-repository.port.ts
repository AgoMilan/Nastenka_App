/**
 * Port (rozhraní) pro repozitář spoluřešitelů úkolů (TaskParticipantRepository).
 *
 * Invarianty (ADR-009):
 * 1. Žádný přímý import Drizzle ani konkrétní databáze do aplikační vrstvy.
 * 2. Spoluřešitelé jsou vázáni k úkolu (ON DELETE CASCADE).
 */

export interface TaskParticipantRecord {
  readonly id: string;
  readonly taskId: string;
  readonly userId: string;
  readonly role: string;
  readonly createdAt: Date;
}

export interface TaskParticipantRepository {
  findByTaskId(taskId: string): Promise<TaskParticipantRecord[]>;
  findByTaskAndUser(
    taskId: string,
    userId: string,
  ): Promise<TaskParticipantRecord | null>;
  addParticipant(
    taskId: string,
    userId: string,
    role?: string,
  ): Promise<TaskParticipantRecord>;
  removeParticipant(taskId: string, userId: string): Promise<void>;
  removeAllForTask(taskId: string): Promise<void>;
}
