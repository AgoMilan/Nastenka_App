/**
 * Port (rozhraní) pro repozitář úkolů (TaskRepository).
 *
 * Invarianty (ADR-009):
 * 1. Žádný přímý import Drizzle ani konkrétní databáze do aplikační vrstvy.
 * 2. Poskytuje čisté doménové operace nad úkoly.
 */

export type TaskStatus =
  "NOVÉ" | "PŘEVZATÉ" | "ROZPRACOVANÉ" | "ČEKÁ SE" | "HOTOVO" | "ARCHIVOVÁNO";

export type TaskPriority = "BĚŽNÁ" | "SPĚCHÁ";

export interface TaskRecord {
  readonly id: string;
  readonly boardId: string;
  readonly areaId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly dueDate: Date | null;
  readonly createdBy: string;
  readonly assigneeId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
}

export interface CreateTaskData {
  readonly id?: string;
  readonly boardId: string;
  readonly areaId?: string | null;
  readonly title: string;
  readonly description?: string | null;
  readonly status?: TaskStatus;
  readonly priority?: TaskPriority;
  readonly dueDate?: Date | null;
  readonly createdBy: string;
  readonly assigneeId?: string | null;
}

export interface UpdateTaskData {
  readonly title?: string;
  readonly description?: string | null;
  readonly status?: TaskStatus;
  readonly priority?: TaskPriority;
  readonly dueDate?: Date | null;
  readonly assigneeId?: string | null;
  readonly areaId?: string | null;
  readonly completedAt?: Date | null;
}

export interface TaskRepository {
  findById(id: string): Promise<TaskRecord | null>;
  findByIdForUpdate(id: string): Promise<TaskRecord | null>;
  findByBoardId(boardId: string): Promise<TaskRecord[]>;
  findByAreaId(areaId: string): Promise<TaskRecord[]>;
  create(data: CreateTaskData): Promise<TaskRecord>;
  update(id: string, data: UpdateTaskData): Promise<TaskRecord>;
  delete(id: string): Promise<void>;
}
