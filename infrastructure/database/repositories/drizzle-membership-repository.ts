import { and, eq } from "drizzle-orm";
import { memberships } from "../../../database/schema/index.ts";
import type { Database } from "../client.ts";
import type {
  BoardRole,
  CreateMembershipData,
  MembershipRecord,
  MembershipRepository,
} from "../../../modules/boards/application/ports/membership-repository.port.ts";

export class DrizzleMembershipRepository implements MembershipRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findByBoardAndUser(
    boardId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    const rows = await this.db
      .select()
      .from(memberships)
      .where(
        and(eq(memberships.boardId, boardId), eq(memberships.userId, userId)),
      )
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      userId: row.userId,
      boardId: row.boardId,
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findMembershipsByBoard(boardId: string): Promise<MembershipRecord[]> {
    const rows = await this.db
      .select()
      .from(memberships)
      .where(eq(memberships.boardId, boardId));

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      boardId: row.boardId,
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async create(data: CreateMembershipData): Promise<MembershipRecord> {
    const rows = await this.db
      .insert(memberships)
      .values({
        ...(data.id ? { id: data.id } : {}),
        userId: data.userId,
        boardId: data.boardId,
        role: data.role,
      })
      .returning();

    const row = rows[0];
    return {
      id: row.id,
      userId: row.userId,
      boardId: row.boardId,
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async updateRole(
    boardId: string,
    userId: string,
    newRole: BoardRole,
  ): Promise<void> {
    await this.db
      .update(memberships)
      .set({
        role: newRole,
        updatedAt: new Date(),
      })
      .where(
        and(eq(memberships.boardId, boardId), eq(memberships.userId, userId)),
      );
  }

  async delete(boardId: string, userId: string): Promise<void> {
    await this.db
      .delete(memberships)
      .where(
        and(eq(memberships.boardId, boardId), eq(memberships.userId, userId)),
      );
  }
}
