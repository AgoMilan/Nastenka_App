import { and, eq, inArray } from "drizzle-orm";
import { userTaskNotes } from "../../../database/schema/index.ts";
import type { Database } from "../client.ts";
import type {
  UpsertUserTaskNoteData,
  UserTaskNoteRecord,
  UserTaskNoteRepository,
} from "../../../modules/tasks/application/ports/user-task-note-repository.port.ts";

export class DrizzleUserTaskNoteRepository implements UserTaskNoteRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findById(id: string): Promise<UserTaskNoteRecord | null> {
    const rows = await this.db
      .select()
      .from(userTaskNotes)
      .where(eq(userTaskNotes.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapToRecord(rows[0]);
  }

  async findByUserAndTask(
    userId: string,
    taskId: string,
  ): Promise<UserTaskNoteRecord | null> {
    const rows = await this.db
      .select()
      .from(userTaskNotes)
      .where(
        and(
          eq(userTaskNotes.userId, userId),
          eq(userTaskNotes.taskId, taskId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    return this.mapToRecord(rows[0]);
  }

  async findByUserAndTaskIds(
    userId: string,
    taskIds: string[],
  ): Promise<Map<string, UserTaskNoteRecord>> {
    const map = new Map<string, UserTaskNoteRecord>();
    if (taskIds.length === 0) {
      return map;
    }

    const rows = await this.db
      .select()
      .from(userTaskNotes)
      .where(
        and(
          eq(userTaskNotes.userId, userId),
          inArray(userTaskNotes.taskId, taskIds),
        ),
      );

    for (const row of rows) {
      map.set(row.taskId, this.mapToRecord(row));
    }

    return map;
  }

  async upsert(data: UpsertUserTaskNoteData): Promise<UserTaskNoteRecord> {
    const now = new Date();
    const rows = await this.db
      .insert(userTaskNotes)
      .values({
        userId: data.userId,
        taskId: data.taskId,
        content: data.content,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userTaskNotes.userId, userTaskNotes.taskId],
        set: {
          content: data.content,
          updatedAt: now,
        },
      })
      .returning();

    return this.mapToRecord(rows[0]);
  }

  async delete(userId: string, taskId: string): Promise<void> {
    await this.db
      .delete(userTaskNotes)
      .where(
        and(
          eq(userTaskNotes.userId, userId),
          eq(userTaskNotes.taskId, taskId),
        ),
      );
  }

  async deleteAllForTask(taskId: string): Promise<void> {
    await this.db
      .delete(userTaskNotes)
      .where(eq(userTaskNotes.taskId, taskId));
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.db
      .delete(userTaskNotes)
      .where(eq(userTaskNotes.userId, userId));
  }

  private mapToRecord(
    row: typeof userTaskNotes.$inferSelect,
  ): UserTaskNoteRecord {
    return {
      id: row.id,
      userId: row.userId,
      taskId: row.taskId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
