import "server-only";
import { eq } from "drizzle-orm";
import type { Auth } from "better-auth";
import { auth as defaultAuth } from "./better-auth.ts";
import { getDb, type Database } from "../database/index.ts";
import { users, type GlobalRole } from "../../database/schema/index.ts";

/**
 * Serverový kontext volajícího (Actor Context) dle kapitoly 23.12 docs/050_Architektura.md.
 * Určuje, kdo operaci provádí na základě serverově ověřené session a čerstvého stavu v DB.
 *
 * Invarianty:
 * 1. actor_user_id pochází výhradně ze serverové session (nikdy z klientského vstupu).
 * 2. global_role pochází z aktuálního záznamu v databázi (users.global_role).
 * 3. is_active je true výhradně pro aktivní uživatele (user.is_active = true AND user.deleted_at IS NULL).
 */
export interface ActorContext {
  readonly actor_user_id: string;
  readonly global_role: GlobalRole;
  readonly session_id: string;
  readonly is_active: boolean;
}

export interface ResolveActorContextOptions {
  /**
   * Volitelná instance Better Auth (umožňuje mockování v testech).
   */
  auth?: Pick<Auth, "api">;
  /**
   * Volitelná instance databáze (umožňuje mockování v testech).
   */
  db?: Database;
}

/**
 * Získá bezpečný serverový ActorContext z příchozího HTTP požadavku nebo hlaviček.
 *
 * Tok vyhodnocení (kapitola 23.10 a 23.12):
 * 1. Ověření session přes Better Auth API.
 * 2. Načtení aktuálního stavu uživatele z DB (users.id = session.user.id).
 * 3. Striktní kontrola platnosti účtu: user.isActive === true && user.deletedAt === null.
 * 4. Sestavení neměnného ActorContextu na serveru.
 *
 * Pokud relace neexistuje, je neplatná, nebo je uživatel neaktivní či soft-deleted, vrací null.
 */
export async function resolveActorContext(
  requestOrHeaders: Request | Headers,
  options?: ResolveActorContextOptions,
): Promise<ActorContext | null> {
  const authInstance = options?.auth ?? defaultAuth;
  const headers =
    requestOrHeaders instanceof Request
      ? requestOrHeaders.headers
      : requestOrHeaders;

  const sessionResult = await authInstance.api.getSession({
    headers,
  });

  if (!sessionResult?.user?.id || !sessionResult?.session?.id) {
    return null;
  }

  const db = options?.db ?? getDb();
  const [currentUser] = await db
    .select({
      id: users.id,
      globalRole: users.globalRole,
      isActive: users.isActive,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, sessionResult.user.id))
    .limit(1);

  if (!currentUser || !currentUser.isActive || currentUser.deletedAt !== null) {
    return null;
  }

  return {
    actor_user_id: currentUser.id,
    global_role: currentUser.globalRole,
    session_id: sessionResult.session.id,
    is_active: currentUser.isActive,
  };
}
