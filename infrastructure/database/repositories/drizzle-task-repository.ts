import { eq } from "drizzle-orm";
import { tasks } from "../../../database/schema/index.ts";
import type { Database } from "../client.ts";
import type {
  CreateTaskData,
  TaskRecord,
  TaskRepository,
  UpdateTaskData,
} from "../../../modules/tasks/application/ports/task-repository.port.ts";

export class DrizzleTaskRepository implements TaskRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findById(id: string): Promise<TaskRecord | null> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      boardId: row.boardId,
      areaId: row.areaId,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueDate: row.dueDate,
      createdBy: row.createdBy,
      assigneeId: row.assigneeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
    };
  }

  async findByIdForUpdate(id: string): Promise<TaskRecord | null> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id))
      .for("update")
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      boardId: row.boardId,
      areaId: row.areaId,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueDate: row.dueDate,
      createdBy: row.createdBy,
      assigneeId: row.assigneeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
    };
  }

  async findByBoardId(boardId: string): Promise<TaskRecord[]> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.boardId, boardId));

    return rows.map((row) => ({
      id: row.id,
      boardId: row.boardId,
      areaId: row.areaId,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueDate: row.dueDate,
      createdBy: row.createdBy,
      assigneeId: row.assigneeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
    }));
  }

  async findByAreaId(areaId: string): Promise<TaskRecord[]> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.areaId, areaId));

    return rows.map((row) => ({
      id: row.id,
      boardId: row.boardId,
      areaId: row.areaId,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueDate: row.dueDate,
      createdBy: row.createdBy,
      assigneeId: row.assigneeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
    }));
  }

  async create(data: CreateTaskData): Promise<TaskRecord> {
    const [row] = await this.db
      .insert(tasks)
      .values({
        id: data.id,
        boardId: data.boardId,
        areaId: data.areaId ?? null,
        title: data.title,
        description: data.description ?? null,
        status: data.status ?? "NOVÉ",
        priority: data.priority ?? "BĚŽNÁ",
        dueDate: data.dueDate ?? null,
        createdBy: data.createdBy,
        assigneeId: data.assigneeId ?? null,
      })
      .returning();

    return {
      id: row.id,
      boardId: row.boardId,
      areaId: row.areaId,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueDate: row.dueDate,
      createdBy: row.createdBy,
      assigneeId: row.assigneeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
    };
  }

  async update(id: string, data: UpdateTaskData): Promise<TaskRecord> {
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateValues.title = data.title;
    if (data.description !== undefined)
      updateValues.description = data.description;
    if (data.status !== undefined) updateValues.status = data.status;
    if (data.priority !== undefined) updateValues.priority = data.priority;
    if (data.dueDate !== undefined) updateValues.dueDate = data.dueDate;
    if (data.assigneeId !== undefined)
      updateValues.assigneeId = data.assigneeId;
    if (data.areaId !== undefined) updateValues.areaId = data.areaId;
    if (data.completedAt !== undefined)
      updateValues.completedAt = data.completedAt;

    const [row] = await this.db
      .update(tasks)
      .set(updateValues)
      .where(eq(tasks.id, id))
      .returning();

    return {
      id: row.id,
      boardId: row.boardId,
      areaId: row.areaId,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      dueDate: row.dueDate,
      createdBy: row.createdBy,
      assigneeId: row.assigneeId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      completedAt: row.completedAt,
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(tasks).where(eq(tasks.id, id));
  }
}
