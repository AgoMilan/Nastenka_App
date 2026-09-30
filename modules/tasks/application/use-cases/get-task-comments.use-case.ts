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
  UserRepository,
} from "../../../boards/application/ports/index.ts";
import { checkTaskPermission } from "../policies/task-policy.ts";
import type {
  ActorTaskRelationship,
  TaskAuthorizationTarget,
} from "../policies/task-authorization.ts";
import type {
  TaskCommentRepository,
  TaskParticipantRepository,
  TaskRepository,
} from "../ports/index.ts";

export interface GetTaskCommentsInput {
  readonly boardId: string;
  readonly taskId: string;
}

export interface TaskCommentAuthorView {
  readonly userId: string;
  readonly name: string;
  readonly email?: string;
}

export interface TaskCommentView {
  readonly id: string;
  readonly taskId: string;
  readonly content: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly author: TaskCommentAuthorView;
  readonly isOwn: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
}

/**
 * Use Case: Získání komentářů / diskuze k danému úkolu (GetTaskComments).
 *
 * Invarianty (STEP 8):
 * 1. Actor musí být přihlášen a aktivní.
 * 2. Nástěnka nesmí být smazána (soft-deleted).
 * 3. Úkol musí existovat a patřit do dané Nástěnky (cross-board ochrana).
 * 4. Autorizace přes TaskPolicy (akce TASK_COMMENT_VIEW) – povoleno všem členům i u archivovaných úkolů.
 * 5. Žádný N+1 problém – autoři jsou načítáni dávkově (batch).
 * 6. Deterministické seřazení chronologicky (createdAt ASC, id ASC).
 */
export class GetTaskCommentsUseCase {
  private readonly boardRepo: BoardRepository;
  private readonly membershipRepo: MembershipRepository;
  private readonly taskRepo: TaskRepository;
  private readonly taskCommentRepo: TaskCommentRepository;
  private readonly userRepo: UserRepository;
  private readonly taskParticipantRepo?: TaskParticipantRepository;

  constructor(
    boardRepo: BoardRepository,
    membershipRepo: MembershipRepository,
    taskRepo: TaskRepository,
    taskCommentRepo: TaskCommentRepository,
    userRepo: UserRepository,
    taskParticipantRepo?: TaskParticipantRepository,
  ) {
    this.boardRepo = boardRepo;
    this.membershipRepo = membershipRepo;
    this.taskRepo = taskRepo;
    this.taskCommentRepo = taskCommentRepo;
    this.userRepo = userRepo;
    this.taskParticipantRepo = taskParticipantRepo;
  }

  async execute(
    actor: ActorContext | null,
    input: GetTaskCommentsInput,
  ): Promise<Result<TaskCommentView[], AppError>> {
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
      "TASK_COMMENT_VIEW",
    );

    if (!authResult.allowed) {
      return err(
        new AuthorizationError(
          "Nemáte oprávnění zobrazit komentáře k tomuto úkolu.",
          authResult.reason,
        ),
      );
    }

    // ── 6. Načtení komentářů a autorů dávkově (Batch) ─────────
    const comments = await this.taskCommentRepo.findByTaskId(taskId);
    if (comments.length === 0) {
      return ok([]);
    }

    const distinctAuthorIds = Array.from(
      new Set(comments.map((c) => c.authorId)),
    );
    const users = await this.userRepo.findByIds(distinctAuthorIds);
    const userMap = new Map(users.map((u) => [u.id, u]));

    const isArchived = task.status === "ARCHIVOVÁNO";

    const commentViews: TaskCommentView[] = comments.map((comment) => {
      const isOwn = comment.authorId === actor.actor_user_id;
      const authorUser = userMap.get(comment.authorId);

      return {
        id: comment.id,
        taskId: comment.taskId,
        content: comment.content,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: {
          userId: comment.authorId,
          name: authorUser?.name ?? "Neznámý uživatel",
          email: authorUser?.email,
        },
        isOwn,
        canEdit: isOwn && !isArchived,
        canDelete: isOwn && !isArchived,
      };
    });

    return ok(commentViews);
  }
}
