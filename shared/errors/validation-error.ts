import { AppError } from "./app-error.ts";

/**
 * Chyba neplatných vstupních dat nebo parametrů požadavku (HTTP 400 Bad Request).
 *
 * Vyvolává se při:
 * - prázdném nebo příliš dlouhém názvu Nástěnky,
 * - neplatném formátu identifikátoru,
 * - porušení formátových a syntaktických pravidel vstupních dat.
 *
 * Reference: docs/050_Architektura.md §35.17.
 */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = "VALIDATION_ERROR";

  constructor(message = "Vstupní data jsou neplatná.") {
    super(message);
  }
}
