/**
 * Veřejné API autorizační Policy vrstvy pro modul areas.
 *
 * Exportuje:
 * - checkAreaPermission: hlavní funkce Area Policy Engine
 * - typy AreaAction, AreaAuthorizationTarget, AreaDenyReason, AreaAuthorizationResult
 */
export { checkAreaPermission } from "./area-policy.ts";

export type {
  AreaAction,
  AreaAuthorizationTarget,
  AreaDenyReason,
  AreaAuthorizationResult,
} from "./area-authorization.ts";
