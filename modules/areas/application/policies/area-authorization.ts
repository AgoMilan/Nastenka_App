/**
 * STEP 17.8C – Authorization Contract pro Area-level operace.
 *
 * Definuje:
 * - AreaAction: výčet autorizovatelných Area-level operací.
 * - AreaAuthorizationTarget: minimální kontext cílové oblasti pro Policy Engine.
 * - AreaDenyReason a AreaAuthorizationResult: explicitní výsledek autorizace.
 *
 * Architektonické invarianty:
 * 1. Žádný import z Next.js, React, Drizzle ORM, Better Auth ani browser API.
 * 2. Čistý TypeScript bez side-effectů.
 * 3. Sdílené autorizační typy importovány z board-authorization.ts.
 *
 * Reference: docs/020_Pozadavky.md §4 (správa oblastí),
 *            docs/050_Architektura.md §35.14, ADR-009.
 */

import type { AuthorizationDenyReason } from "../../../boards/application/policies/board-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Sdílené autorizační typy
// ─────────────────────────────────────────────────────────────

export type {
  AuthorizationResult,
  AuthorizationDenyReason,
} from "../../../boards/application/policies/board-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Area Actions – autorizovatelné operace nad Oblastí
// ─────────────────────────────────────────────────────────────

/**
 * Výčet všech Area-level operací.
 *
 * Zdroj: docs/020_Pozadavky.md §4 (Oblasti a správa),
 *        docs/050_Architektura.md §28 (Správa oblastí).
 *
 * AREA_VIEW   – Zobrazit oblast a její úkoly (dostupné všem členům Nástěnky)
 * AREA_CREATE – Vytvořit novou oblast (pouze OWNER, MANAGER, ADMIN)
 * AREA_EDIT   – Upravit název/popis oblasti (pouze OWNER, MANAGER, ADMIN)
 * AREA_DELETE – Smazat oblast včetně všech jejích úkolů – hard-delete (pouze OWNER, MANAGER, ADMIN)
 */
export type AreaAction =
  "AREA_VIEW" | "AREA_CREATE" | "AREA_EDIT" | "AREA_DELETE";

// ─────────────────────────────────────────────────────────────
// Area Deny Reasons a Result
// ─────────────────────────────────────────────────────────────

export type AreaDenyReason = AuthorizationDenyReason | "CROSS_BOARD_ACCESS";

export type AreaAuthorizationResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: AreaDenyReason };

// ─────────────────────────────────────────────────────────────
// Area Authorization Target – minimální kontext pro rozhodnutí
// ─────────────────────────────────────────────────────────────

/**
 * Minimální popis cílové oblasti pro autorizační rozhodnutí.
 *
 * Záměrně oddělen od Drizzle typů – Policy Engine nesmí importovat
 * persistenční vrstvu (ADR-009).
 */
export interface AreaAuthorizationTarget {
  /**
   * ID Nástěnky, do které oblast patří.
   * Kritické pro cross-board security: musí odpovídat ID Nástěnky Actora.
   */
  readonly boardId: string;

  /**
   * ID oblasti – pro ladění a audit.
   */
  readonly areaId: string;

  /**
   * Příznak smazané Nástěnky (soft-delete).
   */
  readonly isBoardDeleted?: boolean;
}
