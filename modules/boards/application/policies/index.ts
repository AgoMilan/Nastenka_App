/**
 * Veřejné API autorizační Policy vrstvy pro modul boards.
 *
 * Exportuje:
 * - checkBoardPermission: hlavní funkce Policy Engine
 * - typy BoardAction, AuthorizationResult, AuthorizationDenyReason,
 *   BoardAuthorizationTarget, ActorMembership
 */
export { checkBoardPermission } from "./board-policy.ts";

export type {
  BoardAction,
  AuthorizationResult,
  AuthorizationDenyReason,
  BoardAuthorizationTarget,
  ActorMembership,
} from "./board-authorization.ts";
