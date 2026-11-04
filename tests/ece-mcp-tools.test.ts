
import { test } from "node:test";
import assert from "node:assert/strict";

import { callEceMcpTool } from "../src/server/ece-mcp";

test(
  "Ece üç MCP aracından gerçek kayıt okuyabilir",
  { timeout: 30000 },
  async () => {
    const team = await callEceMcpTool(
      "list_team_members",
      {}
    );

    assert.ok(Array.isArray(team));
    assert.ok(
      team.some((member) => member.id === "ece")
    );

    const ada = await callEceMcpTool(
      "get_team_member",
      { id: "ada" }
    );

    assert.equal(
      (ada as { id: string }).id,
      "ada"
    );

    const history = await callEceMcpTool(
      "list_member_history",
      { id: "deniz" }
    );

    assert.ok(Array.isArray(history));
  }
);

test("Ece izinsiz MCP aracını reddeder", async () => {
  await assert.rejects(
    callEceMcpTool("delete_team_member", { id: "ada" }),
    /İzinsiz MCP aracı/
  );
});

test("Ece geçersiz çalışan kimliğini reddeder", async () => {
  await assert.rejects(
    callEceMcpTool("get_team_member", { id: "../secret" }),
    /Geçerli çalışan kimliği/
  );
});
