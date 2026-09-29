import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import { checkBoardPermission } from "../policies/board-policy.ts";
import type {
  BoardRepository,
  BoardRole,
  MembershipRepository,
  UserRepository,
} from "../ports/index.ts";

export interface BoardMemberView {
  readonly userId: string;
  readonly name: string;
  readonly email: string;
  readonly role: BoardRole;
}

const ROLE_PRIORITY: Record<BoardRole, number> = {
  OWNER: 1,
  MANAGER: 2,
  MEMBER: 3,
};

/**
 * Use Case: Získání seznamu aktivních členů Nástěnky (GetBoardMembers).
 *
 * Invarianty (ADR-009, docs/020_Pozadavky.md §3, docs/050_Architektura.md §35.14):
 * 1. Actor musí být přihlášen a aktivní (AuthenticationError).
 * 2. Nástěnka musí existovat a nesmí být smazána (soft-deleted -> NotFoundError).
 * 3. Autorizace probíhá přes BoardPolicy (akce BOARD_VIEW):
 *    - Členové (OWNER, MANAGER, MEMBER) i systémový ADMIN mají přístup povolen.
 *    - Nečlen bez role ADMIN obdrží AuthorizationError(NOT_A_MEMBER).
 * 4. Vrací výhradně členy dané Nástěnky (cross-board izolace).
 * 5. Zahrnuje pouze aktivní (isActive === true) a nesmazané (deletedAt === null) uživatele.
 * 6. Deterministické řazení: Role (OWNER > MANAGER > MEMBER), následně jméno abecedně.
 */
export class GetBoardMembersUseCase {
  private readonly boardRepo: BoardRepository;
  private readonly membershipRepo: MembershipRepository;
  private readonly userRepo: UserRepository;

  constructor(
    boardRepo: BoardRepository,
    membershipRepo: MembershipRepository,
    userRepo: UserRepository,
  ) {
    this.boardRepo = boardRepo;
    this.membershipRepo = membershipRepo;
    this.userRepo = userRepo;
  }

  async execute(
    actor: ActorContext | null,
    boardId: string,
  ): Promise<Result<BoardMemberView[], AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validační pravidla vstupu ───────────────────────────
    const trimmedBoardId = boardId?.trim();
    if (!trimmedBoardId || trimmedBoardId.length === 0) {
      return err(new ValidationError("ID Nástěnky je povinné."));
    }

    // ── 3. Existence a stav Nástěnky ───────────────────────────
    const board = await this.boardRepo.findById(trimmedBoardId);
    if (!board || board.deletedAt !== null) {
      return err(new NotFoundError("Nástěnka nebyla nalezena."));
    }

    // ── 4. Načtení členství pro autorizaci ─────────────────────
    const actorMembership = await this.membershipRepo.findByBoardAndUser(
      trimmedBoardId,
      actor.actor_user_id,
    );

    // ── 5. Vyhodnocení oprávnění přes BoardPolicy ──────────────
    const authResult = checkBoardPermission(
      actor,
      { boardId: board.id, isDeleted: false },
      actorMembership ? { role: actorMembership.role } : null,
      "BOARD_VIEW",
    );

    if (!authResult.allowed) {
      if (authResult.reason === "UNAUTHENTICATED") {
        return err(new AuthenticationError());
      }
      return err(new AuthorizationError(undefined, authResult.reason));
    }

    // ── 6. Načtení členství pro danou Nástěnku ─────────────────
    const boardMemberships =
      await this.membershipRepo.findMembershipsByBoard(trimmedBoardId);

    if (boardMemberships.length === 0) {
      return ok([]);
    }

    // ── 7. Dávkové načtení detailů uživatelů (žádné N+1) ────────
    const userIds = boardMemberships.map((m) => m.userId);
    const users = await this.userRepo.findByIds(userIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    // ── 8. Filtrování pouze aktivních a nesmazaných členů ───────
    const activeMembers: BoardMemberView[] = [];

    for (const membership of boardMemberships) {
      const user = userMap.get(membership.userId);
      if (user && user.isActive && user.deletedAt === null) {
        activeMembers.push({
          userId: user.id,
          name: user.name,
          email: user.email,
          role: membership.role,
        });
      }
    }

    // ── 9. Deterministické seřazení ───────────────────────────
    activeMembers.sort((a, b) => {
      const roleDiff = ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role];
      if (roleDiff !== 0) return roleDiff;
      return a.name.localeCompare(b.name, "cs");
    });

    return ok(activeMembers);
  }
}
