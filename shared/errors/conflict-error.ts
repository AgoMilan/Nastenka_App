import { AppError } from "./app-error.ts";

/**
 * Chyba konfliktu stavu nebo doménového invariantu (HTTP 409 Conflict).
 *
 * Vyvolává se při:
 * - pokusu o převod vlastnictví na sebe sama (současného Ownera),
 * - porušení strukturálního invariantu (např. překročení kapacity Managera),
 * - souběžném konfliktu při změně vlastnictví nebo členství.
 *
 * Reference: docs/050_Architektura.md §35.17.
 */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = "CONFLICT";

  constructor(message = "Operace nemůže být dokončena kvůli konfliktu stavu.") {
    super(message);
  }
}
