/**
 * Veřejné API autorizační Policy vrstvy pro modul tasks.
 *
 * Exportuje:
 * - checkTaskPermission: hlavní funkce Task Policy Engine
 * - typy TaskAction, TaskAuthorizationTarget, ActorTaskRelationship, TaskDenyReason, TaskAuthorizationResult
 */
export { checkTaskPermission } from "./task-policy.ts";

export type {
  TaskAction,
  TaskAuthorizationTarget,
  ActorTaskRelationship,
  TaskDenyReason,
  TaskAuthorizationResult,
} from "./task-authorization.ts";
