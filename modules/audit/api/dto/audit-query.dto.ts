import { z } from "zod";

/**
 * Validační schémata pro dotazování do auditního logu (Audit Query DTO).
 */
export const getTaskAuditHistorySchema = z.object({
  boardId: z
    .string({ required_error: "ID nástěnky je povinné" })
    .trim()
    .min(1, "ID nástěnky nesmí být prázdné"),
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
});

export type GetTaskAuditHistoryDto = z.infer<typeof getTaskAuditHistorySchema>;

export const getBoardAuditHistorySchema = z.object({
  boardId: z
    .string({ required_error: "ID nástěnky je povinné" })
    .trim()
    .min(1, "ID nástěnky nesmí být prázdné"),
});

export type GetBoardAuditHistoryDto = z.infer<typeof getBoardAuditHistorySchema>;
