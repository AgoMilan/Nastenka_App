import {
  executeProtectedOperation,
  type EnforcementTarget,
  type ExecuteProtectedOperationOptions,
} from "../../../infrastructure/auth/index.ts";

/**
 * Minimální testovací API boundary pro ověření serverového enforcementu (STEP 17.8D).
 *
 * Slouží výhradně k ověření, že server je autoritativní, ověřuje ActorContext a oprávnění
 * před spuštěním operace a správně vrací HTTP 401 nebo 403.
 *
 * Nepředstavuje kompletní CRUD ani nový produktový modul.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const target = body.target as EnforcementTarget;
    const options = body.options as
      ExecuteProtectedOperationOptions | undefined;

    return await executeProtectedOperation(
      req,
      target,
      async (actor) => {
        // Chráněná operace, která se spustí VÝHRADNĚ tehdy, pokud autorizace uspěje:
        return {
          executed: true,
          action: target.action,
          actorUserId: actor.actor_user_id,
          globalRole: actor.global_role,
        };
      },
      options,
    );
  } catch (error) {
    return Response.json(
      {
        error: {
          code: "BAD_REQUEST",
          message:
            error instanceof Error ? error.message : "Neplatný požadavek.",
        },
      },
      { status: 400 },
    );
  }
}
