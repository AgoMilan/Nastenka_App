/**
 * Port (rozhraní) repozitáře pro entitu User (ověření existence a aktivity cílového uživatele).
 *
 * Invarianty (ADR-009):
 * 1. Žádný import z Drizzle, Next.js ani externí infrastruktury.
 * 2. Čisté TypeScript rozhraní pro ověření stavu uživatele.
 */

export interface UserRecord {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly globalRole: "USER" | "ADMIN";
  readonly isActive: boolean;
  readonly deletedAt: Date | null;
}

export interface UserRepository {
  findById(userId: string): Promise<UserRecord | null>;
}
