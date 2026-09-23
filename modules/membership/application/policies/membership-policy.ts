/**
 * STEP 17.9 – Membership Policy Engine.
 *
 * Implementuje autorizační pravidla pro operace nad členstvím na Nástěnce:
 * - MEMBER_ADD
 * - MEMBER_REMOVE
 * - MEMBER_CHANGE_ROLE
 *
 * Architektonické invarianty (ADR-009):
 * 1. Žádný import z Next.js, React, Drizzle ORM, Better Auth ani browser API.
 * 2. Policy Engine neobsahuje server-only import – je čistá doménová logika.
 * 3. ADMIN pravomoci jsou explicitní, nikoli implicitní.
 * 4. Cross-board přístup je striktně odmítán (CROSS_BOARD_ACCESS).
 * 5. 401 vs 403: UNAUTHENTICATED → 401; vše ostatní → 403.
 * 6. Strukturální invarianty vlastnictví (I1, I2, I3):
 *    - Aktivní board má právě 1 OWNER (I1).
 *    - Remove sole OWNER → DENY (CANNOT_REMOVE_SOLE_OWNER) pro všechny role včetně ADMIN.
 *    - Běžný ChangeRole nesmí obejít pravidla vlastnictví (I2):
 *      newRole = OWNER → DENY (OWNERSHIP_TRANSFER_REQUIRED).
 *    - Demote sole OWNER → DENY (CANNOT_DEMOTE_SOLE_OWNER) pro všechny role včetně ADMIN.
 * 7. Invariant max. 1 Manager (I4):
 *    - Jmenování/povýšení na Managera při existujícím Managerovi → DENY (MANAGER_LIMIT_EXCEEDED).
 *
 * Autorizační matice (zdroj: docs/050_Architektura.md §7 a §30):
 *
 * ┌────────────────────┬───────┬───────┬───────────────────┬────────┐
 * │ Operace            │ ADMIN │ OWNER │ MANAGER           │ MEMBER │
 * ├────────────────────┼───────┼───────┼───────────────────┼────────┤
 * │ MEMBER_ADD         │  ANO  │  ANO  │ jen role MEMBER   │   NE   │
 * │ MEMBER_REMOVE      │  ANO* │  ANO* │ jen role MEMBER   │   NE   │
 * │ MEMBER_CHANGE_ROLE │  ANO**│  ANO**│ NE                │   NE   │
 * └────────────────────┴───────┴───────┴───────────────────┴────────┘
 *
 * ANO* (MEMBER_REMOVE): nelze odebrat sole OWNER (I1).
 * ANO** (MEMBER_CHANGE_ROLE): nelze povýšit na OWNER ani sesadit sole OWNER (I2, I3).
 *
 * Reference: docs/020_Pozadavky.md §3, docs/050_Architektura.md §7 a §30.
 */

import type { ActorContext } from "../../../../infrastructure/auth/actor-context.ts";
import type { ActorMembership } from "../../../boards/application/policies/board-authorization.ts";
import type {
  MembershipAction,
  MembershipAuthorizationResult,
  MembershipAuthorizationTarget,
  MembershipDenyReason,
} from "./membership-authorization.ts";

// ─────────────────────────────────────────────────────────────
// Pomocné konstanty
// ─────────────────────────────────────────────────────────────

const ALLOW: MembershipAuthorizationResult = { allowed: true };

function deny(reason: MembershipDenyReason): MembershipAuthorizationResult {
  return { allowed: false, reason };
}

// ─────────────────────────────────────────────────────────────
// checkMembershipPermission – hlavní exportovaná funkce
// ─────────────────────────────────────────────────────────────

/**
 * Vyhodnotí, zda Actor smí provést požadovanou operaci nad členstvím.
 *
 * @param actor           - Serverový kontext volajícího (výstup resolveActorContext).
 *                          null nebo neaktivní = neautentizovaný přístup → DENY(UNAUTHENTICATED).
 * @param actorBoardId    - ID Nástěnky, ke které má Actor ověřené členství.
 *                          Slouží ke cross-board security kontrole.
 * @param actorMembership - Aktuální členství Actora v Nástěnce (OWNER/MANAGER/MEMBER),
 *                          nebo null pokud Actor není členem.
 * @param target          - Minimální kontext cílového členství / operace.
 * @param action          - Požadovaná operace (MEMBER_ADD, MEMBER_REMOVE, MEMBER_CHANGE_ROLE).
 * @returns               MembershipAuthorizationResult (ALLOW nebo DENY s kódem důvodu).
 */
export function checkMembershipPermission(
  actor: ActorContext | null,
  actorBoardId: string,
  actorMembership: ActorMembership | null,
  target: MembershipAuthorizationTarget,
  action: MembershipAction,
): MembershipAuthorizationResult {
  // ── 1. Unauthenticated guard ──────────────────────────────
  if (actor === null || !actor.is_active) {
    return deny("UNAUTHENTICATED");
  }

  // ── 2. Soft-delete guard ──────────────────────────────────
  if (target.isBoardDeleted) {
    return deny("BOARD_DELETED");
  }

  // ── 3. Cross-board security guard ────────────────────────
  // Cílové členství musí patřit do stejné Nástěnky, pro kterou má Actor kontext.
  if (target.boardId !== actorBoardId) {
    return deny("CROSS_BOARD_ACCESS");
  }

  // ── 4. Strukturální invarianty vlastnictví (I1, I2, I3) ───
  // Tyto invarianty platí bez výjimky pro všechny aktory včetně globálního ADMINa.

  // I1 & I3: Aktivní Nástěnka musí mít právě jednoho platného Ownera.
  // Odstranění jediného Ownera je přísně zakázáno.
  if (
    action === "MEMBER_REMOVE" &&
    (target.targetRole === "OWNER" || target.isSoleOwner === true)
  ) {
    return deny("CANNOT_REMOVE_SOLE_OWNER");
  }

  // I2 & I3: Běžná změna role nesmí obejít proces převodu vlastnictví (TransferOwnership).
  if (action === "MEMBER_CHANGE_ROLE") {
    // Nelze povýšit na OWNER přes ChangeRole
    if (target.newRole === "OWNER") {
      return deny("OWNERSHIP_TRANSFER_REQUIRED");
    }

    // Nelze sesadit sole OWNER na MEMBER nebo MANAGER přes ChangeRole
    if (target.targetRole === "OWNER" || target.isSoleOwner === true) {
      return deny("CANNOT_DEMOTE_SOLE_OWNER");
    }
  }

  // Přidání nového člena s rolí OWNER je zakázáno (Owner je dán vytvořením Nástěnky)
  if (action === "MEMBER_ADD" && target.newRole === "OWNER") {
    return deny("OWNERSHIP_TRANSFER_REQUIRED");
  }

  // ── 5. Invariant max. 1 Manager (I4) ──────────────────────
  // Povýšení nebo přidání s rolí MANAGER při již obsazené pozici Managera
  if (
    target.newRole === "MANAGER" &&
    target.targetRole !== "MANAGER" &&
    target.hasExistingManager === true
  ) {
    return deny("MANAGER_LIMIT_EXCEEDED");
  }

  // ── 6. Membership guard ───────────────────────────────────
  // Non-ADMIN Actor bez členství nemá přístup k žádné operaci správy členství.
  if (actorMembership === null && actor.global_role !== "ADMIN") {
    return deny("NOT_A_MEMBER");
  }

  // ── 7. Global ADMIN bypass pro povolené operace ───────────
  if (actor.global_role === "ADMIN") {
    return ALLOW;
  }

  // Od tohoto bodu je garantováno, že actorMembership !== null
  const role = actorMembership!.role;

  // ── 8. Per-action authorization ───────────────────────────
  switch (action) {
    // ── MEMBER_ADD ──────────────────────────────────────────
    // OWNER: smí přidat člena s rolí MEMBER nebo MANAGER
    // MANAGER: smí přidat člena VÝHRADNĚ s výchozí rolí MEMBER
    // MEMBER: nesmí přidávat členy
    case "MEMBER_ADD": {
      if (role === "OWNER") {
        return ALLOW;
      }
      if (role === "MANAGER") {
        if (target.newRole === "MEMBER" || target.newRole === undefined) {
          return ALLOW;
        }
        return deny("INSUFFICIENT_ROLE");
      }
      return deny("INSUFFICIENT_ROLE");
    }

    // ── MEMBER_REMOVE ───────────────────────────────────────
    // OWNER: smí odebrat MEMBER nebo MANAGER (odebrání OWNER bylo zachyceno v bodu 4)
    // MANAGER: smí odebrat výhradně řadového člena (MEMBER)
    // MEMBER: nesmí administrativně odebírat členy
    case "MEMBER_REMOVE": {
      if (role === "OWNER") {
        return ALLOW;
      }
      if (role === "MANAGER") {
        if (target.targetRole === "MEMBER") {
          return ALLOW;
        }
        return deny("INSUFFICIENT_ROLE");
      }
      return deny("INSUFFICIENT_ROLE");
    }

    // ── MEMBER_CHANGE_ROLE ──────────────────────────────────
    // OWNER: smí měnit role mezi MEMBER a MANAGER
    // MANAGER: nesmí měnit role existujících členů
    // MEMBER: nesmí měnit role
    case "MEMBER_CHANGE_ROLE": {
      if (role === "OWNER") {
        return ALLOW;
      }
      return deny("INSUFFICIENT_ROLE");
    }

    // ── Exhaustiveness check ─────────────────────────────────
    default: {
      const _exhaustiveCheck: never = action;
      void _exhaustiveCheck;
      return deny("UNKNOWN_ACTION");
    }
  }
}
