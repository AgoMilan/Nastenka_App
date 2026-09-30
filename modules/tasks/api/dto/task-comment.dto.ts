import { z } from "zod";

/**
 * Validační schémata pro operace s komentáři úkolu (Task Comment DTO).
 * Invarianty (STEP 8):
 * 1. content: trim, min 1 znak, max 5000 znaků.
 * 2. authorId nikdy nepřijímáme z klienta; server ho autoritativně přebírá z ActorContext.
 */

export const createTaskCommentSchema = z.object({
  boardId: z
    .string({ required_error: "ID nástěnky je povinné" })
    .trim()
    .min(1, "ID nástěnky nesmí být prázdné"),
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  content: z
    .string({ required_error: "Zadejte prosím text komentáře" })
    .trim()
    .min(1, "Komentář nesmí být prázdný")
    .max(5000, "Komentář nesmí přesáhnout 5000 znaků"),
});

export type CreateTaskCommentDto = z.infer<typeof createTaskCommentSchema>;

export const updateTaskCommentSchema = z.object({
  boardId: z
    .string({ required_error: "ID nástěnky je povinné" })
    .trim()
    .min(1, "ID nástěnky nesmí být prázdné"),
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  commentId: z
    .string({ required_error: "ID komentáře je povinné" })
    .trim()
    .min(1, "ID komentáře nesmí být prázdné"),
  content: z
    .string({ required_error: "Zadejte prosím text komentáře" })
    .trim()
    .min(1, "Komentář nesmí být prázdný")
    .max(5000, "Komentář nesmí přesáhnout 5000 znaků"),
});

export type UpdateTaskCommentDto = z.infer<typeof updateTaskCommentSchema>;

export const deleteTaskCommentSchema = z.object({
  boardId: z
    .string({ required_error: "ID nástěnky je povinné" })
    .trim()
    .min(1, "ID nástěnky nesmí být prázdné"),
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  commentId: z
    .string({ required_error: "ID komentáře je povinné" })
    .trim()
    .min(1, "ID komentáře nesmí být prázdné"),
});

export type DeleteTaskCommentDto = z.infer<typeof deleteTaskCommentSchema>;

export const getTaskCommentsSchema = z.object({
  boardId: z
    .string({ required_error: "ID nástěnky je povinné" })
    .trim()
    .min(1, "ID nástěnky nesmí být prázdné"),
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
});

export type GetTaskCommentsDto = z.infer<typeof getTaskCommentsSchema>;
