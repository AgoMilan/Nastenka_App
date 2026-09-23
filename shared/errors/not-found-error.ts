import { AppError } from "./app-error.ts";

/**
 * Chyba nenalezeného zdroje nebo entity (HTTP 404 Not Found).
 *
 * Vyvolává se při:
 * - pokusu o přístup k neexistující Nástěnce,
 * - neexistujícím uživateli nebo členství.
 *
 * Reference: docs/050_Architektura.md §35.17.
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = "NOT_FOUND";

  constructor(message = "Požadovaný zdroj nebyl nalezen.") {
    super(message);
  }
}
