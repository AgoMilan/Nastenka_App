/**
 * STEP 17.8C – Authorization Contract pro Task-level operace.
 *
 * Definuje:
 * - TaskAction: výčet všech autorizovatelných Task-level operací.
 * - TaskAuthorizationTarget: minimální kontext cílového úkolu pro Policy Engine.
 * - ActorTaskRelationship: vztah Actora k danému úkolu.
 * - Sdílené typy AuthorizationResult a AuthorizationDenyReason jsou importovány
 *   z board-authorization.ts pro zachování kompatibility.
 * - TaskDenyReason a TaskAuthorizationResult: explicitní výsledky pro Task operace.
 *
 * Architektonické invarianty:
 * 1. Žádný import z Next.js, React, Drizzle ORM, Better Auth ani browser API.
 * 2. Čistý TypeScript bez side-effectů.
 * 3. Výsledek autorizace je vždy explicitní (ALLOW / DENY).
 * 4. Policy Engine obdrží vždy předem načtený kontext – nikdy neprovádí
 *    vlastní DB dotazy.
 *
 * Reference: docs/020_Pozadavky.md §5, docs/050_Architektura.md §35.14, ADR-009.
 */

import type { AreaAuthorizationTarget } from "../../../areas/application/policies/area-authorization.ts";
import type { AuthorizationDenyReason } from "../../../boards/application/policies/board-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Sdílené autorizační typy (kompatibilita s Board Policy Engine)
// ─────────────────────────────────────────────────────────────

export type {
  AuthorizationResult,
  AuthorizationDenyReason,
} from "../../../boards/application/policies/board-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Task Actions – autorizovatelné operace nad Úkolem
// ─────────────────────────────────────────────────────────────

/**
 * Výčet všech Task-level operací, pro které Policy Engine vyhodnocuje oprávnění.
 *
 * Zdroj: docs/020_Pozadavky.md §5.1–5.11, docs/050_Architektura.md §35.14
 *
 * TASK_VIEW                – Zobrazit detail úkolu (dostupné všem členům Nástěnky)
 * TASK_CREATE              – Vytvořit nový úkol (dostupné všem členům Nástěnky)
 * TASK_EDIT_TITLE          – Upravit název úkolu (dostupné všem členům Nástěnky)
 * TASK_EDIT_DESCRIPTION    – Upravit popis úkolu (dostupné všem členům Nástěnky)
 * TASK_SET_PRIORITY        – Nastavit/změnit prioritu BĚŽNÁ/SPĚCHÁ (dostupné všem členům)
 * TASK_CHANGE_ASSIGNEE     – Změnit/přiřadit Hlavního Řešitele (dostupné všem členům)
 * TASK_TAKE_OVER           – Převzít úkol na sebe (stát se Hlavním Řešitelem)
 * TASK_JOIN_AS_PARTICIPANT – Připojit se k úkolu jako Spoluřešitel (podmínka: úkol má assignee)
 * TASK_LEAVE_AS_PARTICIPANT– Odpojit se od úkolu (pouze sám sebe)
 * TASK_REMOVE_PARTICIPANT  – Odebrat Spoluřešitele ze seznamu (Hlavní Řešitel, MANAGER, OWNER, ADMIN)
 * TASK_CHANGE_STATUS       – Změnit stav úkolu (Řešitel + Spoluřešitel + MANAGER + OWNER + ADMIN)
 * TASK_CHANGE_AREA         – Přesunout úkol do jiné oblasti (Řešitel + Spoluřešitel + MANAGER + OWNER + ADMIN)
 * TASK_CHANGE_DUE_DATE     – Změnit termín splnění (Řešitel + Spoluřešitel + MANAGER + OWNER + ADMIN)
 * TASK_ARCHIVE             – Archivovat úkol (Řešitel + Spoluřešitel + MANAGER + OWNER + ADMIN)
 * TASK_DELETE              – Trvale smazat úkol – hard-delete (Řešitel + Spoluřešitel + MANAGER + OWNER + ADMIN)
 */
export type TaskAction =
  | "TASK_VIEW"
  | "TASK_CREATE"
  | "TASK_EDIT_TITLE"
  | "TASK_EDIT_DESCRIPTION"
  | "TASK_SET_PRIORITY"
  | "TASK_CHANGE_ASSIGNEE"
  | "TASK_TAKE_OVER"
  | "TASK_JOIN_AS_PARTICIPANT"
  | "TASK_LEAVE_AS_PARTICIPANT"
  | "TASK_REMOVE_PARTICIPANT"
  | "TASK_CHANGE_STATUS"
  | "TASK_CHANGE_AREA"
  | "TASK_CHANGE_DUE_DATE"
  | "TASK_ARCHIVE"
  | "TASK_DELETE";

// ─────────────────────────────────────────────────────────────
// Task Deny Reasons a Result
// ─────────────────────────────────────────────────────────────

export type TaskDenyReason =
  | AuthorizationDenyReason
  | "CROSS_BOARD_ACCESS"
  | "TASK_HAS_NO_ASSIGNEE"
  | "CANNOT_LEAVE_OTHER_PARTICIPANT";

export type TaskAuthorizationResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: TaskDenyReason };

// ─────────────────────────────────────────────────────────────
// Task Authorization Target – minimální kontext pro rozhodnutí
// ─────────────────────────────────────────────────────────────

/**
 * Minimální popis cílového úkolu pro autorizační rozhodnutí.
 *
 * Záměrně oddělen od Drizzle typů – Policy Engine nesmí importovat
 * persistenční vrstvu (ADR-009).
 */
export interface TaskAuthorizationTarget {
  /**
   * ID Nástěnky, do které úkol patří.
   * Kritické pro cross-board security: musí odpovídat ID Nástěnky Actora.
   */
  readonly boardId: string;

  /**
   * ID úkolu – pro ladění a audit.
   */
  readonly taskId: string;

  /**
   * ID tvůrce úkolu (neměnné pole).
   */
  readonly createdBy: string;

  /**
   * Alias pro createdBy pro maximální kompatibilitu.
   */
  readonly creatorId?: string;

  /**
   * ID Hlavního Řešitele, nebo null pokud je úkol Nepřiřazen.
   * null = stav „Nepřiřazeno" → nelze se připojit jako Spoluřešitel.
   */
  readonly assigneeId: string | null;

  /**
   * Cílový uživatel pro operace s účastníky (např. LEAVE_AS_PARTICIPANT / REMOVE_PARTICIPANT).
   */
  readonly targetUserId?: string;

  /**
   * Cílová oblast pro operaci TASK_CHANGE_AREA.
   * Umožňuje cross-board kontrolu: task.boardId === targetArea.boardId.
   */
  readonly targetArea?: AreaAuthorizationTarget;

  /**
   * ID aktuální oblasti úkolu.
   */
  readonly areaId?: string | null;

  /**
   * Příznak smazané Nástěnky (soft-delete).
   */
  readonly isBoardDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Actor Task Relationship – vztah Actora k danému úkolu
// ─────────────────────────────────────────────────────────────

/**
 * Přesný vztah Actora k cílovému úkolu.
 *
 * Policy Engine potřebuje:
 * 1. Zda je Actor Hlavním Řešitelem (assignee).
 * 2. Zda je Actor Spoluřešitelem (participant).
 */
export interface ActorTaskRelationship {
  /**
   * true = Actor je aktuálním Hlavním Řešitelem tohoto úkolu.
   */
  readonly isAssignee: boolean;

  /**
   * true = Actor je Spoluřešitelem tohoto úkolu.
   */
  readonly isParticipant: boolean;
}
