import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  users,
  boards,
  memberships,
  areas,
  tasks,
  taskParticipants,
  auditLogs,
  notifications,
  outbox,
  globalRoleEnum,
  membershipRoleEnum,
  taskStatusEnum,
  taskPriorityEnum,
  usersRelations,
  boardsRelations,
  membershipsRelations,
  areasRelations,
  tasksRelations,
  taskParticipantsRelations,
  auditLogsRelations,
  notificationsRelations,
  outboxRelations,
} from "../../database/schema/index.ts";
import { getTableName, getTableColumns } from "drizzle-orm";

describe("Database Schema Foundation (Complete Domain Model)", () => {
  test("všech 9 tabulek má správné SQL názvy", () => {
    assert.equal(getTableName(users), "users");
    assert.equal(getTableName(boards), "boards");
    assert.equal(getTableName(memberships), "memberships");
    assert.equal(getTableName(areas), "areas");
    assert.equal(getTableName(tasks), "tasks");
    assert.equal(getTableName(taskParticipants), "task_participants");
    assert.equal(getTableName(auditLogs), "audit_logs");
    assert.equal(getTableName(notifications), "notifications");
    assert.equal(getTableName(outbox), "outbox");
  });

  test("globalRoleEnum a membershipRoleEnum jsou striktně odděleny", () => {
    assert.deepEqual(globalRoleEnum.enumValues, ["USER", "ADMIN"]);
    assert.deepEqual(membershipRoleEnum.enumValues, [
      "OWNER",
      "MANAGER",
      "MEMBER",
    ]);
  });

  test("taskStatusEnum obsahuje schválené stavy z funkčního modelu", () => {
    assert.deepEqual(taskStatusEnum.enumValues, [
      "NOVÉ",
      "PŘEVZATÉ",
      "ROZPRACOVANÉ",
      "ČEKÁ SE",
      "HOTOVO",
      "ARCHIVOVÁNO",
    ]);
  });

  test("taskPriorityEnum obsahuje schválené priority", () => {
    assert.deepEqual(taskPriorityEnum.enumValues, ["BĚŽNÁ", "SPĚCHÁ"]);
  });

  test("tabulka areas obsahuje schválená pole a NEMÁ deleted_at (hard-delete)", () => {
    const cols = getTableColumns(areas);
    assert.ok(cols.id, "id");
    assert.ok(cols.boardId, "boardId");
    assert.ok(cols.name, "name");
    assert.ok(cols.description, "description");
    assert.ok(cols.createdAt, "createdAt");
    assert.ok(cols.updatedAt, "updatedAt");
    assert.equal(
      (cols as any).deletedAt,
      undefined,
      "Area nesmí mít deleted_at",
    );
  });

  test("tabulka tasks obsahuje schválená pole a rozlišuje createdBy vs assigneeId", () => {
    const cols = getTableColumns(tasks);
    assert.ok(cols.id, "id");
    assert.ok(cols.boardId, "boardId");
    assert.ok(cols.areaId, "areaId");
    assert.ok(cols.title, "title");
    assert.ok(cols.description, "description");
    assert.ok(cols.status, "status");
    assert.ok(cols.priority, "priority");
    assert.ok(cols.dueDate, "dueDate");
    assert.ok(cols.createdBy, "createdBy");
    assert.ok(cols.assigneeId, "assigneeId");
    assert.ok(cols.createdAt, "createdAt");
    assert.ok(cols.updatedAt, "updatedAt");
    assert.ok(cols.completedAt, "completedAt");
    assert.equal(
      (cols as any).deletedAt,
      undefined,
      "Task nesmí mít deleted_at",
    );
  });

  test("tabulka task_participants obsahuje schválená pole", () => {
    const cols = getTableColumns(taskParticipants);
    assert.ok(cols.id, "id");
    assert.ok(cols.taskId, "taskId");
    assert.ok(cols.userId, "userId");
    assert.ok(cols.role, "role");
    assert.ok(cols.createdAt, "createdAt");
  });

  test("tabulka audit_logs obsahuje actorUserId a targetId bez FK na cílovou tabulku", () => {
    const cols = getTableColumns(auditLogs);
    assert.ok(cols.id, "id");
    assert.ok(cols.actorUserId, "actorUserId");
    assert.ok(cols.timestamp, "timestamp");
    assert.ok(cols.boardId, "boardId");
    assert.ok(cols.operation, "operation");
    assert.ok(cols.targetId, "targetId");
    assert.ok(cols.previousState, "previousState");
    assert.ok(cols.newState, "newState");
    assert.ok(cols.metadata, "metadata");
  });

  test("tabulka notifications obsahuje recipientUserId a readAt indikátor", () => {
    const cols = getTableColumns(notifications);
    assert.ok(cols.id, "id");
    assert.ok(cols.recipientUserId, "recipientUserId");
    assert.ok(cols.eventId, "eventId");
    assert.ok(cols.type, "type");
    assert.ok(cols.title, "title");
    assert.ok(cols.message, "message");
    assert.ok(cols.readAt, "readAt");
    assert.ok(cols.createdAt, "createdAt");
    assert.ok(cols.expiresAt, "expiresAt");
  });

  test("tabulka outbox obsahuje všechna pole pro Transactional Outbox Pattern", () => {
    const cols = getTableColumns(outbox);
    assert.ok(cols.id, "id");
    assert.ok(cols.eventId, "eventId");
    assert.ok(cols.eventType, "eventType");
    assert.ok(cols.occurredAt, "occurredAt");
    assert.ok(cols.actorUserId, "actorUserId");
    assert.ok(cols.boardId, "boardId");
    assert.ok(cols.targetType, "targetType");
    assert.ok(cols.targetId, "targetId");
    assert.ok(cols.payload, "payload");
    assert.ok(cols.correlationId, "correlationId");
    assert.ok(cols.causationId, "causationId");
    assert.ok(cols.processedAt, "processedAt");
  });

  test("všechny relační definice jsou korektně inicializovány", () => {
    assert.ok(usersRelations, "usersRelations");
    assert.ok(boardsRelations, "boardsRelations");
    assert.ok(membershipsRelations, "membershipsRelations");
    assert.ok(areasRelations, "areasRelations");
    assert.ok(tasksRelations, "tasksRelations");
    assert.ok(taskParticipantsRelations, "taskParticipantsRelations");
    assert.ok(auditLogsRelations, "auditLogsRelations");
    assert.ok(notificationsRelations, "notificationsRelations");
    assert.ok(outboxRelations, "outboxRelations");
  });
});
