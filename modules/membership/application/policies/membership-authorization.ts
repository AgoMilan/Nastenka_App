/**
 * STEP 17.9 – Authorization Contract pro Membership-level operace.
 *
 * Definuje:
 * - MembershipAction: výčet autorizovatelných operací nad členstvím (MEMBER_ADD, MEMBER_REMOVE, MEMBER_CHANGE_ROLE).
 * - MembershipAuthorizationTarget: minimální kontext cílového členství pro Policy Engine.
 * - MembershipDenyReason a MembershipAuthorizationResult: explicitní výsledek autorizace.
 *
 * Architektonické invarianty:
 * 1. Žádný import z Next.js, React, Drizzle ORM, Better Auth ani browser API.
 * 2. Čistý TypeScript bez side-effectů.
 * 3. Sdílené typy (AuthorizationResult, AuthorizationDenyReason, ActorMembership)
 *    jsou importovány z board-authorization.ts.
 * 4. Strukturální invarianty:
 *    - Aktivní board má právě 1 OWNER (I1).
 *    - Obyčejný ChangeRole nemůže obejít pravidla pro převod vlastnictví (I2).
 *    - ADMIN nemůže porušit strukturní invariant jediného OWNER (I3).
 *
 * Reference: docs/020_Pozadavky.md §3, docs/050_Architektura.md §35.14, ADR-009.
 */

import type {
  ActorMembership,
  AuthorizationDenyReason,
  AuthorizationResult,
} from "../../../boards/application/policies/board-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Sdílené autorizační typy
// ─────────────────────────────────────────────────────────────

export type {
  ActorMembership,
  AuthorizationResult,
  AuthorizationDenyReason,
} from "../../../boards/application/policies/board-authorization.ts";

export type BoardRole = ActorMembership["role"]; // "OWNER" | "MANAGER" | "MEMBER"

// ─────────────────────────────────────────────────────────────
// Membership Actions – autorizovatelné operace nad Členstvím
// ─────────────────────────────────────────────────────────────

/**
 * Výčet všech Membership-level operací, pro které Policy Engine vyhodnocuje oprávnění.
 *
 * Zdroj: docs/050_Architektura.md §7 a §30, zadání STEP 17.9.
 *
 * MEMBER_ADD         – Přidat nového člena do Nástěnky
 * MEMBER_REMOVE      – Administrativně odebrat člena z Nástěnky
 * MEMBER_CHANGE_ROLE – Změnit roli existujícího člena na Nástěnce
 */
export type MembershipAction =
  "MEMBER_ADD" | "MEMBER_REMOVE" | "MEMBER_CHANGE_ROLE";

// ─────────────────────────────────────────────────────────────
// Membership Deny Reasons a Result
// ─────────────────────────────────────────────────────────────

export type MembershipDenyReason =
  | AuthorizationDenyReason
  | "CROSS_BOARD_ACCESS"
  | "CANNOT_REMOVE_SOLE_OWNER"
  | "CANNOT_DEMOTE_SOLE_OWNER"
  | "OWNERSHIP_TRANSFER_REQUIRED"
  | "MANAGER_LIMIT_EXCEEDED";

export type MembershipAuthorizationResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: MembershipDenyReason };

// ─────────────────────────────────────────────────────────────
// Membership Authorization Target – minimální kontext pro rozhodnutí
// ─────────────────────────────────────────────────────────────

/**
 * Minimální popis cílového členství pro autorizační rozhodnutí.
 *
 * Záměrně oddělen od Drizzle typů – Policy Engine nesmí importovat
 * persistenční vrstvu (ADR-009).
 */
export interface MembershipAuthorizationTarget {
  /**
   * ID Nástěnky, pro kterou je operace členství vyhodnocována.
   * Kritické pro cross-board security: musí odpovídat ID Nástěnky Actora.
   */
  readonly boardId: string;

  /**
   * Příznak smazané Nástěnky (soft-delete).
   */
  readonly isBoardDeleted?: boolean;

  /**
   * Současná role cílového člena (u operací MEMBER_REMOVE a MEMBER_CHANGE_ROLE).
   * U operace MEMBER_ADD je null/undefined (uživatel zatím není členem).
   */
  readonly targetRole?: BoardRole | null;

  /**
   * Požadovaná nová role:
   * - u MEMBER_ADD: role, se kterou má být člen přidán (výchozí "MEMBER")
   * - u MEMBER_CHANGE_ROLE: role, na kterou má být člen změněn
   */
  readonly newRole?: BoardRole;

  /**
   * ID uživatele, jehož členství je cílem operace (volitelné pro audit).
   */
  readonly targetUserId?: string;

  /**
   * Zda je cílový člen jediným vlastníkem (sole OWNER) Nástěnky.
   * Na aktivní Nástěnce platí invariant právě 1 Owner (1..1), proto
   * jakýkoliv targetRole === "OWNER" je jediným vlastníkem.
   */
  readonly isSoleOwner?: boolean;

  /**
   * Zda je pozice Managera na Nástěnce již obsazena (pro invariant max. 1 Manager).
   */
  readonly hasExistingManager?: boolean;
}
