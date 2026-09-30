/**
 * Port (rozhraní) pro repozitář komentářů úkolu (TaskCommentRepository).
 *
 * Invarianty (STEP 8, ADR-009):
 * 1. Žádný přímý import Drizzle ani konkrétní databáze do aplikační vrstvy.
 * 2. Komentáře jsou vázány k úkolu (ON DELETE CASCADE) a autorovi (ON DELETE RESTRICT).
 * 3. Výpis komentářů pro úkol je deterministicky řazen chronologicky (createdAt ASC, id ASC).
 */

export interface TaskCommentRecord {
  readonly id: string;
  readonly taskId: string;
  readonly authorId: string;
  readonly content: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateTaskCommentData {
  readonly taskId: string;
  readonly authorId: string;
  readonly content: string;
}

export interface UpdateTaskCommentData {
  readonly content: string;
}

export interface TaskCommentRepository {
  findById(id: string): Promise<TaskCommentRecord | null>;
  findByTaskId(taskId: string): Promise<TaskCommentRecord[]>;
  countByTaskId(taskId: string): Promise<number>;
  countByTaskIds(taskIds: string[]): Promise<Map<string, number>>;
  create(data: CreateTaskCommentData): Promise<TaskCommentRecord>;
  update(id: string, data: UpdateTaskCommentData): Promise<TaskCommentRecord>;
  delete(id: string): Promise<void>;
  deleteAllForTask(taskId: string): Promise<void>;
}
