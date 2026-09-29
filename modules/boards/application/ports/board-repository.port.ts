/**
 * Port (rozhraní) repozitáře pro entitu Board (Nástěnka).
 *
 * Invarianty (ADR-009):
 * 1. Žádný import z Drizzle, Next.js ani externí infrastruktury.
 * 2. Čisté TypeScript rozhraní pro manipulaci s persistenční vrstvou.
 */

import type { BoardRole } from "./membership-repository.port.ts";

export interface BoardRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface CreateBoardData {
  readonly id?: string;
  readonly name: string;
  readonly description?: string | null;
  readonly createdBy: string;
}

/**
 * Záznam Nástěnky pro uživatelský přehled (Board Directory / Switcher).
 * Obsahuje roli uživatele na dané Nástěnce (nebo null pokud je ADMIN bez členství).
 */
export interface UserBoardRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly role: BoardRole | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface BoardRepository {
  findById(boardId: string): Promise<BoardRecord | null>;
  findByIdForUpdate(boardId: string): Promise<BoardRecord | null>;
  create(data: CreateBoardData): Promise<BoardRecord>;
  softDelete(boardId: string, deletedAt: Date): Promise<void>;
  findActiveBoardsForUser(userId: string): Promise<UserBoardRecord[]>;
  findActiveBoardsForAdmin(adminUserId: string): Promise<UserBoardRecord[]>;
}
