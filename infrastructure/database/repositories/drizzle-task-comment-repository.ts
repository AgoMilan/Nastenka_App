import { asc, count, eq, inArray } from "drizzle-orm";
import { taskComments } from "../../../database/schema/index.ts";
import type { Database } from "../client.ts";
import type {
  CreateTaskCommentData,
  TaskCommentRecord,
  TaskCommentRepository,
  UpdateTaskCommentData,
} from "../../../modules/tasks/application/ports/task-comment-repository.port.ts";

export class DrizzleTaskCommentRepository implements TaskCommentRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findById(id: string): Promise<TaskCommentRecord | null> {
    const rows = await this.db
      .select()
      .from(taskComments)
      .where(eq(taskComments.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapToRecord(rows[0]);
  }

  async findByTaskId(taskId: string): Promise<TaskCommentRecord[]> {
    const rows = await this.db
      .select()
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.createdAt), asc(taskComments.id));

    return rows.map((row) => this.mapToRecord(row));
  }

  async countByTaskId(taskId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId));

    return Number(result[0]?.count ?? 0);
  }

  async countByTaskIds(taskIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (taskIds.length === 0) {
      return map;
    }

    const rows = await this.db
      .select({
        taskId: taskComments.taskId,
        count: count(),
      })
      .from(taskComments)
      .where(inArray(taskComments.taskId, taskIds))
      .groupBy(taskComments.taskId);

    for (const row of rows) {
      map.set(row.taskId, Number(row.count));
    }

    return map;
  }

  async create(data: CreateTaskCommentData): Promise<TaskCommentRecord> {
    const rows = await this.db
      .insert(taskComments)
      .values({
        taskId: data.taskId,
        authorId: data.authorId,
        content: data.content,
      })
      .returning();

    return this.mapToRecord(rows[0]);
  }

  async update(
    id: string,
    data: UpdateTaskCommentData,
  ): Promise<TaskCommentRecord> {
    const rows = await this.db
      .update(taskComments)
      .set({
        content: data.content,
        updatedAt: new Date(),
      })
      .where(eq(taskComments.id, id))
      .returning();

    if (rows.length === 0) {
      throw new Error(`Comment with ID ${id} not found for update`);
    }

    return this.mapToRecord(rows[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(taskComments).where(eq(taskComments.id, id));
  }

  async deleteAllForTask(taskId: string): Promise<void> {
    await this.db.delete(taskComments).where(eq(taskComments.taskId, taskId));
  }

  private mapToRecord(
    row: typeof taskComments.$inferSelect,
  ): TaskCommentRecord {
    return {
      id: row.id,
      taskId: row.taskId,
      authorId: row.authorId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
