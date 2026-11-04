
import { eceAgent } from "@/agents/ece";
import { StudioError } from "@/server/errors";
import { listEceMessages } from "@/server/ece-memory";
import { callEceMcpTool } from "@/server/ece-mcp";

type ToolCall = {
  function: {
    name: string;
    arguments?: unknown;
  };
};

type OllamaResponse = {
  message?: {
    content?: string;
    tool_calls?: ToolCall[];
  };
  done_reason?: string;
};

const tools = [
  {
    type: "function",
    function: {
      name: "list_team_members",
      description: "ARKEMX Studio'daki güncel ekip üyelerini listele.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_team_member",
      description:
        "Tek bir çalışanın profilini getir. Kimlikler: ece, ada, deniz, bora, selin.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Çalışan kimliği",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_member_history",
      description:
        "Bir çalışanın profil değişiklik geçmişini getir. Tamamlanan görevleri göstermez.",
      parameters: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Çalışan kimliği",
          },
        },
        required: ["id"],
      },
    },
  },
];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StudioError(502, "MCP kayıt biçimi geçersiz.");
  }
  return value as Record<string, unknown>;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "Belirtilmemiş";
}

function formatToolResult(name: string, data: unknown): string {
  if (name === "list_team_members") {
    if (!Array.isArray(data)) {
      throw new StudioError(502, "Ekip listesi geçersiz.");
    }

    const lines = data.map((item: unknown) => {
      const member = asRecord(item);

      return `- **${asText(member.name)}** — ${asText(member.role)}`;
    });

    return [
      "### ARKEMX Studio ekibi",
      "",
      ...lines,
      "",
      "_Bunlar kayıtlı profillerdir; tamamının aktif çalışan AI ajanları olduğu anlamına gelmez._",
    ].join("\n");
  }

  if (name === "get_team_member") {
    const member = asRecord(data);

    return [
      `### ${asText(member.name)}`,
      "",
      `**Görev:** ${asText(member.role)}`,
      `**Departman:** ${asText(member.department)}`,
      `**Proje:** ${asText(member.project)}`,
      `**Açıklama:** ${asText(member.description)}`,
      "",
      "_Profil kaydı, tamamlanmış iş kanıtı değildir._",
    ].join("\n");
  }

  if (name === "list_member_history") {
    if (!Array.isArray(data)) {
      throw new StudioError(502, "Profil geçmişi geçersiz.");
    }

    if (data.length === 0) {
      return "Bu çalışan için kayıtlı profil değişikliği bulunmuyor.";
    }

    return [
      "### Profil değişiklik geçmişi",
      "",
      ...data.map((item: unknown) => {
        const event = asRecord(item);

        return `- ${asText(event.recordedAt)} — ${asText(event.action)} (Sürüm ${String(event.revision ?? "?")})`;
      }),
      "",
      "_Bu kayıtlar profil değişikliklerini gösterir; tamamlanan görevleri değil._",
    ].join("\n");
  }

  throw new StudioError(403, "Desteklenmeyen MCP aracı.");
}

function parseArguments(value: unknown): unknown {
  if (typeof value !== "string") {
    return value ?? {};
  }

  try {
    return JSON.parse(value);
  } catch {
    throw new StudioError(502, "Model geçersiz araç parametresi üretti.");
  }
}

export async function chatWithEce(
  userMessage: string
): Promise<string> {
  const history = listEceMessages(6).map((item) => ({
    role: item.role,
    content: item.content.slice(0, 600),
  }));


  // Açık ve basit kayıt sorularında hızlı MCP yolu
  const query = userMessage.toLocaleLowerCase("tr-TR");

  const memberId = query.match(
    /(?:^|[^a-zçğıöşü])(ece|ada|deniz|bora|selin)(?=$|[^a-zçğıöşü])/
  )?.[1];

  const asksTeam =
    /(ekib|çalışan|kadro|takım)/.test(query) &&
    /(kim|liste|tanıt|isim|kaç|beş|5)/.test(query);

  const asksHistory =
    /(profil.*değişiklik|değişiklik.*geçmiş|revizyon|sürüm)/.test(query);

  const asksProfile =
    /(profil|rol|görev|hakkında|bilgi)/.test(query);

  let fastTool:
    | "list_team_members"
    | "get_team_member"
    | "list_member_history"
    | undefined;

  let fastArgs: Record<string, string> = {};

  if (asksTeam) {
    fastTool = "list_team_members";
  } else if (memberId && asksHistory) {
    fastTool = "list_member_history";
    fastArgs = { id: memberId };
  } else if (memberId && asksProfile) {
    fastTool = "get_team_member";
    fastArgs = { id: memberId };
  }

  if (fastTool) {
    console.log("Ece hızlı MCP yolu:", fastTool);

    const result = await callEceMcpTool(fastTool, fastArgs);

    return formatToolResult(fastTool, result);
  }

  let response: Response;

  try {
    response = await fetch(
      "http://127.0.0.1:11434/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3.5:4b",
          stream: false,
          think: false,
          keep_alive: "10m",

          options: {
            num_ctx: 4096,
            num_predict: 512,
            temperature: 0.1,
          },

          tools,

          messages: [
            {
              role: "system",
              content: eceAgent.instructions,
            },
            {
              role: "system",
              content: `
ARKEMX Studio ekip kayıtları için MCP araçların var.

Kurallar:
- Tüm ekip sorulursa list_team_members kullan.
- Tek çalışanın profili sorulursa get_team_member kullan.
- Profil değişiklikleri sorulursa list_member_history kullan.
- Genel sohbetlerde gereksiz araç kullanma.
- Çalışan adlarını ve görevlerini tahmin etme.
- Eski sohbetleri güncel şirket kaydı kabul etme.
- Profil hazır olması, ajanın aktif çalıştığı anlamına gelmez.
- Gerçekleştirmediğin işleri yapılmış gibi anlatma.
`,
            },
            ...history,
            {
              role: "user",
              content: userMessage,
            },
          ],
        }),
        signal: AbortSignal.timeout(180000),
      }
    );
  } catch (error) {
    const name = error instanceof Error ? error.name : "";

    if (name === "TimeoutError" || name === "AbortError") {
      throw new StudioError(
        504,
        "Ece'nin yanıtı zaman aşımına uğradı."
      );
    }

    throw new StudioError(
      503,
      "Ollama bağlantısı kurulamadı."
    );
  }

  if (!response.ok) {
    throw new StudioError(
      502,
      `Ollama HTTP hatası: ${response.status}`
    );
  }

  let data: OllamaResponse;

  try {
    data = (await response.json()) as OllamaResponse;
  } catch {
    throw new StudioError(502, "Ollama yanıtı okunamadı.");
  }

  // Modelin seçtiği MCP aracını tespit et
  const calls = data.message?.tool_calls ?? [];

  console.log("Ece araç seçimi analizi:", {
    doneReason: data.done_reason,
    toolCount: calls.length,
    selectedTools: calls.map((call) => call.function.name),
  });

  if (calls.length > 1) {
    throw new StudioError(
      502,
      "Bu sürümde tek seferde yalnızca bir MCP aracı kullanılabilir."
    );
  }

  if (calls.length === 1) {
    const selected = calls[0].function.name;

    if (
      !eceAgent.allowedMcpTools.some(
        (allowed) => allowed === selected
      )
    ) {
      throw new StudioError(403, "İzinsiz MCP aracı engellendi.");
    }

    console.log("Ece'nin seçtiği MCP aracı:", selected);

    const args = parseArguments(
      calls[0].function.arguments
    );

    const result = await callEceMcpTool(selected, args);

    // Gerçek kayıtları modelin yeniden üretmesine bırakma
    return formatToolResult(selected, result);
  }

  // Model, şirket kaydı sorusunda araç kullanmadıysa
  // doğrulanmamış çalışan bilgisi üretmesini engelle.

  // Ollama araç seçemediyse güvenli yedek yönlendirme
  if (calls.length === 0) {
    const query = userMessage.toLocaleLowerCase("tr-TR");

    const memberId = query.match(
      /(?:^|[^a-zçğıöşü])(ece|ada|deniz|bora|selin)(?=$|[^a-zçğıöşü])/
    )?.[1];

    const wantsHistory =
      /geçmiş|değişiklik|güncelleme|revizyon|sürüm/.test(query);

    const wantsTeam =
      /(ekib|çalışan|kadro|takım)/.test(query) &&
      /(kim|liste|tanıt|isim|kaç|beş|5)/.test(query);

    let selected:
      | "list_team_members"
      | "get_team_member"
      | "list_member_history"
      | undefined;

    let args: Record<string, string> = {};

    if (wantsTeam) {
      selected = "list_team_members";
    } else if (memberId && wantsHistory) {
      selected = "list_member_history";
      args = { id: memberId };
    } else if (
      memberId &&
      /(profil|rol|görev|hakkında|bilgi|kim)/.test(query)
    ) {
      selected = "get_team_member";
      args = { id: memberId };
    }

    if (selected) {
      console.log(
        "Ece yedek MCP yönlendirmesi:",
        selected
      );

      const result = await callEceMcpTool(
        selected,
        args
      );

      return formatToolResult(selected, result);
    }

    // Şirket kayıtları hakkında doğrulanmamış
    // bilgi üretilmesini engelle.
    if (/(ekib|çalışan|profil|geçmiş)/.test(query)) {
      throw new StudioError(
        422,
        "Hangi ekip bilgisini istediğini belirleyemedim. Çalışan adını veya istediğin listeyi belirt."
      );
    }
  }


  const answer = data.message?.content?.trim();

  if (!answer) {
    throw new StudioError(
      502,
      "Ece geçerli bir yanıt üretmedi."
    );
  }

  return answer;
}
