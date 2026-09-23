/**
 * STEP 17.8B – Board Policy Engine.
 *
 * Implementuje autorizační pravidla pro Board-level operace.
 *
 * Architektonické invarianty (ADR-009, docs/050_Architektura.md):
 * 1. Žádný import z Next.js, React, Drizzle ORM, Better Auth ani browser API.
 * 2. Žádný import "server-only" – Policy Engine je čistá doménová logika
 *    testovatelná bez serverového kontextu.
 * 3. ADMIN není implicitní "super-admin" – jeho oprávnění jsou explicitně
 *    definována v autorizační matici (docs/050_Architektura.md, kapitola 13 a 30).
 * 4. Soft-deleted Nástěnka blokuje veškerou autorizaci.
 * 5. 401 vs 403: UNAUTHENTICATED (null ActorContext) → 401; vše ostatní → 403.
 *
 * Autorizační matice (zdroj: docs/050_Architektura.md, kapitola 30 / 35.14):
 * ┌─────────────────────────────┬───────┬───────┬─────────┬────────┐
 * │ Operace                     │ ADMIN │ OWNER │ MANAGER │ MEMBER │
 * ├─────────────────────────────┼───────┼───────┼─────────┼────────┤
 * │ BOARD_VIEW                  │  ANO* │  ANO  │   ANO   │  ANO   │
 * │ BOARD_EDIT                  │  ANO* │  ANO  │   ANO   │  NE    │
 * │ BOARD_MANAGE_MEMBERS        │  ANO* │  ANO  │  OMEZENĚ│  NE    │
 * │ BOARD_MANAGE_SETTINGS       │  ANO* │  ANO  │   ANO   │  NE    │
 * │ BOARD_TRANSFER_OWNERSHIP    │  ANO* │  ANO  │   NE    │  NE    │
 * │ BOARD_DELETE                │  ANO* │  ANO  │   NE    │  NE    │
 * └─────────────────────────────┴───────┴───────┴─────────┴────────┘
 *
 * ANO* = ADMIN může operaci provést i bez přímého členství v Nástěnce
 *        (administrativní zásah globálního administrátora).
 *
 * BOARD_MANAGE_MEMBERS (MANAGER – OMEZENĚ):
 *   Manager může přidávat a odebírat BĚŽné členy (MEMBER).
 *   Manager NEMŮŽE:
 *   - převádět vlastnictví (BOARD_TRANSFER_OWNERSHIP),
 *   - odebírat nebo jmenovat jiného Managera (vyhrazeno pro OWNER / ADMIN),
 *   - odebírat nebo měnit roli OWNERa.
 *   V tomto checkpointu (17.8A+B) politika MANAGER → BOARD_MANAGE_MEMBERS
 *   vrací ALLOW jako základní vstupní bod; jemnozrnné omezení správy rolí
 *   bude vynuceno v příslušných Use Cases a MembershipPolicy (budoucí krok).
 *
 * Reference: docs/050_Architektura.md §2, §5, §7 (autorizační matice),
 *            §13 (role-aware UI), §30.15–30.16, §35.14.
 */

import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import type {
  ActorMembership,
  AuthorizationDenyReason,
  AuthorizationResult,
  BoardAction,
  BoardAuthorizationTarget,
} from "./board-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Pomocné konstanty
// ─────────────────────────────────────────────────────────────

const ALLOW: AuthorizationResult = { allowed: true };

function deny(reason: AuthorizationDenyReason): AuthorizationResult {
  return { allowed: false, reason };
}

// ─────────────────────────────────────────────────────────────
// BoardPolicy – hlavní exportovaná funkce
// ─────────────────────────────────────────────────────────────

/**
 * Vyhodnotí, zda Actor smí provést požadovanou Board-level akci.
 *
 * @param actor    - Serverový kontext volajícího (výstup resolveActorContext).
 *                   null = neautentizovaný přístup → vždy DENY(UNAUTHENTICATED).
 * @param board    - Minimální popis cílové Nástěnky (stav soft-delete, ID).
 * @param membership - Aktuální členství Actora v Nástěnce, nebo null pokud
 *                   Actor není členem.
 * @param action   - Požadovaná Board-level akce.
 * @returns        AuthorizationResult (ALLOW nebo DENY s důvodem).
 */
export function checkBoardPermission(
  actor: ActorContext | null,
  board: BoardAuthorizationTarget,
  membership: ActorMembership | null,
  action: BoardAction,
): AuthorizationResult {
  // ── 1. Unauthenticated guard ──────────────────────────────
  // ActorContext je null → relace neexistuje nebo je neplatná.
  // HTTP 401 – volající musí nejprve provést přihlášení.
  if (actor === null) {
    return deny("UNAUTHENTICATED");
  }

  // ── 2. Soft-delete guard ──────────────────────────────────
  // Smazaná Nástěnka blokuje veškeré operace bez výjimky.
  // Platí i pro ADMIN – smazaná Nástěnka je z autorizačního pohledu
  // nedostupná přes standardní Policy cestu.
  if (board.isDeleted) {
    return deny("BOARD_DELETED");
  }

  // ── 3. Global ADMIN bypass ───────────────────────────────
  // ADMIN (global_role = 'ADMIN') může provést všechny Board-level operace
  // bez ohledu na přímé členství.
  // Zdroj: docs/050_Architektura.md, kapitola 2, §4 a tabulka v §13 / §30.
  // Poznámka: ADMIN bypass je explicitní, nikoli implicitní – každá akce
  // musí být alespoň dosažitelná přes tuto cestu.
  if (actor.global_role === "ADMIN") {
    return ALLOW;
  }

  // ── 4. Membership guard ───────────────────────────────────
  // Non-ADMIN Actor bez členství nemá přístup k žádné Board-level operaci.
  if (membership === null) {
    return deny("NOT_A_MEMBER");
  }

  const role = membership.role;

  // ── 5. Per-action authorization ───────────────────────────
  switch (action) {
    // ── BOARD_VIEW ──────────────────────────────────────────
    // Všichni členové (OWNER, MANAGER, MEMBER) mohou Nástěnku zobrazit.
    case "BOARD_VIEW":
      return ALLOW;

    // ── BOARD_EDIT ──────────────────────────────────────────
    // Úprava metadat (název, popis). Povoleno: OWNER, MANAGER.
    case "BOARD_EDIT":
      if (role === "OWNER" || role === "MANAGER") {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── BOARD_MANAGE_SETTINGS ───────────────────────────────
    // Správa nastavení Nástěnky. Stejná matice jako BOARD_EDIT.
    // Zachováno jako samostatná akce pro budoucí granularitu.
    case "BOARD_MANAGE_SETTINGS":
      if (role === "OWNER" || role === "MANAGER") {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── BOARD_MANAGE_MEMBERS ─────────────────────────────────
    // Správa členů (přidání, odebrání, změna role).
    // OWNER: plná správa bez omezení.
    // MANAGER: základní přístup (jemnozrnné omezení vynucuje MembershipPolicy).
    // MEMBER: zakázáno.
    case "BOARD_MANAGE_MEMBERS":
      if (role === "OWNER" || role === "MANAGER") {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── BOARD_TRANSFER_OWNERSHIP ─────────────────────────────
    // Převod vlastnictví. Výhradně OWNER.
    // Zdroj: docs/050_Architektura.md §5 ("Právě jeden Owner"),
    //        §7 (TRANSFER_OWNERSHIP – vyhrazeno pro OWNER), §27.12.
    case "BOARD_TRANSFER_OWNERSHIP":
      if (role === "OWNER") {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── BOARD_DELETE ─────────────────────────────────────────
    // Soft-delete Nástěnky. Výhradně OWNER.
    // Zdroj: docs/050_Architektura.md §13 tabulka (DELETE_BOARD: OWNER ANO, MANAGER NE).
    case "BOARD_DELETE":
      if (role === "OWNER") {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");

    // ── Obranné programování ─────────────────────────────────
    // TypeScript exhaustiveness check – nikdy by nemělo nastat.
    default: {
      const _exhaustiveCheck: never = action;
      void _exhaustiveCheck;
      return deny("UNKNOWN_ACTION");
    }
  }
}
