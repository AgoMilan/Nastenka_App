/**
 * STEP 17.8A – Authorization Contract pro Board-level operace.
 *
 * Definuje:
 * - BoardAction: výčet všech autorizovatelných Board-level operací.
 * - AuthorizationResult: explicitní výsledek autorizace s kódem důvodu.
 * - Pomocné typové konstrukce pro Policy Engine.
 *
 * Invarianty:
 * 1. Žádný import z Next.js, React, Drizzle ORM, Better Auth ani browser API.
 * 2. Tento soubor je čistý TypeScript bez side-effectů.
 * 3. Výsledek autorizace je vždy explicitní (ALLOW / DENY) – nikdy není implicitní.
 *
 * Reference: docs/050_Architektura.md, ADR-009, kapitola 35.14.
 */

// ─────────────────────────────────────────────────────────────
// Board Actions – autorizovatelné operace na Nástěnce
// ─────────────────────────────────────────────────────────────

/**
 * Výčet všech Board-level operací, pro které Policy Engine vyhodnocuje oprávnění.
 *
 * Scope tohoto kroku (17.8A+B): výhradně Board-level.
 * Task, Area, AssignTask a další operace jsou mimo scope tohoto checkpointu.
 */
export type BoardAction =
  | "BOARD_VIEW" // Zobrazit Nástěnku a její obsah
  | "BOARD_EDIT" // Upravit metadata Nástěnky (název, popis)
  | "BOARD_MANAGE_MEMBERS" // Přidat / odebrat / změnit roli člena (plná správa)
  | "BOARD_MANAGE_SETTINGS" // Správa nastavení Nástěnky (plná – alias pro BOARD_EDIT v budoucích rozšířeních)
  | "BOARD_TRANSFER_OWNERSHIP" // Převod vlastnictví Nástěnky na jiného člena
  | "BOARD_DELETE"; // Soft-delete Nástěnky (DELETE_BOARD)

// ─────────────────────────────────────────────────────────────
// Authorization Result
// ─────────────────────────────────────────────────────────────

/**
 * Kód důvodu pro zamítnutí autorizace.
 *
 * Umožňuje volajícímu správně mapovat výsledek na HTTP status kód:
 * - UNAUTHENTICATED → 401
 * - NOT_A_MEMBER, INSUFFICIENT_ROLE → 403
 * - BOARD_DELETED → 403
 * - UNKNOWN_ACTION → 403
 */
export type AuthorizationDenyReason =
  | "UNAUTHENTICATED" // ActorContext je null – relace neexistuje nebo je neplatná
  | "NOT_A_MEMBER" // Actor není členem Nástěnky a nemá globální ADMIN roli
  | "INSUFFICIENT_ROLE" // Actor je členem, ale jeho role nestačí pro požadovanou akci
  | "BOARD_DELETED" // Nástěnka je soft-deleted – žádná operace není povolena
  | "UNKNOWN_ACTION"; // Neznámá akce (obranné programování – nikdy by nemělo nastat)

/**
 * Explicitní výsledek autorizační kontroly.
 *
 * ALLOW: operace je povolena.
 * DENY: operace je zakázána, důvod je vždy uveden.
 *
 * Volající Use Case zodpovídá za správné mapování na HTTP status:
 *   UNAUTHENTICATED → 401 Unauthorized
 *   ostatní DENY → 403 Forbidden
 */
export type AuthorizationResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: AuthorizationDenyReason };

// ─────────────────────────────────────────────────────────────
// Board Authorization Context – vstup Policy Engine
// ─────────────────────────────────────────────────────────────

/**
 * Minimální popis Nástěnky potřebný pro autorizační rozhodnutí.
 *
 * Záměrně odděleno od Drizzle typů: Policy Engine nesmí importovat
 * persistenční vrstvu (ADR-009, architektonický invariant 5 a 7).
 */
export interface BoardAuthorizationTarget {
  /** ID Nástěnky – pro ladění a audit. */
  readonly boardId: string;
  /**
   * Příznak soft-delete Nástěnky.
   * true = Nástěnka je smazána → veškerá autorizace DENY s kódem BOARD_DELETED.
   */
  readonly isDeleted: boolean;
}

/**
 * Stav členství Actora v cílové Nástěnce.
 *
 * Pokud Actor není členem, předej null.
 * Pokud Actor je ADMIN (global_role = 'ADMIN'), může mu být uděleno
 * oprávnění i bez přímého členství – viz BoardPolicy.
 */
export interface ActorMembership {
  /** Aktuální role Actora v Nástěnce. */
  readonly role: "OWNER" | "MANAGER" | "MEMBER";
}
