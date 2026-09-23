/**
 * Veřejné API autorizační Policy vrstvy pro modul membership.
 *
 * Exportuje:
 * - checkMembershipPermission: hlavní funkce Membership Policy Engine
 * - typy MembershipAction, BoardRole, MembershipAuthorizationTarget,
 *   MembershipDenyReason, MembershipAuthorizationResult, ActorMembership,
 *   AuthorizationResult, AuthorizationDenyReason
 */
export { checkMembershipPermission } from "./membership-policy.ts";

export type {
  MembershipAction,
  BoardRole,
  MembershipAuthorizationTarget,
  MembershipDenyReason,
  MembershipAuthorizationResult,
  ActorMembership,
  AuthorizationResult,
  AuthorizationDenyReason,
} from "./membership-authorization.ts";
