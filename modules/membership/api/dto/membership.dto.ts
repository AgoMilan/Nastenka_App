import { z } from "zod";

/**
 * Validační schémata pro operace se správou členství na Nástěnce (Membership DTO).
 * Slouží jako UX validace na klientovi i autoritativní validace na serveru (ADR-009).
 */

export const addMemberSchema = z.object({
  boardId: z
    .string({ required_error: "ID Nástěnky je povinné" })
    .trim()
    .min(1, "ID Nástěnky nesmí být prázdné"),
  userId: z
    .string({ required_error: "Vyberte prosím uživatele" })
    .trim()
    .min(1, "Vyberte prosím uživatele"),
  role: z
    .enum(["MEMBER", "MANAGER"], {
      errorMap: () => ({
        message: "Neplatná role člena. Povoleny jsou pouze 'MEMBER' a 'MANAGER'.",
      }),
    })
    .default("MEMBER"),
});

export type AddMemberDto = z.infer<typeof addMemberSchema>;

export const changeMemberRoleSchema = z.object({
  boardId: z
    .string({ required_error: "ID Nástěnky je povinné" })
    .trim()
    .min(1, "ID Nástěnky nesmí být prázdné"),
  targetUserId: z
    .string({ required_error: "ID cílového uživatele je povinné" })
    .trim()
    .min(1, "ID cílového uživatele nesmí být prázdné"),
  newRole: z.enum(["MEMBER", "MANAGER"], {
    errorMap: () => ({
      message: "Neplatná role. Povoleny jsou pouze 'MEMBER' nebo 'MANAGER'.",
    }),
  }),
});

export type ChangeMemberRoleDto = z.infer<typeof changeMemberRoleSchema>;

export const removeMemberSchema = z.object({
  boardId: z
    .string({ required_error: "ID Nástěnky je povinné" })
    .trim()
    .min(1, "ID Nástěnky nesmí být prázdné"),
  targetUserId: z
    .string({ required_error: "ID cílového uživatele je povinné" })
    .trim()
    .min(1, "ID cílového uživatele nesmí být prázdné"),
});

export type RemoveMemberDto = z.infer<typeof removeMemberSchema>;

export const leaveBoardSchema = z.object({
  boardId: z
    .string({ required_error: "ID Nástěnky je povinné" })
    .trim()
    .min(1, "ID Nástěnky nesmí být prázdné"),
});

export type LeaveBoardDto = z.infer<typeof leaveBoardSchema>;
