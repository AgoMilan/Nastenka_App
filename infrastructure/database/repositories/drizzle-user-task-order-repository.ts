import { and, eq } from "drizzle-orm";
import { userTaskOrders } from "../../../database/schema/index.ts";
import type { Database } from "../client.ts";
import type {
  UpsertUserTaskOrderData,
  UserTaskOrderRecord,
  UserTaskOrderRepository,
} from "../../../modules/tasks/application/ports/user-task-order-repository.port.ts";

export class DrizzleUserTaskOrderRepository implements UserTaskOrderRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findByBoardAndUser(
    boardId: string,
    userId: string,
  ): Promise<UserTaskOrderRecord[]> {
    const rows = await this.db
      .select()
      .from(userTaskOrders)
      .where(
        and(
          eq(userTaskOrders.boardId, boardId),
          eq(userTaskOrders.userId, userId),
        ),
      );

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      taskId: row.taskId,
      boardId: row.boardId,
      position: row.position,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async findByTaskId(taskId: string): Promise<UserTaskOrderRecord[]> {
    const rows = await this.db
      .select()
      .from(userTaskOrders)
      .where(eq(userTaskOrders.taskId, taskId));

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      taskId: row.taskId,
      boardId: row.boardId,
      position: row.position,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async upsertOrder(data: UpsertUserTaskOrderData): Promise<void> {
    await this.db
      .insert(userTaskOrders)
      .values({
        userId: data.userId,
        taskId: data.taskId,
        boardId: data.boardId,
        position: data.position,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [userTaskOrders.userId, userTaskOrders.taskId],
        set: {
          position: data.position,
          boardId: data.boardId,
          updatedAt: new Date(),
        },
      });
  }

  async upsertOrders(orders: UpsertUserTaskOrderData[]): Promise<void> {
    if (orders.length === 0) {
      return;
    }

    for (const order of orders) {
      await this.upsertOrder(order);
    }
  }

  async deleteByBoardAndUser(boardId: string, userId: string): Promise<void> {
    await this.db
      .delete(userTaskOrders)
      .where(
        and(
          eq(userTaskOrders.boardId, boardId),
          eq(userTaskOrders.userId, userId),
        ),
      );
  }

  async deleteByTaskId(taskId: string): Promise<void> {
    await this.db
      .delete(userTaskOrders)
      .where(eq(userTaskOrders.taskId, taskId));
  }
}
