import { AppError } from "./app-error.ts";

/**
 * Chyba neověřené identity volajícího (HTTP 401 Unauthorized).
 *
 * Vyvolává se při:
 * - chybějící session nebo tokenu,
 * - expirované nebo neplatné session,
 * - neexistujícím ActorContextu,
 * - neaktivním nebo deaktivovaném (soft-deleted) uživateli.
 *
 * Reference: docs/050_Architektura.md §35.17.
 */
export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly code = "UNAUTHORIZED";

  constructor(
    message = "Platnost vašeho přihlášení vypršela nebo relace neexistuje. Přihlaste se prosím znovu.",
  ) {
    super(message);
  }
}
