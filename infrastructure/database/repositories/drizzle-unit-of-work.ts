import type { Database } from "../client.ts";
import type {
  UnitOfWork,
  UnitOfWorkRepositories,
} from "../../../modules/boards/application/ports/unit-of-work.port.ts";
import { DrizzleBoardRepository } from "./drizzle-board-repository.ts";
import { DrizzleMembershipRepository } from "./drizzle-membership-repository.ts";
import { DrizzleUserRepository } from "./drizzle-user-repository.ts";
import { DrizzleAreaRepository } from "./drizzle-area-repository.ts";
import { DrizzleTaskRepository } from "./drizzle-task-repository.ts";
import { DrizzleTaskParticipantRepository } from "./drizzle-task-participant-repository.ts";

export class DrizzleUnitOfWork implements UnitOfWork {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async runInTransaction<T>(
    work: (repos: UnitOfWorkRepositories) => Promise<T>,
  ): Promise<T> {
    return await this.db.transaction(async (tx) => {
      const txDb = tx as unknown as Database;
      const repos: UnitOfWorkRepositories = {
        boards: new DrizzleBoardRepository(txDb),
        memberships: new DrizzleMembershipRepository(txDb),
        users: new DrizzleUserRepository(txDb),
        areas: new DrizzleAreaRepository(txDb),
        tasks: new DrizzleTaskRepository(txDb),
        taskParticipants: new DrizzleTaskParticipantRepository(txDb),
      };
      return await work(repos);
    });
  }
}
