/**
 * STEP 17.8C – Task Policy Engine.
 *
 * Implementuje autorizační pravidla pro Task-level operace.
 *
 * Architektonické invarianty (ADR-009):
 * 1. Žádný import z Next.js, React, Drizzle ORM, Better Auth ani browser API.
 * 2. Policy Engine neobsahuje server-only import – je čistá doménová logika.
 * 3. ADMIN pravomoci jsou explicitní, nikoli implicitní.
 * 4. Cross-board přístup je striktně odmítán (CROSS_BOARD_ACCESS).
 * 5. 401 vs 403: UNAUTHENTICATED → 401; vše ostatní → 403.
 * 6. Podmínka JOIN: úkol musí mít řešitele (assignee).
 * 7. Podmínka LEAVE: uživatel může odpojit pouze sám sebe.
 *
 * Autorizační matice (zdroj: docs/020_Pozadavky.md §5.1–5.11,
 *                           docs/050_Architektura.md §35.14):
 *
 * ┌─────────────────────────────┬───────┬───────┬─────────┬──────────────────────┬────────┐
 * │ Operace                     │ ADMIN │ OWNER │ MANAGER │ ASSIGNEE / PARTICIPANT│ MEMBER │
 * ├─────────────────────────────┼───────┼───────┼─────────┼──────────────────────┼────────┤
 * │ TASK_VIEW                   │  ANO  │  ANO  │   ANO   │         ANO          │  ANO   │
 * │ TASK_CREATE                 │  ANO  │  ANO  │   ANO   │         ANO          │  ANO   │
 * │ TASK_EDIT_TITLE             │  ANO  │  ANO  │   ANO   │         ANO          │  ANO   │
 * │ TASK_EDIT_DESCRIPTION       │  ANO  │  ANO  │   ANO   │         ANO          │  ANO   │
 * │ TASK_SET_PRIORITY           │  ANO  │  ANO  │   ANO   │         ANO          │  ANO   │
 * │ TASK_CHANGE_ASSIGNEE        │  ANO  │  ANO  │   ANO   │         ANO          │  ANO   │
 * │ TASK_TAKE_OVER              │  ANO  │  ANO  │   ANO   │         ANO          │  ANO   │
 * │ TASK_JOIN_AS_PARTICIPANT    │  ANO  │  ANO  │   ANO   │         ANO          │  ANO*  │
 * │ TASK_LEAVE_AS_PARTICIPANT   │  ANO  │  ANO  │   ANO   │         ANO          │  ANO** │
 * │ TASK_REMOVE_PARTICIPANT     │  ANO  │  ANO  │   ANO   │     jen ASSIGNEE     │  NE    │
 * │ TASK_CHANGE_STATUS          │  ANO  │  ANO  │   ANO   │         ANO          │  NE    │
 * │ TASK_CHANGE_AREA            │  ANO  │  ANO  │   ANO   │         ANO          │  NE    │
 * │ TASK_CHANGE_DUE_DATE        │  ANO  │  ANO  │   ANO   │         ANO          │  NE    │
 * │ TASK_ARCHIVE                │  ANO  │  ANO  │   ANO   │         ANO          │  NE    │
 * │ TASK_DELETE                 │  ANO  │  ANO  │   ANO   │         ANO          │  NE    │
 * └─────────────────────────────┴───────┴───────┴─────────┴──────────────────────┴────────┘
 *
 * ANO* (JOIN_AS_PARTICIPANT) = vyžaduje, aby úkol měl přiřazeného Hlavního Řešitele (assigneeId !== null).
 * ANO** (LEAVE_AS_PARTICIPANT) = uživatel smí odpojit výhradně sám sebe.
 *
 * Reference: docs/020_Pozadavky.md §5.1–5.11, docs/050_Architektura.md §35.14.
 */

import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import type { ActorMembership } from "../../../boards/application/policies/board-authorization.ts";
import type {
  ActorTaskRelationship,
  TaskAction,
  TaskAuthorizationResult,
  TaskAuthorizationTarget,
  TaskDenyReason,
} from "./task-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Pomocné konstanty
// ─────────────────────────────────────────────────────────────

const ALLOW: TaskAuthorizationResult = { allowed: true };

function deny(reason: TaskDenyReason): TaskAuthorizationResult {
  return { allowed: false, reason };
}

// ─────────────────────────────────────────────────────────────
// checkTaskPermission – hlavní exportovaná funkce
// ─────────────────────────────────────────────────────────────

/**
 * Vyhodnotí, zda Actor smí provést požadovanou Task-level akci.
 *
 * @param actor        - Serverový kontext volajícího (výstup resolveActorContext).
 *                       null nebo neaktivní = neautentizovaný přístup → DENY(UNAUTHENTICATED).
 * @param actorBoardId - ID Nástěnky, ke které má Actor ověřené členství.
 *                       Slouží ke cross-board security kontrole.
 * @param membership   - Aktuální členství Actora v Nástěnce (OWNER/MANAGER/MEMBER),
 *                       nebo null pokud Actor není členem.
 * @param task         - Minimální kontext cílového úkolu.
 * @param taskRel      - Vztah Actora k danému úkolu (assignee, participant).
 * @param action       - Požadovaná Task-level akce.
 * @returns            TaskAuthorizationResult (ALLOW nebo DENY s kódem důvodu).
 */
export function checkTaskPermission(
  actor: ActorContext | null,
  actorBoardId: string,
  membership: ActorMembership | null,
  task: TaskAuthorizationTarget,
  taskRel: ActorTaskRelationship,
  action: TaskAction,
): TaskAuthorizationResult {
  // ── 1. Unauthenticated guard ──────────────────────────────
  if (actor === null || !actor.is_active) {
    return deny("UNAUTHENTICATED");
  }

  // ── 2. Soft-delete guard ──────────────────────────────────
  if (task.isBoardDeleted) {
    return deny("BOARD_DELETED");
  }

  // ── 3. Cross-board security guards ────────────────────────
  // Úkol musí patřit do stejné Nástěnky, ke které má Actor ověřený přístup.
  if (task.boardId !== actorBoardId) {
    return deny("CROSS_BOARD_ACCESS");
  }

  // Cílová oblast pro přesun úkolu musí patřit do stejné Nástěnky.
  if (task.targetArea && task.targetArea.boardId !== task.boardId) {
    return deny("CROSS_BOARD_ACCESS");
  }

  // ── 4. Membership guard ───────────────────────────────────
  // Non-ADMIN Actor bez členství nemá přístup k žádné Task operaci.
  if (membership === null && actor.global_role !== "ADMIN") {
    return deny("NOT_A_MEMBER");
  }

  // ── 5. Invariant: JOIN_AS_PARTICIPANT vyžaduje existenci řešitele ─
  if (action === "TASK_JOIN_AS_PARTICIPANT" && task.assigneeId === null) {
    return deny("TASK_HAS_NO_ASSIGNEE");
  }

  // ── 6. Invariant: LEAVE_AS_PARTICIPANT umožňuje odpojit pouze sám sebe ─
  if (
    action === "TASK_LEAVE_AS_PARTICIPANT" &&
    task.targetUserId !== undefined &&
    task.targetUserId !== actor.actor_user_id
  ) {
    return deny("CANNOT_LEAVE_OTHER_PARTICIPANT");
  }

  // ── 7. Global ADMIN bypass ───────────────────────────────
  // ADMIN má explicitní přístup ke všem Task operacím na dané Nástěnce.
  if (actor.global_role === "ADMIN") {
    return ALLOW;
  }

  // Od tohoto bodu je garantováno, že membership !== null
  const role = membership!.role;
  const isAssignee = taskRel.isAssignee;
  const isParticipant = taskRel.isParticipant;
  const isTaskWorker = isAssignee || isParticipant;

  // ── 8. Per-action authorization ───────────────────────────
  switch (action) {
    // ── TASK_VIEW ───────────────────────────────────────────
    // Všichni členové Nástěnky mohou zobrazit detail úkolu.
    case "TASK_VIEW":
      return ALLOW;

    // ── TASK_CREATE ─────────────────────────────────────────
    // Kterýkoliv člen Nástěnky může vytvořit úkol.
    case "TASK_CREATE":
      return ALLOW;

    // ── TASK_EDIT_TITLE ─────────────────────────────────────
    // Úprava názvu = úprava sdíleného obsahu → dostupné všem členům.
    case "TASK_EDIT_TITLE":
      return ALLOW;

    // ── TASK_EDIT_DESCRIPTION ───────────────────────────────
    // Všichni členové Nástěnky mohou upravit popis.
    case "TASK_EDIT_DESCRIPTION":
      return ALLOW;

    // ── TASK_SET_PRIORITY ───────────────────────────────────
    // Priorita je sdílená týmová vlastnost → kterýkoliv člen smí měnit.
    case "TASK_SET_PRIORITY":
      return ALLOW;

    // ── TASK_CHANGE_ASSIGNEE ────────────────────────────────
    // Přiřazení/změna Hlavního Řešitele → dostupné všem členům.
    case "TASK_CHANGE_ASSIGNEE":
      return ALLOW;

    // ── TASK_TAKE_OVER ──────────────────────────────────────
    // Převzetí úkolu na sebe → dostupné všem členům.
    case "TASK_TAKE_OVER":
      return ALLOW;

    // ── TASK_JOIN_AS_PARTICIPANT ────────────────────────────
    // Připojit se jako Spoluřešitel → dostupné všem členům (pokud úkol má assignee).
    case "TASK_JOIN_AS_PARTICIPANT":
      return ALLOW;

    // ── TASK_LEAVE_AS_PARTICIPANT ───────────────────────────
    // Odpojit se od úkolu → uživatel smí odpojit pouze sám sebe.
    case "TASK_LEAVE_AS_PARTICIPANT":
      return ALLOW;

    // ── TASK_REMOVE_PARTICIPANT ─────────────────────────────
    // Odebrat Spoluřešitele: výhradně Hlavní Řešitel (ASSIGNEE), MANAGER nebo OWNER.
    // Běžný člen ani Spoluřešitel toto oprávnění nemají.
    case "TASK_REMOVE_PARTICIPANT":
      if (role === "OWNER" || role === "MANAGER" || isAssignee) {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── TASK_CHANGE_STATUS ──────────────────────────────────
    // Změna stavu: Řešitel, Spoluřešitel, MANAGER, OWNER.
    case "TASK_CHANGE_STATUS":
      if (role === "OWNER" || role === "MANAGER" || isTaskWorker) {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── TASK_CHANGE_AREA ────────────────────────────────────
    // Přesun úkolu do jiné oblasti: Řešitel, Spoluřešitel, MANAGER, OWNER.
    case "TASK_CHANGE_AREA":
      if (role === "OWNER" || role === "MANAGER" || isTaskWorker) {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── TASK_CHANGE_DUE_DATE ────────────────────────────────
    // Změna termínu: Řešitel, Spoluřešitel, MANAGER, OWNER.
    case "TASK_CHANGE_DUE_DATE":
      if (role === "OWNER" || role === "MANAGER" || isTaskWorker) {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── TASK_ARCHIVE ────────────────────────────────────────
    // Archivovat úkol: Řešitel, Spoluřešitel, MANAGER, OWNER.
    case "TASK_ARCHIVE":
      if (role === "OWNER" || role === "MANAGER" || isTaskWorker) {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── TASK_DELETE ─────────────────────────────────────────
    // Trvale smazat úkol (hard-delete): Řešitel, Spoluřešitel, MANAGER, OWNER.
    case "TASK_DELETE":
      if (role === "OWNER" || role === "MANAGER" || isTaskWorker) {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── Exhaustiveness check ─────────────────────────────────
    default: {
      const _exhaustiveCheck: never = action;
      void _exhaustiveCheck;
      return deny("UNKNOWN_ACTION");
    }
  }
}
