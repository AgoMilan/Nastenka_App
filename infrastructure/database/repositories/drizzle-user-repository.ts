import { eq } from "drizzle-orm";
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
}
