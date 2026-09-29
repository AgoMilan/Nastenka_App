import { z } from "zod";

/**
 * Validační schémata pro operace s Úkoly (Task DTO).
 * Slouží jako UX validace na klientovi i autoritativní validace na serveru (ADR-009).
 */

export const taskStatusSchema = z.enum([
  "NOVÉ",
  "PŘEVZATÉ",
  "ROZPRACOVANÉ",
  "ČEKÁ SE",
  "HOTOVO",
  "ARCHIVOVÁNO",
]);

export type TaskStatusDto = z.infer<typeof taskStatusSchema>;

export const taskPrioritySchema = z.enum(["BĚŽNÁ", "SPĚCHÁ"]);

export type TaskPriorityDto = z.infer<typeof taskPrioritySchema>;

const optionalDueDateSchema = z
  .union([
    z.date(),
    z.string().refine((val) => val === "" || !isNaN(Date.parse(val)), {
      message: "Neplatný formát data termínu",
    }),
  ])
  .optional()
  .nullable();

export const createTaskSchema = z.object({
  boardId: z
    .string({ required_error: "ID Nástěnky je povinné" })
    .trim()
    .min(1, "ID Nástěnky nesmí být prázdné"),
  title: z
    .string({ required_error: "Zadejte prosím název úkolu" })
    .trim()
    .min(1, "Název úkolu nesmí být prázdný")
    .max(255, "Název úkolu nesmí přesáhnout 255 znaků"),
  description: z
    .string()
    .trim()
    .max(10000, "Popis nesmí přesáhnout 10 000 znaků")
    .optional()
    .nullable()
    .or(z.literal("")),
  areaId: z.string().trim().min(1).optional().nullable().or(z.literal("")),
  assigneeId: z.string().trim().min(1).optional().nullable().or(z.literal("")),
  priority: taskPrioritySchema.optional().default("BĚŽNÁ"),
  dueDate: optionalDueDateSchema,
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  title: z
    .string()
    .trim()
    .min(1, "Název úkolu nesmí být prázdný")
    .max(255, "Název úkolu nesmí přesáhnout 255 znaků")
    .optional(),
  description: z
    .string()
    .trim()
    .max(10000, "Popis nesmí přesáhnout 10 000 znaků")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;

export const editTaskSchema = z.object({
  boardId: z
    .string({ required_error: "ID Nástěnky je povinné" })
    .trim()
    .min(1, "ID Nástěnky nesmí být prázdné"),
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  title: z
    .string({ required_error: "Zadejte prosím název úkolu" })
    .trim()
    .min(1, "Název úkolu nesmí být prázdný")
    .max(255, "Název úkolu nesmí přesáhnout 255 znaků"),
  description: z
    .string()
    .trim()
    .max(10000, "Popis nesmí přesáhnout 10 000 znaků")
    .optional()
    .nullable()
    .or(z.literal("")),
  areaId: z.string().trim().min(1).optional().nullable().or(z.literal("")),
  assigneeId: z.string().trim().min(1).optional().nullable().or(z.literal("")),
  priority: taskPrioritySchema.default("BĚŽNÁ"),
  dueDate: optionalDueDateSchema,
});

export type EditTaskDto = z.infer<typeof editTaskSchema>;

export const changeTaskAssigneeSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  assigneeId: z.string().trim().min(1).nullable().optional().or(z.literal("")),
});

export type ChangeTaskAssigneeDto = z.infer<typeof changeTaskAssigneeSchema>;

export const changeTaskStatusSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  status: taskStatusSchema,
});

export type ChangeTaskStatusDto = z.infer<typeof changeTaskStatusSchema>;

export const changeTaskAreaSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  areaId: z.string().trim().min(1).nullable().optional().or(z.literal("")),
});

export type ChangeTaskAreaDto = z.infer<typeof changeTaskAreaSchema>;

export const changeTaskDueDateSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  dueDate: optionalDueDateSchema.or(z.literal("")),
});

export type ChangeTaskDueDateDto = z.infer<typeof changeTaskDueDateSchema>;

export const changeTaskPrioritySchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  priority: taskPrioritySchema,
});

export type ChangeTaskPriorityDto = z.infer<typeof changeTaskPrioritySchema>;

export const takeOverTaskSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
});

export type TakeOverTaskDto = z.infer<typeof takeOverTaskSchema>;

export const joinTaskAsParticipantSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
});

export type JoinTaskAsParticipantDto = z.infer<
  typeof joinTaskAsParticipantSchema
>;

export const leaveTaskAsParticipantSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  targetUserId: z.string().trim().min(1).optional(),
});

export type LeaveTaskAsParticipantDto = z.infer<
  typeof leaveTaskAsParticipantSchema
>;

export const removeTaskParticipantSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  participantUserId: z
    .string({ required_error: "ID spoluřešitele je povinné" })
    .trim()
    .min(1, "ID spoluřešitele nesmí být prázdné"),
});

export type RemoveTaskParticipantDto = z.infer<
  typeof removeTaskParticipantSchema
>;

export const archiveTaskSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
});

export type ArchiveTaskDto = z.infer<typeof archiveTaskSchema>;

export const deleteTaskSchema = z.object({
  taskId: z
    .string({ required_error: "ID úkolu je povinné" })
    .trim()
    .min(1, "ID úkolu nesmí být prázdné"),
  confirmation: z.literal("SMAZAT", {
    errorMap: () => ({
      message:
        "Pro smazání úkolu je vyžadováno přesné potvrzení textem 'SMAZAT'.",
    }),
  }),
});

export type DeleteTaskDto = z.infer<typeof deleteTaskSchema>;
