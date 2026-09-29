import { z } from "zod";

/**
 * Validační schéma pro vytvoření Nástěnky (CreateBoard).
 * Slouží jako UX validace na klientovi i autoritativní validace na serveru (ADR-009).
 */
export const createBoardSchema = z.object({
  name: z
    .string({ required_error: "Zadejte prosím název nástěnky" })
    .trim()
    .min(1, "Název nástěnky nesmí být prázdný")
    .max(255, "Název nástěnky nesmí přesáhnout 255 znaků"),
  description: z
    .string()
    .trim()
    .max(1000, "Popis nesmí přesáhnout 1000 znaků")
    .optional()
    .or(z.literal("")),
});

export type CreateBoardDto = z.infer<typeof createBoardSchema>;
