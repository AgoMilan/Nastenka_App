import type { AppError } from "../errors/app-error.ts";

/**
 * Result / Error Pattern pro aplikační a infrastrukturní vrstvy.
 * Zabraňuje nekontrolovanému vyhazování výjimek pro očekávané byznys stavy.
 *
 * Reference: docs/050_Architektura.md §35.38.
 */
export type Result<T, E = AppError> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

export const ok = <T>(data: T): Result<T, never> => ({
  success: true,
  data,
});

export const err = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
});
