/**
 * Port (rozhraní) pro repozitář oblastí (AreaRepository).
 *
 * Invarianty (ADR-009):
 * 1. Žádný přímý import Drizzle ani konkrétní databáze.
 * 2. Vrstva aplikací závisí výhradně na tomto rozhraní.
 */

export interface AreaRecord {
  readonly id: string;
  readonly boardId: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateAreaData {
  readonly id?: string;
  readonly boardId: string;
  readonly name: string;
  readonly description?: string | null;
}

export interface UpdateAreaData {
  readonly name?: string;
  readonly description?: string | null;
}

export interface AreaRepository {
  findById(id: string): Promise<AreaRecord | null>;
  findByIdForUpdate?(id: string): Promise<AreaRecord | null>;
  findByBoardAndName(boardId: string, name: string): Promise<AreaRecord | null>;
  findByBoardId(boardId: string): Promise<AreaRecord[]>;
  create(data: CreateAreaData): Promise<AreaRecord>;
  update(id: string, data: UpdateAreaData): Promise<AreaRecord>;
  delete(id: string): Promise<void>;
}
