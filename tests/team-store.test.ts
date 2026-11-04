import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TeamStore } from "../src/server/sqlite-store";
import { memberInputSchema, memberUpdateSchema } from "../src/server/validation";
import { SEED_TEAM } from "../src/domain/seed";
import { assertLocalRequest } from "../src/server/http";
import { StudioError } from "../src/server/errors";

let directory: string;
let path: string;
let store: TeamStore;

before(() => {
  directory = mkdtempSync(join(tmpdir(), "arkemx-team-tests-"));
  path = join(directory, "test.sqlite");
  store = new TeamStore(path);
});

after(() => {
  store.close();
  unlinkSync(path);
  rmdirSync(directory);
});

test("initial profiles contain no invented experience or connected model", () => {
  assert.equal(store.list().length, 5);
  for (const member of store.list()) {
    assert.equal(member.modelStatus, "disconnected");
    assert.deepEqual(member.experience, []);
  }
});

test("updates persist between separate database connections", () => {
  const updated = store.update("ada", 1, { workingStyle: "Doğrulanmış kalıcılık denemesi" });
  assert.equal(updated.revision, 2);
  const otherConnection = new TeamStore(path);
  try { assert.equal(otherConnection.get("ada").workingStyle, updated.workingStyle); }
  finally { otherConnection.close(); }
});

test("stale revision cannot overwrite a newer profile or add audit events", () => {
  assert.throws(() => store.update("ada", 1, { name: "Stale" }), (error: unknown) => error instanceof StudioError && error.status === 409);
  assert.equal(store.get("ada").name, "Ada");
  assert.equal(store.get("ada").revision, 2);
  assert.equal(store.history("ada").length, 1);
});

test("archiving is persistent and seed does not resurrect an archived profile", () => {
  store.archive("selin", 1);
  assert.throws(() => store.get("selin"), (error: unknown) => error instanceof StudioError && error.status === 404);
  const otherConnection = new TeamStore(path);
  try {
    assert.equal(otherConnection.list().length, 4);
    assert.equal(otherConnection.history("selin")[0].action, "archived");
  } finally { otherConnection.close(); }
});

test("client cannot forge experience, model connection, or identity fields", () => {
  assert.equal(memberUpdateSchema.safeParse({ revision: 1, experience: [{ title: "Fake" }] }).success, false);
  assert.equal(memberUpdateSchema.safeParse({ revision: 1, modelStatus: "connected" }).success, false);
  assert.equal(memberUpdateSchema.safeParse({ revision: 1, id: "other" }).success, false);
});

test("input rejects empty names, unknown departments and oversized lists", () => {
  const member = SEED_TEAM[0];
  const input = { name: member.name, role: member.role, department: member.department, description: member.description, skills: member.skills, responsibilities: member.responsibilities, workingStyle: member.workingStyle, color: member.color, avatarKey: member.avatarKey, project: member.project };
  assert.equal(memberInputSchema.safeParse(input).success, true);
  assert.equal(memberInputSchema.safeParse({ ...input, name: "   " }).success, false);
  assert.equal(memberInputSchema.safeParse({ ...input, department: "Unknown" }).success, false);
  assert.equal(memberInputSchema.safeParse({ ...input, skills: Array(13).fill("test") }).success, false);
});

test("local mutation accepts trusted origin and rejects foreign or missing origins", () => {
  const valid = new Request("http://127.0.0.1:3100/api/team", { headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" } });
  assert.doesNotThrow(() => assertLocalRequest(valid, true));
  const missing = new Request(valid.url, { headers: { host: "127.0.0.1:3100" } });
  assert.throws(() => assertLocalRequest(missing, true));
  const foreign = new Request(valid.url, { headers: { host: "127.0.0.1:3100", origin: "https://example.com" } });
  assert.throws(() => assertLocalRequest(foreign, true));
});

test("local API rejects untrusted Host headers", () => {
  const request = new Request("http://127.0.0.1:3100/api/team", { headers: { host: "example.com:3100", origin: "http://127.0.0.1:3100" } });
  assert.throws(() => assertLocalRequest(request, true));
});
