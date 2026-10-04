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
} from "../../../boards/application/ports/index.ts";
import { checkTaskPermission } from "../policies/task-policy.ts";
import type {
  ActorTaskRelationship,
  TaskAuthorizationTarget,
} from "../policies/task-authorization.ts";
import type {
  TaskParticipantRepository,
  TaskRepository,
  UserTaskNoteRepository,
} from "../ports/index.ts";

export interface GetUserTaskNoteInput {
  readonly boardId: string;
  readonly taskId: string;
}

export interface UserTaskNoteView {
  readonly id: string;
  readonly userId: string;
  readonly taskId: string;
  readonly content: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isArchived: boolean;
}

/**
 * Use Case: Načtení vlastní soukromé poznámky k úkolu (GetUserTaskNote).
 *
 * Invarianty (Soukromé poznámky):
 * 1. Actor musí být přihlášen a aktivní (AuthenticationError).
 * 2. Nástěnka nesmí být smazána (soft-deleted -> NotFoundError).
 * 3. Úkol musí existovat a patřit do dané nástěnky (cross-board ochrana).
 * 4. Uživatel musí mít platné členství v nástěnce (nebo ADMIN).
 * 5. Uživatel načítá VÝHRADNĚ svou vlastní poznámku (nikdy cizí; userId se nepřebírá z klienta).
 * 6. Žádný jiný uživatel (ani člen, MANAGER, OWNER či ADMIN) nesmí číst cizí soukromou poznámku.
 * 7. Při odchodu z nástěnky uživatel ztrácí přístup (NOT_A_MEMBER), pouhá znalost taskId nestačí.
 * 8. U archivovaného úkolu lze vlastní existující poznámku číst (read-only).
 */
export class GetUserTaskNoteUseCase {
  private readonly boardRepo: BoardRepository;
  private readonly membershipRepo: MembershipRepository;
  private readonly taskRepo: TaskRepository;
  private readonly userTaskNoteRepo: UserTaskNoteRepository;
  private readonly taskParticipantRepo?: TaskParticipantRepository;

  constructor(
    boardRepo: BoardRepository,
    membershipRepo: MembershipRepository,
    taskRepo: TaskRepository,
    userTaskNoteRepo: UserTaskNoteRepository,
    taskParticipantRepo?: TaskParticipantRepository,
  ) {
    this.boardRepo = boardRepo;
    this.membershipRepo = membershipRepo;
    this.taskRepo = taskRepo;
    this.userTaskNoteRepo = userTaskNoteRepo;
    this.taskParticipantRepo = taskParticipantRepo;
  }

  async execute(
    actor: ActorContext | null,
    input: GetUserTaskNoteInput,
  ): Promise<Result<UserTaskNoteView | null, AppError>> {
    // ── 1. Autentizace volajícího ──────────────────────────────
    if (actor === null || !actor.is_active) {
      return err(new AuthenticationError());
    }

    // ── 2. Validace vstupů ────────────────────────────────────
    const boardId = input.boardId?.trim();
    const taskId = input.taskId?.trim();

    if (!boardId || boardId.length === 0) {
      return err(new ValidationError("ID nástěnky je povinné."));
    }
    if (!taskId || taskId.length === 0) {
      return err(new ValidationError("ID úkolu je povinné."));
    }

    // ── 3. Ověření existence nástěnky a úkolu ───────────────────
    const board = await this.boardRepo.findById(boardId);
    if (!board || board.deletedAt !== null) {
      return err(new NotFoundError("Nástěnka nebyla nalezena."));
    }

    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      return err(new NotFoundError("Úkol nebyl nalezen."));
    }

    if (task.boardId !== boardId) {
      return err(
        new AuthorizationError(
          "Úkol nepatří do zadané nástěnky.",
          "CROSS_BOARD_ACCESS",
        ),
      );
    }

    // ── 4. Ověření členství a vztahu k úkolu ────────────────────
    let actorMembership: ActorMembership | null = null;
    if (actor.global_role !== "ADMIN") {
      const memberRecord = await this.membershipRepo.findByBoardAndUser(
        boardId,
        actor.actor_user_id,
      );
      if (memberRecord) {
        actorMembership = { role: memberRecord.role };
      }
    }

    const isAssignee = task.assigneeId === actor.actor_user_id;
    let isParticipant = false;
    if (this.taskParticipantRepo) {
      const participantRecord =
        await this.taskParticipantRepo.findByTaskAndUser(
          task.id,
          actor.actor_user_id,
        );
      isParticipant = participantRecord !== null;
    }

    const target: TaskAuthorizationTarget = {
      boardId: task.boardId,
      taskId: task.id,
      createdBy: task.createdBy,
      assigneeId: task.assigneeId,
      status: task.status,
      isBoardDeleted: false,
      noteOwnerUserId: actor.actor_user_id,
    };

    const rel: ActorTaskRelationship = {
      isAssignee,
      isParticipant,
    };

    // ── 5. Autorizace přes TaskPolicy ──────────────────────────
    const authResult = checkTaskPermission(
      actor,
      boardId,
      actorMembership,
      target,
      rel,
      "TASK_PRIVATE_NOTE_VIEW_OWN",
    );

    if (!authResult.allowed) {
      return err(
        new AuthorizationError(
          "Nemáte oprávnění zobrazit soukromou poznámku k tomuto úkolu.",
          authResult.reason,
        ),
      );
    }

    // ── 6. Načtení poznámky z repozitáře ───────────────────────
    const note = await this.userTaskNoteRepo.findByUserAndTask(
      actor.actor_user_id,
      taskId,
    );

    if (!note) {
      return ok(null);
    }

    return ok({
      id: note.id,
      userId: note.userId,
      taskId: note.taskId,
      content: note.content,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      isArchived: task.status === "ARCHIVOVÁNO",
    });
  }
}
