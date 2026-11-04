import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import { TeamStore } from "../src/server/sqlite-store";

test("real MCP connection reads shared persisted records and exposes only read tools", { timeout: 30_000 }, async () => {
  const projectRoot = fileURLToPath(new URL("../", import.meta.url));
  const directory = mkdtempSync(join(tmpdir(), "arkemx-mcp-tests-"));
  const store = new TeamStore(join(directory, "studio.sqlite"));
  store.update("ece", 1, { workingStyle: "MCP ve arayüz aynı kalıcı kaydı okur." });
  store.close();
  const client = new Client({ name: "studio-tests", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"), join(projectRoot, "src", "mcp", "server.ts")],
    cwd: tmpdir(),
    env: { ...getDefaultEnvironment(), ARKEMX_STUDIO_DATA_DIR: directory },
    stderr: "pipe",
  });
  let diagnostics = "";
  transport.stderr?.on("data", chunk => { diagnostics += String(chunk); });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name).sort(), ["get_team_member", "list_member_history", "list_team_members"]);
    for (const tool of tools) assert.equal(tool.annotations?.readOnlyHint, true);
    const list = await client.callTool({ name: "list_team_members", arguments: {} });
    assert.equal(list.isError, undefined);
    const data = list.structuredContent as { data: Array<{ id: string }> };
    assert.equal(data.data.length, 5);
    const record = await client.callTool({ name: "get_team_member", arguments: { id: "ece" } });
    const member = record.structuredContent as { data: { workingStyle: string; revision: number } };
    assert.equal(member.data.workingStyle, "MCP ve arayüz aynı kalıcı kaydı okur.");
    assert.equal(member.data.revision, 2);
    const history = await client.callTool({ name: "list_member_history", arguments: { id: "ece" } });
    assert.equal((history.structuredContent as { data: unknown[] }).data.length, 1);
    const unsupported = await client.callTool({ name: "delete_team_member", arguments: { id: "ece" } }).catch(() => null);
    assert.ok(unsupported === null || unsupported.isError);
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : error}\n${diagnostics.slice(-3000)}`, { cause: error });
  } finally {
    await client.close();
    await transport.close();
    for (const file of readdirSync(directory)) unlinkSync(join(directory, file));
    rmdirSync(directory);
  }
});
