
import { z } from "zod";

import {
  workPlanSchema,
  type WorkPlanDraft,
} from "@/domain/work-plan";

import { callEceMcpTool } from "@/server/ece-mcp";

type OllamaResponse = {
  message?: {
    content?: string;
  };
};

type TeamMember = {
  id: string;
  name: string;
  role: string;
};

export async function createEceWorkPlan(
  goal: string
): Promise<WorkPlanDraft> {
  // 1. Kullanıcının hedefini kontrol et
  const cleanGoal = goal.trim();

  if (cleanGoal.length < 10 || cleanGoal.length > 1500) {
    throw new Error(
      "Plan hedefi 10-1500 karakter arasında olmalı."
    );
  }

  // 2. Gerçek ekip üyelerini MCP üzerinden getir
  const rawTeam = await callEceMcpTool(
    "list_team_members",
    {}
  );

  const teamSchema = z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      role: z.string().min(1),
    })
  );

  const team: TeamMember[] = teamSchema.parse(rawTeam);

  if (team.length === 0) {
    throw new Error(
      "Plan oluşturmak için ekip bulunamadı."
    );
  }

  // 3. Kısa ve anlaşılır sistem talimatları
  const systemPrompt = `
Sen Ece'sin, ARKEMX AI Studio'nun AI ekip liderisin.

Kullanıcının hedefinden 3 veya 4 görev içeren
uygulanabilir bir İŞ PLANI TASLAĞI oluştur.

EKİP UZMANLIKLARI:
- Ada: Yazılım mimarisi, algoritma, API ve veritabanı.
- Deniz: Arayüz, kullanıcı deneyimi ve prototip.
- Bora: Test, kalite ve hata doğrulama.
- Selin: Araştırma, bilgi doğrulama ve dokümantasyon.
- Ece: Planlama ve koordinasyon.

GÖREV DAĞILIMI:
1. Görevleri çalışanların uzmanlıklarına uygun dağıt.
2. Algoritma geliştiriliyorsa Ada'ya teknik görev öner.
3. Algoritma değişikliği varsa Bora'ya ayrı test görevi ver.
4. Arayüz geliştirmesi varsa Deniz'i değerlendir.
5. Araştırma gerekiyorsa Selin'i değerlendir.
6. Her çalışana görev vermek zorunlu değildir.
7. Görevler mantıklı sırada ve birbirini tamamlayıcı olsun.

GÜVENİLİRLİK:
1. İncelemediğin proje dosyalarını incelemiş gibi davranma.
2. Mevcut olmayan veri, rapor veya ölçüm uydurma.
3. Kanıtsız yüzdeler, adetler veya başarı hedefleri koyma.
4. Bilinmeyen mevcut durum için önce inceleme öner.
5. Kabul kriterlerini somut ve doğrulanabilir yaz.
6. Gerçekleşmemiş işleri tamamlandı gösterme.
7. Hiçbir görevin atandığını veya başlatıldığını söyleme.
8. Hiçbir ajan çalıştırılmaz ve dosya değiştirilmez.

ÇIKTI KURALLARI:
- Hedefin kapsamına uygun sayıda görev oluştur.
- Gereksiz görev üretme.
- Teknik geliştirme varsa test görevini unutma.
- En fazla 8 görev öner.
- Priority: high, medium veya low.
- Görev adı en az 3 karakter.
- Açıklama ve kabul kriteri en az 10 karakter.
- Yalnızca gerçek çalışan kimliklerini kullan.
- Kısa, açık ve geçerli JSON döndür.
- Markdown veya JSON dışında metin kullanma.

JSON BİÇİMİ:
{
  "project": "Proje adı",
  "goal": "Kullanıcının hedefi",
  "summary": "Önerilen iş planının özeti",
  "tasks": [
    {
      "assigneeId": "ada",
      "title": "Görev başlığı",
      "description": "Yapılacak iş",
      "priority": "high",
      "acceptanceCriteria": "Tamamlanma ölçütü"
    }
  ]
}

GEÇERLİ EKİP:
${JSON.stringify(team)}

Görevler yalnızca kullanıcının belirttiği hedefe
hizmet etmelidir.

Bora yalnızca test, kalite ve doğrulama görevleri
üstlenmelidir. Yazılım veya sistem değişikliği
görevleri Bora'ya verilmemelidir.
`;

  // 4. Ollama üzerinden plan oluştur
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
            model: "qwen2.5:1.5b",
            stream: false,
            think: false,
            format: "json",
            keep_alive: "10m",

          options: {
            num_ctx: 2048,
            num_predict: 1100,
            temperature: 0.1,
          },

          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: JSON.stringify({
                requestedGoal: cleanGoal,
              }),
            },
          ],
        }),

        signal: AbortSignal.timeout(180000),
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        error.name === "AbortError")
    ) {
      throw new Error(
        "Ollama iş planını zamanında tamamlayamadı."
      );
    }

    throw error;
  }

  if (!response.ok) {
    throw new Error(
      `Ollama plan oluşturma hatası: ${response.status}`
    );
  }

  // 5. Model yanıtını oku
  const data = (await response.json()) as OllamaResponse;

  const content = data.message?.content?.trim();

  if (!content) {
    throw new Error(
      "Ollama boş plan döndürdü."
    );
  }

  // 6. Üretilen JSON'u ayrıştır
  let rawPlan: unknown;

  try {
    rawPlan = JSON.parse(content);
  } catch {
    throw new Error(
      "Model geçerli JSON oluşturamadı."
    );
  }

  // 7. Planın zorunlu alanlarını doğrula
  const parsedPlan = workPlanSchema.safeParse(rawPlan);

  if (!parsedPlan.success) {
    const invalidFields = parsedPlan.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");

    throw new Error(
      `Plan doğrulama hatası: ${invalidFields}`
    );
  }

  const plan = parsedPlan.data;

  // 8. Oluşturulan planı kayıt altına al
  console.log("Ece planlama sonucu:", {
    taskCount: plan.tasks.length,
    model: "qwen2.5:1.5b",
  });

  // 9. Görev sahiplerini gerçek MCP ekibiyle karşılaştır
  const validIds = new Set(
    team.map((member) => member.id)
  );

  for (const task of plan.tasks) {
    if (!validIds.has(task.assigneeId)) {
      throw new Error(
        `Geçersiz görev sahibi: ${task.assigneeId}`
      );
    }
  }

  // 10. Sonuç yalnızca bir taslaktır
  // Veritabanına kayıt yapılmaz.
  // Görev ataması gerçekleştirilmez.
  // Diğer ajanlar çalıştırılmaz.

  return {
  ...plan,
  goal: cleanGoal,
};
}
