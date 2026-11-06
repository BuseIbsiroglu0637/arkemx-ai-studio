
import type { WorkPlanDraft } from "@/domain/work-plan";

export type PlanValidationIssue = {
  code:
    | "ROLE_MISMATCH"
    | "MISSING_TEST"
    | "MISSING_UI";

  message: string;
  taskIndex?: number;
};

type PlanTask = WorkPlanDraft["tasks"][number];

// Türkçe karakterleri dikkate alarak metni standartlaştır
function normalize(value: string): string {
  return value.toLocaleLowerCase("tr-TR").trim();
}

// Görev başlığı ve açıklamasındaki işleri ayır
function splitTaskActivities(
  title: string,
  description: string
): string[] {
  return [title, description]
    .flatMap((text) =>
      normalize(text).split(/\s+ve\s+|[.;,]/)
    )
    .map((part) => part.trim())
    .filter(Boolean);
}

// Bir görev teknik uygulama veya geliştirme içeriyor mu?
function isTechnicalImplementation(
  task: PlanTask,
  includeApply = false
): boolean {
  const activities = splitTaskActivities(
    task.title,
    task.description
  );

  return activities.some((activity) => {
    const technicalSubject =
      /(algoritm|eşleştirme\s+motor|api\b|veri\s*taban|backend|sistem\s+kural)/.test(
        activity
      );

    const developmentAction =
      /(geliştir|iyileştir|optimiz|kodla|refaktör|yeniden tasarla|değiştir|güncelle)/.test(
        activity
      ) ||
      (includeApply && /(uygula|uyarl)/.test(activity));

    // Arayüz geliştirmeyi algoritma geliştirmeyle
    // karıştırmamaya çalışıyoruz.
    const uiDevelopment =
      /(arayüz|ekran|kullanıcı deneyimi|prototip|wireframe)/.test(
        activity
      ) &&
      /(geliştir|iyileştir|tasarla|oluştur)/.test(
        activity
      );

    return (
      technicalSubject &&
      developmentAction &&
      !uiDevelopment
    );
  });
}

// Bir görev gerçek test veya kalite işi içeriyor mu?
function isQualityTask(task: PlanTask): boolean {
  const text = normalize(
    `${task.title} ${task.description}`
  );

  return (
    /(test|doğrula|doğrulama|senaryo|regresyon|kalite|kontrol)/.test(
      text
    ) &&
    !isTechnicalImplementation(task, true)
  );
}

// Bir görev kullanıcı arayüzüyle ilgili mi?
function isUITask(task: PlanTask): boolean {
  const text = normalize(
    `${task.title} ${task.description}`
  );

  return /(arayüz|ekran|tasarım|prototip|kullanıcı deneyimi|kullanıcı akışı|wireframe|\bui\b|\bux\b)/.test(
    text
  );
}

export function validateEceWorkPlan(
  plan: WorkPlanDraft,
  requestedGoal: string
): PlanValidationIssue[] {
  const issues: PlanValidationIssue[] = [];
  const goal = normalize(requestedGoal);

  // 1. Kullanıcının hedefinde teknik geliştirme var mı?
  const needsTechnicalTest =
    /(algoritm|eşleştir|yazılım|api)/.test(goal) &&
    /(geliştir|iyileştir|değiştir|düzelt|optimiz)/.test(
      goal
    );

  // 2. Arayüz veya kullanıcı deneyimi hedefi var mı?
  const needsUI =
    /(arayüz|ekran|kullanıcı deneyimi|\bui\b|\bux\b|kullanıcı.{0,100}incele)/.test(
      goal
    );

  // 3. Görevleri uzmanlıklarına göre denetle
  plan.tasks.forEach((task, index) => {
    const technicalDevelopment =
      isTechnicalImplementation(task);

    // Bora için uygulama ve sistem değişikliği
    // görevlerini de kontrol et
    const boraImplementation =
      task.assigneeId === "bora" &&
      isTechnicalImplementation(task, true);

    // Aynı görev için yalnızca bir uzmanlık uyarısı
    if (
      task.assigneeId !== "ada" &&
      (technicalDevelopment || boraImplementation)
    ) {
      issues.push({
        code: "ROLE_MISMATCH",
        taskIndex: index,
        message: boraImplementation
          ? `"${task.title}" teknik uygulama veya sistem değişikliği içeriyor. Bora yalnızca test ve kalite görevlerinden sorumlu olmalıdır.`
          : `"${task.title}" teknik geliştirme içeriyor. Bu görev Ada için değerlendirilmelidir.`,
      });
    }
  });

  // 4. Algoritma geliştiriliyorsa Bora'nın
  // ayrı ve uygun bir test görevi bulunmalı
  if (needsTechnicalTest) {
    const hasTestTask = plan.tasks.some(
      (task) =>
        task.assigneeId === "bora" &&
        isQualityTask(task)
    );

    if (!hasTestTask) {
      issues.push({
        code: "MISSING_TEST",
        message:
          "Teknik geliştirme hedefinde Bora için " +
          "ayrı bir test veya doğrulama görevi " +
          "bulunmalıdır.",
      });
    }
  }

  // 5. Arayüz hedefi varsa Deniz'in
  // ilgili görevini kontrol et
  if (needsUI) {
    const hasUITask = plan.tasks.some(
      (task) =>
        task.assigneeId === "deniz" &&
        isUITask(task)
    );

    if (!hasUITask) {
      issues.push({
        code: "MISSING_UI",
        message:
          "Kullanıcı deneyimi hedefi için Deniz'e " +
          "arayüz tasarımı veya kullanıcı akışı " +
          "görevi önerilmelidir.",
      });
    }
  }

  return issues;
}
