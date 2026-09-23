/**
 * Základní abstraktní třída pro všechny doménové a aplikační chyby systému.
 * Reference: docs/050_Architektura.md §35.17.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }
}
