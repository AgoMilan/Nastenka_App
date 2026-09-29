import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { users } from "../../../database/schema/index.ts";
import type { Database } from "../client.ts";
import type {
  UserRecord,
  UserRepository,
} from "../../../modules/boards/application/ports/user-repository.port.ts";

export class DrizzleUserRepository implements UserRepository {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async findById(userId: string): Promise<UserRecord | null> {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        globalRole: users.globalRole,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      globalRole: row.globalRole,
      isActive: row.isActive,
      deletedAt: row.deletedAt,
    };
  }

  async findByIds(userIds: string[]): Promise<UserRecord[]> {
    if (userIds.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        globalRole: users.globalRole,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(inArray(users.id, userIds));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      globalRole: row.globalRole,
      isActive: row.isActive,
      deletedAt: row.deletedAt,
    }));
  }

  async findActiveUsers(): Promise<UserRecord[]> {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        globalRole: users.globalRole,
        isActive: users.isActive,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(and(eq(users.isActive, true), isNull(users.deletedAt)))
      .orderBy(asc(users.name));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      globalRole: row.globalRole,
      isActive: row.isActive,
      deletedAt: row.deletedAt,
    }));
  }
}
