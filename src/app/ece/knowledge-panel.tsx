"use client";
import { useEffect, useRef, useState } from "react";
import type { EceKnowledge } from "@/server/ece-knowledge-store";

export default function KnowledgePanel({ refresh, onClose, onEdit }: { refresh: number; onClose(): void; onEdit(command: string): void }) {
  const [records, setRecords] = useState<EceKnowledge[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { close.current?.focus(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    void fetch("/api/agents/ece/knowledge", { cache: "no-store", signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.data?.records)) throw new Error("Hafıza kayıtları okunamadı.");
      setRecords(result.data.records);
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Hafıza açılamadı."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh, attempt]);
  const filtered = records.filter(r => `${r.title} ${r.content}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR")));
  return <aside className="ece-memory-panel" aria-label="Ece’nin hafızası" onKeyDown={event => { if (event.key === "Escape") onClose(); }}>
    <header><div><span className="workspace-eyebrow">KALICI HAFIZA</span><h2>Ece’nin hatırladıkları</h2></div><button ref={close} type="button" onClick={onClose}>Kapat</button></header>
    <p>Son 50 aktif kayıt. Bir kaydı düzenlemek için isteğini sohbette tamamlayabilirsin.</p>
    <input aria-label="Hafıza kayıtlarında ara" placeholder="Başlık veya içerikte ara…" value={query} onChange={e => setQuery(e.target.value)} />
    <div className="memory-records">
      {loading ? <p role="status">Hafıza yükleniyor…</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => setAttempt(a => a + 1)}>Yeniden dene</button></div>
        : filtered.length === 0 ? <p>{query ? "Bu aramayla eşleşen kayıt yok." : "Henüz kayıtlı bilgi yok. Ece’ye hatırlamasını istediğin bir bilgiyi söyleyebilirsin."}</p>
          : filtered.map(record => <article key={record.id}><small>{record.project || "Genel bilgi"}</small><h3>{record.title}</h3><p>{record.content}</p><footer><time dateTime={record.updatedAt}>{new Date(record.updatedAt).toLocaleDateString("tr-TR")}</time><button type="button" onClick={() => onEdit(`Ece, hafızandaki ${record.title} kaydını güncelle: `)}>Sohbette düzenle</button></footer></article>)}
    </div>
  </aside>;
}
