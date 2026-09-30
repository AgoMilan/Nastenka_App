export {
  auth,
  betterAuthDrizzleAdapterConfig,
  createAuth,
  createBetterAuthOptions,
  getAuth,
  resetAuthForTests,
  resolveTrustedOrigins,
  serverOwnedUserFields,
} from "./better-auth.ts";

export {
  resolveActorContext,
  type ActorContext,
  type ResolveActorContextOptions,
} from "./actor-context.ts";

export {
  enforceAuthorization,
  executeProtectedOperation,
  type BoardEnforcementTarget,
  type TaskEnforcementTarget,
  type AreaEnforcementTarget,
  type EnforcementTarget,
  type EnforcementError,
  type ExecuteProtectedOperationOptions,
} from "./enforcement.ts";
