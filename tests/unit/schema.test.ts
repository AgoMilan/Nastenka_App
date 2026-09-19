import assert from "node:assert/strict";
import { test, describe } from "node:test";
import {
  users,
  boards,
  memberships,
  globalRoleEnum,
  membershipRoleEnum,
  usersRelations,
  boardsRelations,
  membershipsRelations,
} from "../../database/schema/index.ts";
import { getTableName, getTableColumns } from "drizzle-orm";

describe("Database Schema Foundation (User, Board, Membership)", () => {
  test("tabulky mají správné SQL názvy", () => {
    assert.equal(getTableName(users), "users");
    assert.equal(getTableName(boards), "boards");
    assert.equal(getTableName(memberships), "memberships");
  });

  test("globalRoleEnum obsahuje pouze USER a ADMIN (nikoliv Membership role)", () => {
    assert.deepEqual(globalRoleEnum.enumValues, ["USER", "ADMIN"]);
    assert.ok(!globalRoleEnum.enumValues.includes("OWNER" as any));
    assert.ok(!globalRoleEnum.enumValues.includes("MANAGER" as any));
    assert.ok(!globalRoleEnum.enumValues.includes("MEMBER" as any));
  });

  test("membershipRoleEnum obsahuje pouze OWNER, MANAGER a MEMBER", () => {
    assert.deepEqual(membershipRoleEnum.enumValues, [
      "OWNER",
      "MANAGER",
      "MEMBER",
    ]);
  });

  test("tabulka users obsahuje všechna schválená pole", () => {
    const cols = getTableColumns(users);
    assert.ok(cols.id, "id musí existovat");
    assert.ok(cols.name, "name musí existovat");
    assert.ok(cols.email, "email musí existovat");
    assert.ok(cols.globalRole, "globalRole musí existovat");
    assert.ok(cols.isActive, "isActive musí existovat");
    assert.ok(cols.createdAt, "createdAt musí existovat");
    assert.ok(cols.updatedAt, "updatedAt musí existovat");
    assert.ok(cols.deletedAt, "deletedAt musí existovat");
  });

  test("tabulka boards obsahuje všechna schválená pole včetně createdBy", () => {
    const cols = getTableColumns(boards);
    assert.ok(cols.id, "id musí existovat");
    assert.ok(cols.name, "name musí existovat");
    assert.ok(cols.description, "description musí existovat");
    assert.ok(cols.createdBy, "createdBy musí existovat");
    assert.ok(cols.createdAt, "createdAt musí existovat");
    assert.ok(cols.updatedAt, "updatedAt musí existovat");
    assert.ok(cols.deletedAt, "deletedAt musí existovat");
  });

  test("tabulka memberships obsahuje všechna schválená pole", () => {
    const cols = getTableColumns(memberships);
    assert.ok(cols.id, "id musí existovat");
    assert.ok(cols.userId, "userId musí existovat");
    assert.ok(cols.boardId, "boardId musí existovat");
    assert.ok(cols.role, "role musí existovat");
    assert.ok(cols.createdAt, "createdAt musí existovat");
    assert.ok(cols.updatedAt, "updatedAt musí existovat");
  });

  test("relační definice pro User, Board a Membership jsou korektně inicializovány", () => {
    assert.ok(usersRelations, "usersRelations musí existovat");
    assert.ok(boardsRelations, "boardsRelations musí existovat");
    assert.ok(membershipsRelations, "membershipsRelations musí existovat");
  });
});
