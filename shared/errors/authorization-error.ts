import { AppError } from "./app-error.ts";

/**
 * Chyba nedostatečného oprávnění volajícího (HTTP 403 Forbidden).
 *
 * Vyvolává se při:
 * - platném a ověřeném uživateli, který však nemá požadované oprávnění,
 * - nepovolené roli na Nástěnce (MEMBER místo OWNER/MANAGER),
 * - nepovoleném vztahu k úkolu (není řešitel ani spoluřešitel),
 * - pokusu o přístup k objektu z jiné Nástěnky (CROSS_BOARD_ACCESS),
 * - pokusu o manipulaci se soft-deleted Nástěnkou (BOARD_DELETED),
 * - porušení specifických autorizačních pravidel (např. TASK_HAS_NO_ASSIGNEE, CANNOT_LEAVE_OTHER_PARTICIPANT).
 *
 * Reference: docs/050_Architektura.md §35.17.
 */
export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly code = "FORBIDDEN";
  readonly reason?: string;

  constructor(
    message = "K provedení této akce nemáte dostatečné oprávnění.",
    reason?: string,
  ) {
    super(message);
    this.reason = reason;
  }

  override toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.reason ? { reason: this.reason } : {}),
      },
    };
  }
}
