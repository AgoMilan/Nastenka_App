/**
 * STEP 17.8C – Area Policy Engine.
 *
 * Implementuje autorizační pravidla pro Area-level operace.
 *
 * Architektonické invarianty (ADR-009):
 * 1. Žádný import z Next.js, React, Drizzle ORM, Better Auth ani browser API.
 * 2. Policy Engine neobsahuje server-only import – je čistá doménová logika.
 * 3. ADMIN pravomoci jsou explicitní, nikoli implicitní.
 * 4. Cross-board přístup je striktně odmítán (CROSS_BOARD_ACCESS).
 * 5. 401 vs 403: UNAUTHENTICATED → 401; vše ostatní → 403.
 *
 * Autorizační matice (zdroj: docs/020_Pozadavky.md §4,
 *                           docs/050_Architektura.md §28 a §30):
 *
 * ┌───────────────┬───────┬───────┬─────────┬────────┐
 * │ Operace       │ ADMIN │ OWNER │ MANAGER │ MEMBER │
 * ├───────────────┼───────┼───────┼─────────┼────────┤
 * │ AREA_VIEW     │  ANO  │  ANO  │   ANO   │  ANO   │
 * │ AREA_CREATE   │  ANO  │  ANO  │   ANO   │  NE    │
 * │ AREA_EDIT     │  ANO  │  ANO  │   ANO   │  NE    │
 * │ AREA_DELETE   │  ANO  │  ANO  │   ANO   │  NE    │
 * └───────────────┴───────┴───────┴─────────┴────────┘
 *
 * Poznámka z dokumentace:
 * - MANAGER může vytvářet, upravovat i mazat oblasti (včetně jejich úkolů).
 * - Běžný MEMBER má pouze právo na zobrazení (AREA_VIEW).
 */

import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import type { ActorMembership } from "../../../boards/application/policies/board-authorization.ts";
import type {
  AreaAction,
  AreaAuthorizationResult,
  AreaAuthorizationTarget,
  AreaDenyReason,
} from "./area-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Pomocné konstanty
// ─────────────────────────────────────────────────────────────

const ALLOW: AreaAuthorizationResult = { allowed: true };

function deny(reason: AreaDenyReason): AreaAuthorizationResult {
  return { allowed: false, reason };
}

// ─────────────────────────────────────────────────────────────
// checkAreaPermission – hlavní exportovaná funkce
// ─────────────────────────────────────────────────────────────

/**
 * Vyhodnotí, zda Actor smí provést požadovanou Area-level akci.
 *
 * @param actor        - Serverový kontext volajícího (výstup resolveActorContext).
 *                       null nebo neaktivní = neautentizovaný přístup → DENY(UNAUTHENTICATED).
 * @param actorBoardId - ID Nástěnky, ke které má Actor ověřené členství.
 *                       Slouží ke cross-board security kontrole.
 * @param membership   - Aktuální členství Actora v Nástěnce (OWNER/MANAGER/MEMBER),
 *                       nebo null pokud Actor není členem.
 * @param area         - Minimální kontext cílové oblasti.
 * @param action       - Požadovaná Area-level akce.
 * @returns            AreaAuthorizationResult (ALLOW nebo DENY s kódem důvodu).
 */
export function checkAreaPermission(
  actor: ActorContext | null,
  actorBoardId: string,
  membership: ActorMembership | null,
  area: AreaAuthorizationTarget,
  action: AreaAction,
): AreaAuthorizationResult {
  // ── 1. Unauthenticated guard ──────────────────────────────
  if (actor === null || !actor.is_active) {
    return deny("UNAUTHENTICATED");
  }

  // ── 2. Soft-delete guard ──────────────────────────────────
  if (area.isBoardDeleted) {
    return deny("BOARD_DELETED");
  }

  // ── 3. Cross-board security guard ────────────────────────
  // Oblast musí patřit do stejné Nástěnky, pro kterou má Actor kontext.
  if (area.boardId !== actorBoardId) {
    return deny("CROSS_BOARD_ACCESS");
  }

  // ── 4. Global ADMIN bypass ───────────────────────────────
  // ADMIN má explicitní přístup ke všem Area operacím v rámci Nástěnky.
  if (actor.global_role === "ADMIN") {
    return ALLOW;
  }

  // ── 5. Membership guard ───────────────────────────────────
  // Non-ADMIN Actor bez členství nemá přístup k žádné Area operaci.
  if (membership === null) {
    return deny("NOT_A_MEMBER");
  }

  const role = membership.role;

  // ── 6. Per-action authorization ───────────────────────────
  switch (action) {
    // ── AREA_VIEW ───────────────────────────────────────────
    // Všichni členové Nástěnky (OWNER, MANAGER, MEMBER) mohou zobrazit oblast.
    case "AREA_VIEW":
      return ALLOW;

    // ── AREA_CREATE ─────────────────────────────────────────
    // Vytvoření oblasti: pouze OWNER a MANAGER.
    case "AREA_CREATE":
      if (role === "OWNER" || role === "MANAGER") {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── AREA_EDIT ───────────────────────────────────────────
    // Úprava oblasti (název, popis): pouze OWNER a MANAGER.
    case "AREA_EDIT":
      if (role === "OWNER" || role === "MANAGER") {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── AREA_DELETE ─────────────────────────────────────────
    // Řízené smazání oblasti: pouze OWNER a MANAGER (vyžaduje potvrzení SMAZAT).
    case "AREA_DELETE":
      if (role === "OWNER" || role === "MANAGER") {
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
