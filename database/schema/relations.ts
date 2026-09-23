import { relations } from "drizzle-orm";
import { users } from "./users.ts";
import { sessions } from "./sessions.ts";
import { accounts } from "./accounts.ts";
import { boards } from "./boards.ts";
import { memberships } from "./memberships.ts";
import { areas } from "./areas.ts";
import { tasks } from "./tasks.ts";
import { taskParticipants } from "./task-participants.ts";
import { auditLogs } from "./audit-logs.ts";
import { notifications } from "./notifications.ts";
import { outbox } from "./outbox.ts";

/**
 * Relační vazby pro uživatele (User).
 */
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  createdBoards: many(boards),
  memberships: many(memberships),
  createdTasks: many(tasks, { relationName: "taskCreator" }),
  assignedTasks: many(tasks, { relationName: "taskAssignee" }),
  participations: many(taskParticipants),
  auditLogs: many(auditLogs),
  notifications: many(notifications),
  outboxEvents: many(outbox),
}));

/**
 * Relační vazby pro Nástěnku (Board).
 */
export const boardsRelations = relations(boards, ({ one, many }) => ({
  creator: one(users, {
    fields: [boards.createdBy],
    references: [users.id],
  }),
  memberships: many(memberships),
  areas: many(areas),
  tasks: many(tasks),
  auditLogs: many(auditLogs),
  outboxEvents: many(outbox),
}));

/**
 * Relační vazby pro členství (Membership).
 */
export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, {
    fields: [memberships.userId],
    references: [users.id],
  }),
  board: one(boards, {
    fields: [memberships.boardId],
    references: [boards.id],
  }),
}));

/**
 * Relační vazby pro organizační oblast (Area).
 */
export const areasRelations = relations(areas, ({ one, many }) => ({
  board: one(boards, {
    fields: [areas.boardId],
    references: [boards.id],
  }),
  tasks: many(tasks),
}));

/**
 * Relační vazby pro úkol (Task).
 */
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  board: one(boards, {
    fields: [tasks.boardId],
    references: [boards.id],
  }),
  area: one(areas, {
    fields: [tasks.areaId],
    references: [areas.id],
  }),
  creator: one(users, {
    fields: [tasks.createdBy],
    references: [users.id],
    relationName: "taskCreator",
  }),
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "taskAssignee",
  }),
  participants: many(taskParticipants),
}));

/**
 * Relační vazby pro spoluřešitele úkolu (TaskParticipant).
 */
export const taskParticipantsRelations = relations(
  taskParticipants,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskParticipants.taskId],
      references: [tasks.id],
    }),
    user: one(users, {
      fields: [taskParticipants.userId],
      references: [users.id],
    }),
  }),
);

/**
 * Relační vazby pro auditní záznam (AuditLog).
 * POZOR: target_id záměrně nemá relační vazbu, protože cíl může být hard-deleted.
 */
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorUserId],
    references: [users.id],
  }),
  board: one(boards, {
    fields: [auditLogs.boardId],
    references: [boards.id],
  }),
}));

/**
 * Relační vazby pro notifikace (Notification).
 */
export const notificationsRelations = relations(notifications, ({ one }) => ({
  recipient: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id],
  }),
}));

/**
 * Relační vazby pro transakční outbox (Outbox).
 */
export const outboxRelations = relations(outbox, ({ one }) => ({
  actor: one(users, {
    fields: [outbox.actorUserId],
    references: [users.id],
  }),
  board: one(boards, {
    fields: [outbox.boardId],
    references: [boards.id],
  }),
}));

/**
 * Relační vazby pro aktivní relace (Session).
 */
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

/**
 * Relační vazby pro autentizační účty (Account).
 */
export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));
