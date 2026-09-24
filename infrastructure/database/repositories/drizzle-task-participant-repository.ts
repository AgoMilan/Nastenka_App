import { and, eq } from "drizzle-orm";
import { taskParticipants } from "../../../database/schema/index.ts";
import type { Database } from "../client.ts";
import type {
  TaskParticipantRecord,
  TaskParticipantRepository,
} from "../../../modules/tasks/application/ports/task-participant-repository.port.ts";

export class DrizzleTaskParticipantRepository implements TaskParticipantRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findByTaskId(taskId: string): Promise<TaskParticipantRecord[]> {
    const rows = await this.db
      .select()
      .from(taskParticipants)
      .where(eq(taskParticipants.taskId, taskId));

    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      userId: row.userId,
      role: row.role,
      createdAt: row.createdAt,
    }));
  }

  async findByTaskAndUser(
    taskId: string,
    userId: string,
  ): Promise<TaskParticipantRecord | null> {
    const rows = await this.db
      .select()
      .from(taskParticipants)
      .where(
        and(
          eq(taskParticipants.taskId, taskId),
          eq(taskParticipants.userId, userId),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      taskId: row.taskId,
      userId: row.userId,
      role: row.role,
      createdAt: row.createdAt,
    };
  }

  async addParticipant(
    taskId: string,
    userId: string,
    role: string = "SPOLUŘEŠITEL",
  ): Promise<TaskParticipantRecord> {
    const [row] = await this.db
      .insert(taskParticipants)
      .values({
        taskId,
        userId,
        role,
      })
      .returning();

    return {
      id: row.id,
      taskId: row.taskId,
      userId: row.userId,
      role: row.role,
      createdAt: row.createdAt,
    };
  }

  async removeParticipant(taskId: string, userId: string): Promise<void> {
    await this.db
      .delete(taskParticipants)
      .where(
        and(
          eq(taskParticipants.taskId, taskId),
          eq(taskParticipants.userId, userId),
        ),
      );
  }

  async removeAllForTask(taskId: string): Promise<void> {
    await this.db
      .delete(taskParticipants)
      .where(eq(taskParticipants.taskId, taskId));
  }
}
