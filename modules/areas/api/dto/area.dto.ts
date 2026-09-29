import { z } from "zod";

/**
 * Validační schémata pro operace s Oblastmi (Area DTO).
 * Slouží jako UX validace na klientovi i autoritativní validace na serveru (ADR-009).
 */

export const createAreaSchema = z.object({
  boardId: z
    .string({ required_error: "ID Nástěnky je povinné" })
    .trim()
    .min(1, "ID Nástěnky nesmí být prázdné"),
  name: z
    .string({ required_error: "Zadejte prosím název oblasti" })
    .trim()
    .min(1, "Název oblasti nesmí být prázdný")
    .max(255, "Název oblasti nesmí přesáhnout 255 znaků"),
  description: z
    .string()
    .trim()
    .max(1000, "Popis nesmí přesáhnout 1000 znaků")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type CreateAreaDto = z.infer<typeof createAreaSchema>;

export const updateAreaSchema = z.object({
  areaId: z
    .string({ required_error: "ID oblasti je povinné" })
    .trim()
    .min(1, "ID oblasti nesmí být prázdné"),
  name: z
    .string()
    .trim()
    .min(1, "Název oblasti nesmí být prázdný")
    .max(255, "Název oblasti nesmí přesáhnout 255 znaků")
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, "Popis nesmí přesáhnout 1000 znaků")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type UpdateAreaDto = z.infer<typeof updateAreaSchema>;

export const deleteAreaSchema = z.object({
  areaId: z
    .string({ required_error: "ID oblasti je povinné" })
    .trim()
    .min(1, "ID oblasti nesmí být prázdné"),
  confirmation: z.literal("SMAZAT", {
    errorMap: () => ({
      message:
        "Pro smazání oblasti je vyžadováno přesné potvrzení textem 'SMAZAT'.",
    }),
  }),
});

export type DeleteAreaDto = z.infer<typeof deleteAreaSchema>;
