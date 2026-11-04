
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/client";
import { canEceUseTool } from "@/agents/ece";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/client/stdio";

export async function listTeamMembersViaMcp(): Promise<unknown[]> {
  const root = process.cwd();

  const client = new Client({
    name: "ece-agent",
    version: "0.4.0",
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      join(root, "node_modules", "tsx", "dist", "cli.mjs"),
      join(root, "src", "mcp", "server.ts"),
    ],
    cwd: root,
    env: {
      ...getDefaultEnvironment(),
      ARKEMX_STUDIO_DATA_DIR: join(root, "data"),
    },
    stderr: "pipe",
  });

  try {
    await client.connect(transport);

    const response = await client.callTool({
      name: "list_team_members",
      arguments: {},
    });

    if (response.isError) {
      throw new Error("MCP ekip kayıtları okunamadı.");
    }

    const content = response.structuredContent as
      | { data?: unknown }
      | undefined;

    if (!Array.isArray(content?.data)) {
      throw new Error("MCP beklenen ekip listesini döndürmedi.");
    }

    return content.data;
  } finally {
    await client.close();
  }
}

export async function callEceMcpTool(
  name: string,
  input: unknown = {}
): Promise<unknown> {
  // Ece'nin sadece izin verilen araçları kullanmasını sağla
  if (!canEceUseTool(name)) {
    throw new Error(`İzinsiz MCP aracı: ${name}`);
  }

  let args: Record<string, unknown> = {};

  if (name !== "list_team_members") {
    const raw =
      input !== null &&
      typeof input === "object" &&
      !Array.isArray(input)
        ? (input as Record<string, unknown>)
        : {};

    const id =
      typeof raw.id === "string"
        ? raw.id.trim().toLowerCase()
        : "";

    if (!/^[a-z0-9_-]{1,80}$/.test(id)) {
      throw new Error("Geçerli çalışan kimliği gerekli.");
    }

    args = { id };
  }

  const root = process.cwd();

  const client = new Client({
    name: "ece-tool-client",
    version: "0.4.2",
  });

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      join(root, "node_modules", "tsx", "dist", "cli.mjs"),
      join(root, "src", "mcp", "server.ts"),
    ],
    cwd: root,
    env: {
      ...getDefaultEnvironment(),
      ARKEMX_STUDIO_DATA_DIR: join(root, "data"),
    },
    stderr: "pipe",
  });

  try {
    await client.connect(transport);

    const response = await client.callTool({
      name,
      arguments: args,
    });

    if (response.isError) {
      throw new Error(`MCP aracı başarısız: ${name}`);
    }

    const result = response.structuredContent as
      | { data?: unknown }
      | undefined;

    if (result?.data === undefined) {
      throw new Error("MCP geçerli veri döndürmedi.");
    }

    console.log("Ece MCP aracı çalıştı:", name);

    return result.data;
  } finally {
    await client.close();
  }
}
