import "server-only";
import {
  resolveActorContext,
  type ActorContext,
  type ResolveActorContextOptions,
} from "./actor-context.ts";
import {
  checkBoardPermission,
  type ActorMembership,
  type BoardAction,
  type BoardAuthorizationTarget,
} from "../../modules/boards/application/policies/index.ts";
import {
  checkTaskPermission,
  type ActorTaskRelationship,
  type TaskAction,
  type TaskAuthorizationTarget,
} from "../../modules/tasks/application/policies/index.ts";
import {
  checkAreaPermission,
  type AreaAction,
  type AreaAuthorizationTarget,
} from "../../modules/areas/application/policies/index.ts";
import {
  AuthenticationError,
  AuthorizationError,
} from "../../shared/errors/index.ts";
import { err, ok, type Result } from "../../shared/types/index.ts";

// ─────────────────────────────────────────────────────────────
// Cílové specifikace pro autorizační enforcement
// ─────────────────────────────────────────────────────────────

export interface BoardEnforcementTarget {
  readonly type: "board";
  readonly board: BoardAuthorizationTarget;
  readonly membership: ActorMembership | null;
  readonly action: BoardAction;
}

export interface TaskEnforcementTarget {
  readonly type: "task";
  readonly actorBoardId: string;
  readonly membership: ActorMembership | null;
  readonly task: TaskAuthorizationTarget;
  readonly taskRel: ActorTaskRelationship;
  readonly action: TaskAction;
}

export interface AreaEnforcementTarget {
  readonly type: "area";
  readonly actorBoardId: string;
  readonly membership: ActorMembership | null;
  readonly area: AreaAuthorizationTarget;
  readonly action: AreaAction;
}

export type EnforcementTarget =
  BoardEnforcementTarget | TaskEnforcementTarget | AreaEnforcementTarget;

export type EnforcementError = AuthenticationError | AuthorizationError;

// ─────────────────────────────────────────────────────────────
// enforceAuthorization – čistá enforcement kontrola
// ─────────────────────────────────────────────────────────────

/**
 * Vyhodnotí autorizaci pro daného Actora a cíl (Board, Task, Area).
 *
 * Zajišťuje striktní mapování:
 * - neautentizovaný / neaktivní volající → AuthenticationError (HTTP 401)
 * - autentizovaný volající bez oprávnění → AuthorizationError (HTTP 403 s explicitním kódem důvodu)
 * - oprávněný volající → ok(actor)
 *
 * @param actor  - Serverový ActorContext nebo null.
 * @param target - Cíl autorizace (Board, Task nebo Area).
 * @returns Result<ActorContext, EnforcementError>
 */
export function enforceAuthorization(
  actor: ActorContext | null,
  target: EnforcementTarget,
): Result<ActorContext, EnforcementError> {
  // 1. Neautentizovaný nebo neaktivní uživatel → vždy 401
  if (actor === null || !actor.is_active) {
    return err(new AuthenticationError());
  }

  // 2. Vyhodnocení přes příslušný Policy Engine
  switch (target.type) {
    case "board": {
      const result = checkBoardPermission(
        actor,
        target.board,
        target.membership,
        target.action,
      );
      if (!result.allowed) {
        if (result.reason === "UNAUTHENTICATED") {
          return err(new AuthenticationError());
        }
        return err(new AuthorizationError(undefined, result.reason));
      }
      return ok(actor);
    }

    case "task": {
      const result = checkTaskPermission(
        actor,
        target.actorBoardId,
        target.membership,
        target.task,
        target.taskRel,
        target.action,
      );
      if (!result.allowed) {
        if (result.reason === "UNAUTHENTICATED") {
          return err(new AuthenticationError());
        }
        return err(new AuthorizationError(undefined, result.reason));
      }
      return ok(actor);
    }

    case "area": {
      const result = checkAreaPermission(
        actor,
        target.actorBoardId,
        target.membership,
        target.area,
        target.action,
      );
      if (!result.allowed) {
        if (result.reason === "UNAUTHENTICATED") {
          return err(new AuthenticationError());
        }
        return err(new AuthorizationError(undefined, result.reason));
      }
      return ok(actor);
    }

    default: {
      const _exhaustive: never = target;
      void _exhaustive;
      return err(
        new AuthorizationError("Neznámý cíl autorizace.", "UNKNOWN_TARGET"),
      );
    }
  }
}

// ─────────────────────────────────────────────────────────────
// executeProtectedOperation – HTTP / Route Handler wrapper
// ─────────────────────────────────────────────────────────────

export interface ExecuteProtectedOperationOptions {
  /**
   * Přímý ActorContext (umožňuje testování bez nutnosti live Better Auth session).
   */
  actor?: ActorContext | null;
  /**
   * Možnosti pro resolveActorContext (např. mock auth nebo db).
   */
  resolveOptions?: ResolveActorContextOptions;
  /**
   * Vlastní HTTP status kód pro úspěšnou odpověď (výchozí 200).
   */
  successStatus?: number;
}

/**
 * Spustí chráněnou operaci na serverové hranici.
 *
 * Zaručuje princip „Authorize before operation":
 * 1. Získá a ověří ActorContext ze serverové session (nebo zadaného kontextu).
 * 2. Ověří autorizaci voláním příslušného Policy Engine.
 * 3. Pokud je autorizace zamítnuta:
 *    - Chráněná operace se NIKDY NESPUSTÍ.
 *    - Vrátí HTTP 401 (neautentizován) nebo HTTP 403 (nedostatečná práva) s JSON chybou.
 * 4. Pokud je autorizace povolena:
 *    - Spustí chráněnou operaci: operation(actor).
 *    - Vrátí odpověď (buď instanci Response z operace, nebo JSON Response se statusem 200/201).
 *
 * @param requestOrHeaders - Příchozí HTTP Request nebo Headers.
 * @param target           - Cíl a akce k autorizaci.
 * @param operation        - Chráněná aplikační operace, která se spustí VÝHRADNĚ při úspěšné autorizaci.
 * @param options          - Volitelná konfigurace (např. testovací mocky).
 * @returns Promise<Response>
 */
export async function executeProtectedOperation<T>(
  requestOrHeaders: Request | Headers,
  target: EnforcementTarget,
  operation: (actor: ActorContext) => Promise<T> | T,
  options?: ExecuteProtectedOperationOptions,
): Promise<Response> {
  // 1. Získání ActorContextu
  let actor: ActorContext | null;
  if (options && "actor" in options) {
    actor = options.actor ?? null;
  } else {
    actor = await resolveActorContext(
      requestOrHeaders,
      options?.resolveOptions,
    );
  }

  // 2. Vyhodnocení autorizace
  const authResult = enforceAuthorization(actor, target);

  // 3. Při neúspěchu: chráněná operace se NIKDY NESMÍ spustit
  if (!authResult.success) {
    const error = authResult.error;
    return new Response(JSON.stringify(error.toJSON()), {
      status: error.statusCode,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // 4. Autorizace schválena: spuštění chráněné operace
  const result = await operation(authResult.data);

  if (result instanceof Response) {
    return result;
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: result,
    }),
    {
      status: options?.successStatus ?? 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}
