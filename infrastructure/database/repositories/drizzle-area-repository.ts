import { and, eq } from "drizzle-orm";
import { areas } from "../../../database/schema/index.ts";
import type { Database } from "../client.ts";
import type {
  AreaRecord,
  AreaRepository,
  CreateAreaData,
  UpdateAreaData,
} from "../../../modules/areas/application/ports/area-repository.port.ts";

export class DrizzleAreaRepository implements AreaRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findById(id: string): Promise<AreaRecord | null> {
    const rows = await this.db
      .select()
      .from(areas)
      .where(eq(areas.id, id))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      boardId: row.boardId,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByIdForUpdate(id: string): Promise<AreaRecord | null> {
    const rows = await this.db
      .select()
      .from(areas)
      .where(eq(areas.id, id))
      .for("update")
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      boardId: row.boardId,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByBoardAndName(
    boardId: string,
    name: string,
  ): Promise<AreaRecord | null> {
    const rows = await this.db
      .select()
      .from(areas)
      .where(and(eq(areas.boardId, boardId), eq(areas.name, name)))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      boardId: row.boardId,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findByBoardId(boardId: string): Promise<AreaRecord[]> {
    const rows = await this.db
      .select()
      .from(areas)
      .where(eq(areas.boardId, boardId));

    return rows.map((row) => ({
      id: row.id,
      boardId: row.boardId,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async create(data: CreateAreaData): Promise<AreaRecord> {
    const [row] = await this.db
      .insert(areas)
      .values({
        id: data.id,
        boardId: data.boardId,
        name: data.name,
        description: data.description ?? null,
      })
      .returning();

    return {
      id: row.id,
      boardId: row.boardId,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async update(id: string, data: UpdateAreaData): Promise<AreaRecord> {
    const [row] = await this.db
      .update(areas)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(areas.id, id))
      .returning();

    return {
      id: row.id,
      boardId: row.boardId,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(areas).where(eq(areas.id, id));
  }
}
