import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from "../../../../shared/errors/index.ts";
import { err, ok, type Result } from "../../../../shared/types/result.ts";
import type { ActorMembership } from "../../../boards/application/policies/board-authorization.ts";
import type {
  BoardRepository,
  MembershipRepository,
  UserRecord,
  UserRepository,
} from "../../../boards/application/ports/index.ts";

/**
 * DTO pro uživatele, kterého lze přiřadit do Nástěnky.
 */
export interface AssignableUserView {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/**
 * Use Case: Získání seznamu uživatelů, které lze přidat do dané Nástěnky (GetAssignableUsers).
 *
 * Invarianty (ADR-009, STEP 4):
 * 1. Actor musí být přihlášen a aktivní (AuthenticationError).
 * 2. Nástěnka musí existovat a nesmí být smazána (soft-deleted -> NotFoundError).
 * 3. Oprávnění: Pouze OWNER, MANAGER nebo globální ADMIN smí zobrazit seznam dostupných uživatelů pro přidání.
 *    Řadový MEMBER obdrží AuthorizationError(INSUFFICIENT_ROLE).
 *    Nečlen bez ADMIN obdrží AuthorizationError(NOT_A_MEMBER).
 * 4. Vrací výhradně aktivní uživatele (isActive === true, deletedAt === null),
 *    kteří DOSUD NEJSOU členy dané Nástěnky.
 * 5. Deterministické seřazení podle jména abecedně.
 */
export class GetAssignableUsersUseCase {
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
  ): Promise<Result<AssignableUserView[], AppError>> {
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

    // ── 4. Ověření členství a role volajícího ──────────────────
    let actorMembership: ActorMembership | null = null;
    if (actor.global_role !== "ADMIN") {
      const memberRecord = await this.membershipRepo.findByBoardAndUser(
        trimmedBoardId,
        actor.actor_user_id,
      );
      if (!memberRecord) {
        return err(
          new AuthorizationError(
            "Uživatel není členem této Nástěnky.",
            "NOT_A_MEMBER",
          ),
        );
      }
      actorMembership = { role: memberRecord.role };
    }

    // Pouze OWNER, MANAGER nebo ADMIN smí přidávat členy
    if (
      actor.global_role !== "ADMIN" &&
      actorMembership?.role !== "OWNER" &&
      actorMembership?.role !== "MANAGER"
    ) {
      return err(
        new AuthorizationError(
          "Nedostatečná role pro správu členů.",
          "INSUFFICIENT_ROLE",
        ),
      );
    }

    // ── 5. Načtení stávajících členů pro vyloučení ─────────────
    const currentMemberships =
      await this.membershipRepo.findMembershipsByBoard(trimmedBoardId);
    const existingMemberUserIds = new Set(
      currentMemberships.map((m) => m.userId),
    );

    // ── 6. Načtení všech aktivních uživatelů ───────────────────
    const allActiveUsers = await this.userRepo.findActiveUsers();

    // ── 7. Filtrování uživatelů, kteří ještě nejsou členy ───────
    const assignable: AssignableUserView[] = allActiveUsers
      .filter((u) => !existingMemberUserIds.has(u.id))
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      }));

    // ── 8. Deterministické seřazení podle jména ────────────────
    assignable.sort((a, b) => a.name.localeCompare(b.name, "cs"));

    return ok(assignable);
  }
}
