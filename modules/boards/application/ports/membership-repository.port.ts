/**
 * Port (rozhraní) repozitáře pro entitu Membership (Členství v Nástěnce).
 *
 * Invarianty (ADR-009):
 * 1. Žádný import z Drizzle, Next.js ani externí infrastruktury.
 * 2. Čisté TypeScript rozhraní pro manipulaci s persistenční vrstvou.
 */

export type BoardRole = "OWNER" | "MANAGER" | "MEMBER";

export interface MembershipRecord {
  readonly id: string;
  readonly userId: string;
  readonly boardId: string;
  readonly role: BoardRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateMembershipData {
  readonly id?: string;
  readonly userId: string;
  readonly boardId: string;
  readonly role: BoardRole;
}

export interface MembershipRepository {
  findByBoardAndUser(
    boardId: string,
    userId: string,
  ): Promise<MembershipRecord | null>;
  findMembershipsByBoard(boardId: string): Promise<MembershipRecord[]>;
  create(data: CreateMembershipData): Promise<MembershipRecord>;
  updateRole(
    boardId: string,
    userId: string,
    newRole: BoardRole,
  ): Promise<void>;
}
