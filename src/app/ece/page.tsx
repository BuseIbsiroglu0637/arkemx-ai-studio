"use client";
import ReactMarkdown from "react-markdown";
import { useEffect, useRef, useState, type FormEvent, } from "react";
import DecisionCenter from "./decision-center";
import type { WorkPlanDraft } from "@/domain/work-plan";
type Message = {
    role: "user" | "assistant";
    content: string;
};
type PlanIssue = {
    code: "ROLE_MISMATCH" | "MISSING_TEST" | "MISSING_UI";
    message: string;
    taskIndex?: number;
};
type SavedPlanSummary = {
    id: string;
    project: string;
    goal: string;
    revision: number;
    updatedAt: string;
};
// API'den gelen uyarıların beklenen yapıda olduğunu kontrol et.
function isPlanIssue(value: unknown): value is PlanIssue {
    if (typeof value !== "object" || value === null)
        return false;
    const issue = value as Record<string, unknown>;
    return ((issue.code === "ROLE_MISMATCH" ||
        issue.code === "MISSING_TEST" ||
        issue.code === "MISSING_UI") &&
        typeof issue.message === "string" &&
        (issue.taskIndex === undefined ||
            (typeof issue.taskIndex === "number" &&
                Number.isInteger(issue.taskIndex) &&
                issue.taskIndex >= 0)));
}
function isSavedPlanSummary(value: unknown): value is SavedPlanSummary {
    if (typeof value !== "object" || value === null)
        return false;
    const entry = value as Record<string, unknown>;
    return (typeof entry.id === "string" &&
        entry.id.trim().length > 0 &&
        typeof entry.project === "string" &&
        typeof entry.goal === "string" &&
        typeof entry.revision === "number" &&
        Number.isInteger(entry.revision) &&
        typeof entry.updatedAt === "string");
}
const MEMBER_NAMES: Record<string, string> = {
    ece: "Ece",
    ada: "Ada",
    deniz: "Deniz",
    bora: "Bora",
    selin: "Selin",
};
const PRIORITY_NAMES: Record<string, string> = {
    high: "Yüksek",
    medium: "Orta",
    low: "Düşük",
};
export default function EcePage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [error, setError] = useState("");
    const [plan, setPlan] = useState<WorkPlanDraft | null>(null);
    const [issues, setIssues] = useState<PlanIssue[]>([]);
    const [planning, setPlanning] = useState(false);
    const [planChanged, setPlanChanged] = useState(false);
    const [editingPlan, setEditingPlan] = useState(false);
    const [checking, setChecking] = useState(false);
    const [saving, setSaving] = useState(false);
    const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const [savedPlans, setSavedPlans] = useState<SavedPlanSummary[]>([]);
    const [showSavedPlans, setShowSavedPlans] = useState(false);
    const [plansLoading, setPlansLoading] = useState(false);
    const [openingPlan, setOpeningPlan] = useState(false);
    // Önceki sohbetleri SQLite API'sinden yükle.
    useEffect(() => {
        let active = true;
        async function loadHistory() {
            try {
                const response = await fetch("/api/agents/ece/chat", {
                    cache: "no-store",
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error?.message || "Sohbet geçmişi yüklenemedi.");
                }
                const stored = result.data?.messages;
                if (!Array.isArray(stored)) {
                    throw new Error("Sohbet geçmişinin biçimi geçersiz.");
                }
                const restored: Message[] = stored
                    .filter((item: unknown): item is Message => typeof item === "object" &&
                    item !== null &&
                    "role" in item &&
                    (item.role === "user" || item.role === "assistant") &&
                    "content" in item &&
                    typeof item.content === "string")
                    .map((item) => ({ role: item.role, content: item.content }));
                if (active)
                    setMessages(restored);
            }
            catch (failure) {
                if (active) {
                    setError(failure instanceof Error
                        ? failure.message
                        : "Sohbet geçmişi yüklenemedi.");
                }
            }
            finally {
                if (active)
                    setHistoryLoading(false);
            }
        }
        void loadHistory();
        return () => {
            active = false;
        };
    }, []);
    // Yeni mesaj veya plan geldiğinde sohbetin sonuna git.
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading, planning]);
    async function sendMessage(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const text = input.trim();
        if (!text || loading || planning || historyLoading || checking || saving || plansLoading || openingPlan)
            return;
        setMessages((previous) => [
            ...previous,
            { role: "user", content: text },
        ]);
        setInput("");
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/agents/ece/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: text }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error?.message || "Ece yanıt veremedi.");
            }
            if (typeof result.data?.reply !== "string") {
                throw new Error("Geçersiz model yanıtı.");
            }
            setMessages((previous) => [
                ...previous,
                { role: "assistant", content: result.data.reply },
            ]);
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : "Bağlantı hatası.");
            // Başarısız gönderimi geri al; kullanıcı mesajı yeniden deneyebilsin.
            setMessages((previous) => previous.slice(0, -1));
            setInput(text);
        }
        finally {
            setLoading(false);
        }
    }
    async function createPlan() {
        const goal = input.trim();
        if (goal.length < 10 || goal.length > 1500) {
            setError("Plan hedefi 10-1500 karakter arasında olmalı.");
            return;
        }
        if (loading || planning || historyLoading || checking || saving || plansLoading || openingPlan)
            return;
        setPlanning(true);
        setError("");
        setPlanChanged(false);
        setEditingPlan(false);
        setSavedPlanId(null);
        // Eski plan ve uyarıları, yeni planla karışmaması için temizle.
        setPlan(null);
        setIssues([]);
        try {
            const response = await fetch("/api/agents/ece/plan", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goal }),
            });
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error?.message || "İş planı oluşturulamadı.");
            }
            if (!result.data?.plan || !Array.isArray(result.data.plan.tasks)) {
                throw new Error("Geçerli bir iş planı alınamadı.");
            }
            const receivedIssues: unknown = result.data.issues;
            if (!Array.isArray(receivedIssues) ||
                !receivedIssues.every(isPlanIssue)) {
                throw new Error("İş planı kalite kontrolü sonucu alınamadı. API'yi kontrol et.");
            }
            setIssues(receivedIssues);
            setPlan(result.data.plan as WorkPlanDraft);
            setPlanChanged(false);
            setInput("");
        }
        catch (failure) {
            setError(failure instanceof Error
                ? failure.message
                : "Plan oluşturulurken hata oluştu.");
        }
        finally {
            setPlanning(false);
        }
    }
    // Yalnızca kontrol edilmiş taslağı yeni bir SQLite kaydı olarak sakla.
    // Bu API herhangi bir ajanı başlatmaz veya görevlendirme yapmaz.
    async function savePlan() {
        if (!plan ||
            saving ||
            loading ||
            planning ||
            historyLoading ||
            checking ||
            planChanged ||
            savedPlanId !== null ||
            plansLoading ||
            openingPlan) {
            return;
        }
        setSaving(true);
        setError("");
        try {
            const response = await fetch("/api/agents/ece/plans", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
            });
            if (!response.headers.get("content-type")?.includes("application/json")) {
                throw new Error("Kayıt API'si JSON yanıtı vermedi. API yolunu kontrol et.");
            }
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error?.message || "İş planı SQLite'a kaydedilemedi.");
            }
            const id: unknown = result.data?.saved?.id;
            if (typeof id !== "string" || id.trim().length === 0) {
                throw new Error("Kayıt başarılı görünse de plan kimliği alınamadı.");
            }
            setSavedPlanId(id);
        }
        catch (failure) {
            setError(failure instanceof Error
                ? failure.message
                : "İş planı kaydedilirken hata oluştu.");
        }
        finally {
            setSaving(false);
        }
    }
    type TaskUpdate = Partial<WorkPlanDraft["tasks"][number]>;
    function updateTask(index: number, changes: TaskUpdate) {
        if (checking || saving || plansLoading || openingPlan)
            return;
        setPlan((current) => {
            if (!current)
                return null;
            return {
                ...current,
                tasks: current.tasks.map((task, taskIndex) => taskIndex === index ? { ...task, ...changes } : task),
            };
        });
        // Son düzenlemeler yeni bir taslaktır; önceki SQLite kaydı korunur.
        setPlanChanged(true);
        setSavedPlanId(null);
        setIssues([]);
    }
    // Kullanıcının oluşturduğu yeni görev, yalnızca tarayıcıdaki taslağa eklenir.
    function addTask() {
        if (!plan || plan.tasks.length >= 8 || checking || saving || plansLoading || openingPlan)
            return;
        setPlan((current) => {
            if (!current || current.tasks.length >= 8)
                return current;
            return {
                ...current,
                tasks: [
                    ...current.tasks,
                    {
                        assigneeId: "bora",
                        title: "Poz eşleştirme doğrulama testleri",
                        description: "Mevcut ve yeni eşleştirme davranışını karşılaştırarak doğru, yanlış ve belirsiz eşleşmeleri test et.",
                        priority: "high" as const,
                        acceptanceCriteria: "Test senaryoları hazırlanmalı, beklenen ve gerçekleşen sonuçlar karşılaştırılarak raporlanmalı.",
                    },
                ],
            };
        });
        setPlanChanged(true);
        setSavedPlanId(null);
        setIssues([]);
    }
    // Düzenlenmiş planı Ollama'ya göndermeden API üzerinde kontrol eder.
    async function revalidatePlan() {
        if (!plan || !planChanged || loading || planning || historyLoading || checking || saving || plansLoading || openingPlan) {
            return;
        }
        setChecking(true);
        setError("");
        try {
            const response = await fetch("/api/agents/ece/plan/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan, goal: plan.goal }),
            });
            if (!response.headers.get("content-type")?.includes("application/json")) {
                throw new Error("Doğrulama API'si JSON yanıtı vermedi. API yolunu kontrol et.");
            }
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error?.message || "Plan yeniden kontrol edilemedi.");
            }
            if (!Array.isArray(result.data?.issues) ||
                !result.data.issues.every(isPlanIssue)) {
                throw new Error("Geçersiz kalite kontrol sonucu.");
            }
            setIssues(result.data.issues);
            setPlanChanged(false);
        }
        catch (failure) {
            setError(failure instanceof Error
                ? failure.message
                : "Yeniden kontrol sırasında hata oluştu.");
            // Başarısız kontrolde taslak değişmiş sayılmaya devam eder.
        }
        finally {
            setChecking(false);
        }
    }
    // Yalnızca SQLite'tan kayıtlı taslakları listeler; model çağırmaz.
    async function toggleSavedPlans() {
        if (loading || planning || historyLoading || checking || saving || plansLoading || openingPlan)
            return;
        if (showSavedPlans) {
            setShowSavedPlans(false);
            return;
        }
        setPlansLoading(true);
        setError("");
        try {
            const response = await fetch("/api/agents/ece/plans", {
                cache: "no-store",
            });
            if (!response.headers.get("content-type")?.includes("application/json")) {
                throw new Error("Kayıtlı planlar API'si JSON yanıtı vermedi.");
            }
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error?.message || "Kayıtlı planlar getirilemedi.");
            }
            const items: unknown = result.data?.plans;
            if (!Array.isArray(items) || !items.every(isSavedPlanSummary)) {
                throw new Error("Kayıtlı plan listesi beklenen biçimde değil.");
            }
            setSavedPlans(items);
            setShowSavedPlans(true);
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : "Kayıtlı planlar açılamadı.");
        }
        finally {
            setPlansLoading(false);
        }
    }
    // Kaydedilmiş planı SQLite'tan oku; kalite durumunu model çağırmadan doğrula.
    async function openSavedPlan(id: string) {
        if (loading || planning || historyLoading || checking || saving || plansLoading || openingPlan)
            return;
        if (plan && (planChanged || savedPlanId === null)) {
            if (!window.confirm("Ekrandaki kaydedilmemiş taslak değişiklikleri kaybolacak. Kayıtlı planı açmak istiyor musun?")) {
                return;
            }
        }
        setOpeningPlan(true);
        setError("");
        try {
            const response = await fetch(`/api/agents/ece/plans/${encodeURIComponent(id)}`, { cache: "no-store" });
            if (!response.headers.get("content-type")?.includes("application/json")) {
                throw new Error("Plan açma API'si JSON yanıtı vermedi.");
            }
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error?.message || "Kayıtlı plan açılamadı.");
            }
            const saved: unknown = result.data?.saved;
            if (!saved || typeof saved !== "object" || !("plan" in saved)) {
                throw new Error("Kaydedilmiş planın veri yapısı geçersiz.");
            }
            const loadedPlan: unknown = saved.plan;
            if (!loadedPlan ||
                typeof loadedPlan !== "object" ||
                !Array.isArray((loadedPlan as WorkPlanDraft).tasks)) {
                throw new Error("Kayıtlı iş planı geçersiz.");
            }
            const validationResponse = await fetch("/api/agents/ece/plan/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan: loadedPlan }),
            });
            if (!validationResponse.headers.get("content-type")?.includes("application/json")) {
                throw new Error("Plan kalite kontrolü JSON yanıtı vermedi.");
            }
            const validationResult = await validationResponse.json();
            if (!validationResponse.ok) {
                throw new Error(validationResult.error?.message || "Kayıtlı plan doğrulanamadı.");
            }
            const loadedIssues: unknown = validationResult.data?.issues;
            if (!Array.isArray(loadedIssues) || !loadedIssues.every(isPlanIssue)) {
                throw new Error("Plan kalite kontrolü sonucu geçersiz.");
            }
            // Tüm istekler başarılı olmadan görüntülenen taslağı değiştirme.
            setPlan(loadedPlan as WorkPlanDraft);
            setIssues(loadedIssues);
            setSavedPlanId(id);
            setPlanChanged(false);
            setEditingPlan(false);
            setShowSavedPlans(false);
        }
        catch (failure) {
            setError(failure instanceof Error ? failure.message : "Kayıtlı plan açılamadı.");
        }
        finally {
            setOpeningPlan(false);
        }
    }
    const busy = loading || planning || historyLoading || checking || saving || plansLoading || openingPlan;
    return (<main style={{
            minHeight: "100vh",
            background: "#f3f5f1",
            padding: "24px 12px",
            color: "#24372c",
        }}>

      <div style={{
            maxWidth: 900,
            margin: "0 auto",
            background: "#ffffff",
            borderRadius: 20,
            border: "1px solid #e1e7df",
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(20,40,25,0.05)",
        }}>

        <header style={{
            padding: 24,
            borderBottom: "1px solid #e5ebe4",
        }}>

          <a href="/" style={{
            color: "#54765c",
            fontSize: 14,
            textDecoration: "none",
        }}>

            ← Ekibime dön

          </a>

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 18,
        }}>

            <div style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            background: "#dce8dd",
            display: "grid",
            placeItems: "center",
            fontSize: 25,
            fontWeight: 700,
            color: "#426b58",
        }}>

              E

            </div>

            <div>

              <h1 style={{ margin: 0, fontSize: 25 }}>Ece</h1>

              <p style={{
            margin: "5px 0",
            fontSize: 14,
            color: "#697b6e",
        }}>

                AI Ekip ve Ürün Lideri

              </p>

              <small style={{ color: "#53745c" }}>

                ● Sohbet: qwen3.5:4b · Planlama: qwen2.5:1.5b

              </small>

            </div>

          </div>

        </header>

        <DecisionCenter />

        <div style={{ padding: "14px 24px", borderBottom: "1px solid #e5ebe4" }}>
          <button type="button" onClick={toggleSavedPlans} disabled={busy} aria-expanded={showSavedPlans} style={{
            padding: "11px 16px",
            border: "1px solid #b8cdbb",
            borderRadius: 10,
            background: "#e2eadd",
            color: "#315b42",
            font: "inherit",
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.55 : 1,
        }}>
            {plansLoading
            ? "Planlar yükleniyor..."
            : showSavedPlans
                ? "Kayıtlı planları kapat"
                : "Kayıtlı planlar"}
          </button>

          {showSavedPlans && (<section aria-label="Kayıtlı iş planları" style={{
                marginTop: 14,
                padding: 16,
                background: "#f5f9f4",
                border: "1px solid #dce8dd",
                borderRadius: 12,
                maxHeight: 300,
                overflowY: "auto",
            }}>
              <strong>SQLite'a kaydedilen iş planları</strong>
              {savedPlans.length === 0 ? (<p style={{ color: "#66796b" }}>Henüz kayıtlı plan yok.</p>) : (<div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                  {savedPlans.map((item) => (<div key={item.id} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: 12,
                        padding: 14,
                        background: "#ffffff",
                        border: "1px solid #e1e7df",
                        borderRadius: 10,
                    }}>
                      <div style={{ flex: 1, minWidth: 190 }}>
                        <strong>{item.project}</strong>
                        <p style={{ fontSize: 13, color: "#52705d", margin: "6px 0" }}>
                          {item.goal}
                        </p>
                        <small style={{ color: "#77857b" }}>
                          Sürüm {item.revision} · {new Date(item.updatedAt).toLocaleString("tr-TR")}
                        </small>
                      </div>
                      <button type="button" onClick={() => openSavedPlan(item.id)} disabled={busy} style={{
                        padding: "10px 14px",
                        border: "none",
                        borderRadius: 9,
                        background: "#426b58",
                        color: "#ffffff",
                        cursor: busy ? "wait" : "pointer",
                        opacity: busy ? 0.55 : 1,
                    }}>
                        {openingPlan ? "Açılıyor..." : "Planı aç"}
                      </button>
                    </div>))}
                </div>)}
            </section>)}
        </div>

        <section aria-label="Ece sohbet geçmişi" style={{
            height: "55vh",
            minHeight: 350,
            maxHeight: 650,
            overflowY: "auto",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
        }}>

          {historyLoading && (<p style={{ color: "#77857b" }}>

              Önceki konuşmalar yükleniyor...

            </p>)}

          {!historyLoading && messages.length === 0 && !plan && (<div style={{
                textAlign: "center",
                margin: "auto",
                maxWidth: 420,
            }}>

              <div style={{ fontSize: 38 }}>✦</div>

              <h2>Merhaba, ben Ece.</h2>

              <p style={{ color: "#77857b", lineHeight: 1.7 }}>

                ARKEMX AI Studio&apos;nun ekip lideriyim. Projeleri

                planlamak ve işleri koordine etmek için buradayım.

              </p>

            </div>)}

          {messages.map((item, index) => (<div key={index} style={{
                alignSelf: item.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "14px 18px",
                borderRadius: 16,
                background: item.role === "user" ? "#dcebdd" : "#f3f5f2",
                whiteSpace: item.role === "user" ? "pre-wrap" : "normal",
                overflowWrap: "anywhere",
                lineHeight: 1.6,
            }}>

              <strong style={{ fontSize: 13 }}>

                {item.role === "user" ? "Sen" : "Ece"}

              </strong>

              <div style={{ marginTop: 6 }}>

                {item.role === "assistant" ? (<ReactMarkdown components={{
                    p: ({ children }) => (<p style={{ margin: "6px 0" }}>{children}</p>),
                    ul: ({ children }) => (<ul style={{
                            paddingLeft: 22,
                            listStyleType: "disc",
                            margin: "8px 0",
                        }}>

                          {children}

                        </ul>),
                }}>

                    {item.content}

                  </ReactMarkdown>) : (item.content)}

              </div>

            </div>))}

          {plan && (<div style={{
                border: "1px solid #cfddcf",
                borderRadius: 16,
                padding: 20,
                background: "#f5f9f4",
            }}>

              <span style={{
                color: "#53745c",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 0.5,
            }}>

                ECE · İŞ PLANI TASLAĞI

              </span>

              <h2 style={{ margin: "10px 0" }}>{plan.project}</h2>

              <p>

                <strong>Hedef:</strong> {plan.goal}

              </p>

              <p>{plan.summary}</p>

              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14 }}>

                <small style={{ color: "#66796b" }}>

                  {planChanged
                ? "Düzenlendi · Yeniden kalite kontrolü gerekiyor · Son değişiklikler kaydedilmedi"
                : savedPlanId
                    ? "✓ Taslak SQLite'a kaydedildi"
                    : "Oluşturulan taslak · Henüz kaydedilmedi"}

                </small>

                <button type="button" onClick={() => setEditingPlan((current) => !current)} disabled={busy} style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #b8cdbb", background: "white", color: "#315b42", cursor: busy ? "wait" : "pointer" }}>

                  {editingPlan ? "Düzenlemeyi kapat" : "Görevleri düzenle"}

                </button>

              </div>

              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>

                {plan.tasks.map((task, index) => (<div key={index} style={{
                    padding: 16,
                    background: "white",
                    border: "1px solid #e1e7df",
                    borderRadius: 12,
                }}>

                    {editingPlan ? (<div style={{ display: "grid", gap: 12 }}>

                        <strong>{index + 1}. Görevi düzenle</strong>

                        <label style={{ display: "grid", gap: 5, fontSize: 13 }}>

                          Görev başlığı

                          <input value={task.title} disabled={busy} onChange={(event) => updateTask(index, { title: event.target.value })} maxLength={180} style={{ padding: 10, border: "1px solid #d5dfd5", borderRadius: 8, font: "inherit" }}/>

                        </label>

                        <label style={{ display: "grid", gap: 5, fontSize: 13 }}>

                          Sorumlu çalışan

                          <select value={task.assigneeId} disabled={busy} onChange={(event) => updateTask(index, { assigneeId: event.target.value })} style={{ padding: 10, border: "1px solid #d5dfd5", borderRadius: 8, background: "white", font: "inherit" }}>

                            {Object.entries(MEMBER_NAMES).map(([id, name]) => (<option key={id} value={id}>{name}</option>))}

                          </select>

                        </label>

                        <label style={{ display: "grid", gap: 5, fontSize: 13 }}>

                          Öncelik

                          <select value={task.priority} disabled={busy} onChange={(event) => updateTask(index, { priority: event.target.value as WorkPlanDraft["tasks"][number]["priority"] })} style={{ padding: 10, border: "1px solid #d5dfd5", borderRadius: 8, background: "white", font: "inherit" }}>

                            {Object.entries(PRIORITY_NAMES).map(([value, name]) => (<option key={value} value={value}>{name}</option>))}

                          </select>

                        </label>

                        <label style={{ display: "grid", gap: 5, fontSize: 13 }}>

                          Açıklama

                          <textarea value={task.description} disabled={busy} onChange={(event) => updateTask(index, { description: event.target.value })} rows={3} style={{ padding: 10, border: "1px solid #d5dfd5", borderRadius: 8, resize: "vertical", font: "inherit" }}/>

                        </label>

                        <label style={{ display: "grid", gap: 5, fontSize: 13 }}>

                          Kabul kriteri

                          <textarea value={task.acceptanceCriteria} disabled={busy} onChange={(event) => updateTask(index, { acceptanceCriteria: event.target.value })} rows={3} style={{ padding: 10, border: "1px solid #d5dfd5", borderRadius: 8, resize: "vertical", font: "inherit" }}/>

                        </label>

                      </div>) : (<>

                        <strong>{index + 1}. {task.title}</strong>

                        <p style={{ color: "#52705d", margin: "6px 0" }}>

                          {MEMBER_NAMES[task.assigneeId] ?? task.assigneeId}

                          {" · "}

                          {PRIORITY_NAMES[task.priority] ?? task.priority}

                          {" öncelik"}

                        </p>

                        <p>{task.description}</p>

                        <p style={{ marginBottom: 0, fontSize: 13 }}>

                          <strong>Kabul kriteri: </strong>

                          {task.acceptanceCriteria}

                        </p>

                      </>)}

                  </div>))}

              </div>

              <button type="button" onClick={addTask} disabled={busy || plan.tasks.length >= 8} style={{
                marginTop: 14,
                padding: "12px 18px",
                background: "#e2eadd",
                border: "1px solid #b8cdbb",
                borderRadius: 10,
                color: "#315b42",
                cursor: busy ? "wait" : "pointer",
                opacity: busy || plan.tasks.length >= 8 ? 0.55 : 1,
            }}>

                + Yeni görev ekle

              </button>

              <button type="button" onClick={savePlan} disabled={busy || planChanged || savedPlanId !== null} style={{
                marginTop: 14,
                marginLeft: 10,
                padding: "12px 18px",
                background: "#426b58",
                color: "#ffffff",
                border: "none",
                borderRadius: 10,
                cursor: busy ? "wait" : "pointer",
                opacity: busy || planChanged || savedPlanId !== null ? 0.55 : 1,
            }}>

                {saving
                ? "Kaydediliyor..."
                : savedPlanId
                    ? "✓ Taslak kaydedildi"
                    : planChanged
                        ? "Önce planı yeniden kontrol et"
                        : "Taslağı kaydet"}

              </button>

              {planChanged && (<button type="button" onClick={revalidatePlan} disabled={busy} style={{
                    marginTop: 14,
                    marginLeft: 10,
                    padding: "12px 18px",
                    background: "#426b58",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 10,
                    cursor: busy ? "wait" : "pointer",
                    opacity: busy ? 0.6 : 1,
                }}>

                  {checking ? "Kontrol ediliyor..." : "Yeniden kontrol et"}

                </button>)}

              <section aria-label="İş planı kalite kontrolü" style={{
                marginTop: 18,
                padding: 18,
                borderRadius: 14,
                background: planChanged || issues.length > 0 ? "#fff8ed" : "#f0f8f1",
                border: planChanged || issues.length > 0
                    ? "1px solid #ebd5ab"
                    : "1px solid #c9dfcc",
            }}>

                <strong style={{ display: "block", marginBottom: 8 }}>

                  {planChanged
                ? "⚠️ Düzenlenen plan yeniden kontrol edilmeli"
                : issues.length > 0
                    ? `⚠️ ${issues.length} kalite uyarısı`
                    : "✓ Otomatik kalite kontrolü tamamlandı"}

                </strong>

                {planChanged ? (<p style={{ fontSize: 13, margin: "8px 0" }}>

                    Görevler değiştirildi. Önceki otomatik kalite sonuçları artık geçerli değil.

                    Yeniden kontrol et düğmesine basarak güncel kalite sonucunu görüntüleyebilirsin.

                  </p>) : issues.length > 0 ? (<ul style={{ paddingLeft: 22, lineHeight: 1.7, margin: "8px 0" }}>

                    {issues.map((issue, index) => (<li key={`${issue.code}-${issue.taskIndex ?? "plan"}-${index}`}>

                        {issue.taskIndex !== undefined && (<strong>Görev {issue.taskIndex + 1}: </strong>)}

                        {issue.message}

                      </li>))}

                  </ul>) : (<p style={{ fontSize: 13, margin: "8px 0" }}>

                    Tanımlı otomatik kontrollerde uyarı bulunmadı.

                    Bu sonuç planın tüm yönleriyle doğru olduğunu garanti etmez.

                  </p>)}

                <small style={{ color: "#826e4f" }}>

                  Kontrol bilgilendirme amaçlıdır; hiçbir görev atanmadı.

                </small>

              </section>

              <p style={{ fontSize: 12, color: "#738476" }}>

                {savedPlanId
                ? `Taslak SQLite'a kaydedildi (kimlik: ${savedPlanId}). Sayfa yenilendiğinde kart ekrandan kaybolabilir; kayıt veritabanında kalır. Kayıtlı planlar bölümünden tekrar açabilirsin.`
                : planChanged
                    ? "Düzenlemeler henüz kaydedilmedi. Önce yeniden kalite kontrolü yap, sonra taslağı kaydet. Daha önce kaydedilmiş sürüm varsa SQLite'da korunur."
                    : "Bu taslak henüz kaydedilmedi. Sayfa yenilenirse bu kart kaybolur."}

                {" "}Hiçbir görev atanmadı ve hiçbir ajan çalıştırılmadı.

              </p>

            </div>)}

          {loading && (<div style={{
                alignSelf: "flex-start",
                padding: 14,
                borderRadius: 14,
                background: "#f3f5f2",
            }}>

              Ece yanıt hazırlıyor...

            </div>)}

          {planning && (<div style={{
                alignSelf: "flex-start",
                padding: 14,
                borderRadius: 14,
                background: "#f3f5f2",
            }}>

              Ece iş planı taslağını hazırlıyor...

            </div>)}

          {checking && (<div role="status" style={{
                alignSelf: "flex-start",
                padding: 14,
                borderRadius: 14,
                background: "#f3f5f2",
            }}>

              Düzenlenen plan kontrol ediliyor...

            </div>)}

          <div ref={bottomRef}/>

        </section>

        {error && (<p role="alert" style={{
                color: "#b42318",
                padding: "0 24px",
            }}>

            {error}

          </p>)}

        <form onSubmit={sendMessage} style={{
            borderTop: "1px solid #e5ebe4",
            padding: 20,
        }}>

          <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ece'ye mesaj veya iş planı hedefi yaz..." maxLength={2000} rows={3} style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            padding: 14,
            border: "1px solid #d5dfd5",
            borderRadius: 12,
            resize: "vertical",
            background: "#ffffff",
            color: "#24372c",
            font: "inherit",
        }}/>

          <div style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: 12,
            marginTop: 12,
        }}>

            <button type="button" onClick={createPlan} disabled={busy ||
            input.trim().length < 10 ||
            input.trim().length > 1500} style={{
            padding: "13px 18px",
            background: "#e2eadd",
            color: "#315b42",
            border: "1px solid #b8cdbb",
            borderRadius: 12,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ||
                input.trim().length < 10 ||
                input.trim().length > 1500
                ? 0.55
                : 1,
        }}>

              {planning ? "Plan hazırlanıyor..." : "İş planı oluştur"}

            </button>

            <button type="submit" disabled={busy || !input.trim()} style={{
            padding: "13px 22px",
            background: "#426b58",
            color: "white",
            border: 0,
            borderRadius: 12,
            cursor: busy ? "wait" : "pointer",
            opacity: busy || !input.trim() ? 0.55 : 1,
        }}>

              {loading ? "Bekle..." : "Gönder"}

            </button>

          </div>

          <p style={{
            marginBottom: 0,
            color: "#8a978c",
            fontSize: 12,
        }}>

            Gönder: normal sohbet. İş planı oluştur: görev taslağı.

            Yerel modelle plan hazırlamak biraz sürebilir.

          </p>

        </form>

      </div>

    </main>);
}
