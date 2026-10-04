import { z } from "zod";

/**
 * Validační schémata pro operace se soukromými poznámkami k úkolu (User Task Note DTO).
 *
 * Invarianty (Soukromé poznámky):
 * 1. content: trim, min 1 znak, max 5000 znaků.
 * 2. userId se NIKDY nepřebírá z klienta – server ho autoritativně určuje z ActorContextu.
 * 3. Prázdný nebo pouze mezerový obsah není validní.
 */

export const getUserTaskNoteSchema = z.object({
  boardId: z
    .string({ required_error: "ID nástěnky je povinné" })
    .trim()
    .min(1, "ID nástěnky nesmí být prázdné"),
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
});

export type GetUserTaskNoteDto = z.infer<typeof getUserTaskNoteSchema>;

export const upsertUserTaskNoteSchema = z.object({
  boardId: z
    .string({ required_error: "ID nástěnky je povinné" })
    .trim()
    .min(1, "ID nástěnky nesmí být prázdné"),
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  content: z
    .string({ required_error: "Zadejte prosím text poznámky" })
    .trim()
    .min(1, "Poznámka nesmí být prázdná")
    .max(5000, "Poznámka nesmí přesáhnout 5000 znaků"),
});

export type UpsertUserTaskNoteDto = z.infer<typeof upsertUserTaskNoteSchema>;

export const deleteUserTaskNoteSchema = z.object({
  boardId: z
    .string({ required_error: "ID nástěnky je povinné" })
    .trim()
    .min(1, "ID nástěnky nesmí být prázdné"),
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
});

export type DeleteUserTaskNoteDto = z.infer<typeof deleteUserTaskNoteSchema>;
