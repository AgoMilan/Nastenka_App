import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { GET } from "../../app/api/health/route.ts";

describe("Health API (/api/health)", () => {
  test("GET /api/health vrací HTTP 200 a status: ok", async () => {
    const response = GET();
    assert.equal(response.status, 200);

    const data = (await response.json()) as { status: string; timestamp: string };
    assert.equal(data.status, "ok");
    assert.ok(typeof data.timestamp === "string");
  });
});
