import { and, asc, eq, isNull } from "drizzle-orm";
import { boards, memberships } from "../../../database/schema/index.ts";
import type { Database } from "../client.ts";
import type {
  BoardRecord,
  BoardRepository,
  CreateBoardData,
  UpdateBoardData,
  UserBoardRecord,
} from "../../../modules/boards/application/ports/board-repository.port.ts";

export class DrizzleBoardRepository implements BoardRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findById(boardId: string): Promise<BoardRecord | null> {
    const rows = await this.db
      .select()
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  async findByIdForUpdate(boardId: string): Promise<BoardRecord | null> {
    const rows = await this.db
      .select()
      .from(boards)
      .where(eq(boards.id, boardId))
      .for("update")
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  async create(data: CreateBoardData): Promise<BoardRecord> {
    const rows = await this.db
      .insert(boards)
      .values({
        ...(data.id ? { id: data.id } : {}),
        name: data.name,
        description: data.description ?? null,
        createdBy: data.createdBy,
      })
      .returning();

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  async update(boardId: string, data: UpdateBoardData): Promise<BoardRecord> {
    const rows = await this.db
      .update(boards)
      .set({
        name: data.name,
        description: data.description !== undefined ? data.description : null,
        updatedAt: new Date(),
      })
      .where(eq(boards.id, boardId))
      .returning();

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
    };
  }

  async softDelete(boardId: string, deletedAt: Date): Promise<void> {
    await this.db
      .update(boards)
      .set({
        deletedAt,
        updatedAt: new Date(),
      })
      .where(eq(boards.id, boardId));
  }

  async findActiveBoardsForUser(userId: string): Promise<UserBoardRecord[]> {
    const rows = await this.db
      .select({
        id: boards.id,
        name: boards.name,
        description: boards.description,
        role: memberships.role,
        createdAt: boards.createdAt,
        updatedAt: boards.updatedAt,
      })
      .from(boards)
      .innerJoin(
        memberships,
        and(
          eq(memberships.boardId, boards.id),
          eq(memberships.userId, userId),
        ),
      )
      .where(isNull(boards.deletedAt))
      .orderBy(asc(boards.name));

    return rows;
  }

  async findActiveBoardsForAdmin(adminUserId: string): Promise<UserBoardRecord[]> {
    const rows = await this.db
      .select({
        id: boards.id,
        name: boards.name,
        description: boards.description,
        role: memberships.role,
        createdAt: boards.createdAt,
        updatedAt: boards.updatedAt,
      })
      .from(boards)
      .leftJoin(
        memberships,
        and(
          eq(memberships.boardId, boards.id),
          eq(memberships.userId, adminUserId),
        ),
      )
      .where(isNull(boards.deletedAt))
      .orderBy(asc(boards.name));

    return rows;
  }
}
