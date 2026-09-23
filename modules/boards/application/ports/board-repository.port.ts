/**
 * Port (rozhraní) repozitáře pro entitu Board (Nástěnka).
 *
 * Invarianty (ADR-009):
 * 1. Žádný import z Drizzle, Next.js ani externí infrastruktury.
 * 2. Čisté TypeScript rozhraní pro manipulaci s persistenční vrstvou.
 */

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

export interface BoardRepository {
  findById(boardId: string): Promise<BoardRecord | null>;
  findByIdForUpdate(boardId: string): Promise<BoardRecord | null>;
  create(data: CreateBoardData): Promise<BoardRecord>;
  softDelete(boardId: string, deletedAt: Date): Promise<void>;
}
