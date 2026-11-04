import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";

async function main() {
  // Resolve from this file so an MCP host's working directory cannot create a second store.
  process.env.ARKEMX_STUDIO_DATA_DIR ||= fileURLToPath(new URL("../../data/", import.meta.url));
  const service = await import("../server/team-service");
  const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const idInput = z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/) }).strict();
  const result = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: { data } });
  const read = (operation: () => unknown) => {
    try { return result(operation()); }
    catch (error) { return { isError: true, content: [{ type: "text" as const, text: error instanceof Error ? error.message : "Kayıt okunamadı." }] }; }
  };

  const connection = serveStdio(() => {
    const server = new McpServer({ name: "arkemx-ai-studio", version: "0.1.0" });
    server.registerTool("list_team_members", {
      title: "Ekibi listele", description: "Yerel Studio veritabanındaki arşivlenmemiş AI çalışan profillerini okur. Profil yetkinliği doğrulanmış iş deneyimi değildir.",
      inputSchema: z.object({}).strict(), annotations,
    }, () => read(service.listTeamMembers));
    server.registerTool("get_team_member", {
      title: "Çalışan profilini oku", description: "Kimliği verilen ekip üyesinin profilini ve doğrulanabilir CV kayıtlarını okur. Herhangi bir modeli veya ajanı çalıştırmaz.",
      inputSchema: idInput, annotations,
    }, ({ id }) => read(() => service.getTeamMember(id)));
    server.registerTool("list_member_history", {
      title: "Profil değişiklik geçmişini oku", description: "Bir çalışanın kayıt değişikliklerinin zamanını ve sürümünü okur. Bu kayıtlar tamamlanmış iş veya teknik onay sayılmaz.",
      inputSchema: idInput, annotations,
    }, ({ id }) => read(() => service.getMemberHistory(id)));
    return server;
  }, { onerror: error => console.error("Studio MCP:", error.message) });

  process.on("SIGTERM", () => { void connection.close(); });
  process.on("SIGINT", () => { void connection.close(); });
}

main().catch(error => {
  console.error("Studio MCP başlatılamadı:", error instanceof Error ? error.message : "Bilinmeyen hata");
  process.exitCode = 1;
});
