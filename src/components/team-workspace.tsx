"use client";



import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";

import { ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleHelp, ClipboardList, Code2, FileText, FolderKanban, Grid2X2, Layers3, List, LoaderCircle, Menu, MessageSquare, MoreHorizontal, Pause, Play, Plus, Search, Settings2, ShieldCheck, Sparkles, Users, Video, X } from "lucide-react";

import type { TeamMember } from "@/domain/team";



type ProfileTab = "profile" | "cv" | "connections";

type DialogState = { kind: "profile"; id: string } | { kind: "form"; id?: string } | { kind: "delete"; id: string } | null;

type MemberForm = { name: string; role: string; department: string; description: string; skills: string; responsibilities: string; workingStyle: string; color: string; avatarKey: string; project: string };



const DEPARTMENTS = ["Yönetim", "Geliştirme", "Tasarım", "Kalite", "Araştırma"];

const COLORS = ["#426b58", "#9b7459", "#7a75a2", "#547c95", "#ad8250", "#966c80"];

const EMPTY_FORM: MemberForm = { name: "", role: "", department: "Geliştirme", description: "", skills: "", responsibilities: "", workingStyle: "", color: COLORS[0], avatarKey: "ada", project: "ARKEMX" };



function textKey(value: string) { return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i"); }

function shortDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }); }



async function request<T>(url: string, options?: RequestInit): Promise<T> {

  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });

  const result = await response.json();

  if (!response.ok) throw new Error(result.error?.message || "İşlem tamamlanamadı. Lütfen yeniden deneyin.");

  return result.data as T;

}



function Portrait({ member, large = false }: { member: Pick<TeamMember, "name" | "color" | "avatarKey">; large?: boolean }) {

  const key = textKey(member.avatarKey || member.name);

  const variant = key.includes("ece") ? 0 : key.includes("ada") ? 1 : key.includes("deniz") ? 2 : key.includes("bora") ? 3 : key.includes("selin") ? 4 : [...key].reduce((a, b) => a + b.charCodeAt(0), 0) % 5;

  const backgrounds = ["#e2eadd", "#ede0d2", "#e6e1ef", "#deebf0", "#f0e5d3"];

  const skin = ["#d4a17c", "#e1b18c", "#d7a286", "#c8916c", "#e6bb95"][variant];

  const hair = ["#343b32", "#4b352b", "#37322f", "#353c40", "#62432f"][variant];

  return <div className={`portrait${large ? " portrait-large" : ""}`} style={{ background: backgrounds[variant] }}>

    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">

      <circle cx="81" cy="21" r="15" fill="white" fillOpacity=".25" />

      <path d="M-6 83C10 69 23 81 34 70C46 58 62 68 74 58C86 48 99 53 108 44V105H-6Z" fill={member.color} fillOpacity=".1" />

      {variant === 0 || variant === 4 ? <path d="M27 56C22 23 33 13 51 14C73 14 80 31 75 64L68 79H28Z" fill={hair} /> : null}

      <path d="M20 103C20 77 32 70 50 70C69 70 82 78 82 103Z" fill={member.color} />

      <path d="M42 63H59V77C55 84 46 83 41 77Z" fill={skin} />

      <path d="M43 68L59 65V72C55 76 47 75 43 72Z" fill="#34251d" fillOpacity=".08" />

      <ellipse cx="32" cy="49" rx="4" ry="6" fill={skin} /><ellipse cx="69" cy="49" rx="4" ry="6" fill={skin} />

      <path d="M32 37C32 23 68 22 69 38V51C69 64 61 72 51 72C40 72 32 63 32 51Z" fill={skin} />

      {variant === 0 ? <path d="M30 43C26 23 41 17 53 20C72 19 77 35 70 46L64 32C53 38 45 38 35 33L33 46Z" fill={hair} /> : null}

      {variant === 1 ? <path d="M29 44C24 30 31 18 47 18C66 14 77 26 72 42L66 45L62 31C49 36 42 34 36 30L34 46Z" fill={hair} /> : null}

      {variant === 2 ? <path d="M30 46C20 41 25 26 31 26C24 18 41 12 48 19C52 9 68 15 67 22C78 22 81 36 70 44L65 33C57 36 41 37 35 32L35 46Z" fill={hair} /> : null}

      {variant === 3 ? <path d="M29 46V30C31 19 47 14 60 20C74 21 76 31 70 44L65 44L63 31L36 35L35 46Z" fill={hair} /> : null}

      {variant === 4 ? <path d="M30 48C22 32 33 18 50 20C71 13 80 34 70 48L65 32C53 39 46 40 34 38L34 49Z" fill={hair} /> : null}

      <path d="M40 45L46 44M57 44L63 45" stroke={hair} strokeWidth="1.8" strokeLinecap="round" />

      <circle cx="43" cy="50" r="1.35" fill="#2f302b" /><circle cx="60" cy="50" r="1.35" fill="#2f302b" />

      <path d="M51 51L49 57H53" stroke="#9f6d51" strokeOpacity=".65" strokeWidth="1.2" strokeLinecap="round" />

      <path d="M46 62C49 65 54 65 57 61" stroke="#81513e" strokeWidth="1.5" strokeLinecap="round" />

      {variant === 1 || variant === 3 ? <><rect x="35.5" y="46" width="13.5" height="10" rx="4" stroke="#353c34" strokeWidth="1.6" /><rect x="54" y="46" width="13.5" height="10" rx="4" stroke="#353c34" strokeWidth="1.6" /><path d="M49 49H54M32 48H35M68 48H71" stroke="#353c34" strokeWidth="1.5" /></> : null}

      {variant === 2 ? <circle cx="70" cy="55" r="2.5" stroke="#b69a56" strokeWidth="1.5" /> : null}

      {variant === 0 ? <><circle cx="31" cy="55" r="1.5" fill="#d8bd7d" /><circle cx="70" cy="55" r="1.5" fill="#d8bd7d" /></> : null}

      <path d="M41 77L50 86L60 77" stroke="white" strokeOpacity=".6" strokeWidth="2" />

    </svg>

  </div>;

}



function StudioMark({ small = false }: { small?: boolean }) {

  return <span className={`studio-mark${small ? " small" : ""}`} aria-hidden="true"><svg viewBox="0 0 32 32" fill="none"><path d="M8 25L16 7L24 25M11 19H21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M24 7V12M21.5 9.5H26.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></span>;

}



function Dialog({ children, title, description, onClose, kind = "drawer", back }: { children: ReactNode; title: string; description?: string; onClose: () => void; kind?: "drawer" | "form" | "confirm"; back?: () => void }) {

  const ref = useRef<HTMLDialogElement>(null);

  const id = useId();

  useEffect(() => {

    const previous = document.activeElement as HTMLElement | null;

    const dialog = ref.current;

    if (dialog && !dialog.open) dialog.showModal();

    return () => { dialog?.close(); previous?.focus(); };

  }, []);

  return <dialog className={`workspace-dialog ${kind}`} ref={ref} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>

    <div className="dialog-shell">

      <header className="dialog-heading"><div className="dialog-title-row">{back ? <button className="icon-button" onClick={back} aria-label="Profile dön"><ArrowLeft size={18} /></button> : null}<div><p className="eyebrow">ARKEMX STUDIO</p><h2 id={`${id}-title`}>{title}</h2></div></div><button className="icon-button close-dialog" onClick={onClose} aria-label="Pencereyi kapat"><X size={20} /></button></header>

      {description ? <p className="dialog-description" id={`${id}-description`}>{description}</p> : null}

      {children}

    </div>

  </dialog>;

}



export default function TeamWorkspace({ initialMembers }: { initialMembers: TeamMember[] }) {

  const [members, setMembers] = useState(initialMembers);

  const [search, setSearch] = useState("");

  const [department, setDepartment] = useState("Tüm departmanlar");

  const [view, setView] = useState<"grid" | "list">("grid");

  const [dialog, setDialog] = useState<DialogState>(null);

  const [tab, setTab] = useState<ProfileTab>("profile");

  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeMember = dialog && "id" in dialog ? members.find(member => member.id === dialog.id) : undefined;

  const visibleMembers = members.filter(member => {

    const matchesDepartment = department === "Tüm departmanlar" || member.department === department;

    const matchesSearch = textKey([member.name, member.role, member.department, ...(member.skills || [])].join(" ")).includes(textKey(search.trim()));

    return matchesDepartment && matchesSearch;

  });

  const completedCount = members.reduce((sum, member) => sum + member.experience.filter(item => item.verification === "verified").length, 0);

  const readyCount = members.filter(member => member.status === "ready").length;



  useEffect(() => { if (!notice) return; const timeout = window.setTimeout(() => setNotice(""), 5000); return () => window.clearTimeout(timeout); }, [notice]);

  useEffect(() => { if (!sidebarOpen) return; function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setSidebarOpen(false); } document.addEventListener("keydown", closeOnEscape); return () => document.removeEventListener("keydown", closeOnEscape); }, [sidebarOpen]);



  function closeDialog() { if (!busy) { setDialog(null); setError(""); } }

  function openProfile(member: TeamMember) { setTab("profile"); setError(""); setDialog({ kind: "profile", id: member.id }); }

  function openForm(member?: TeamMember) {

    setError("");

    setForm(member ? { name: member.name, role: member.role, department: member.department, description: member.description, skills: member.skills.join(", "), responsibilities: member.responsibilities.join("\n"), workingStyle: member.workingStyle, color: member.color, avatarKey: member.avatarKey, project: member.project } : { ...EMPTY_FORM });

    setDialog({ kind: "form", id: member?.id });

  }

  function updateForm<K extends keyof MemberForm>(key: K, value: MemberForm[K]) { setForm(previous => ({ ...previous, [key]: value })); }

  function replaceMember(member: TeamMember) { setMembers(previous => previous.map(item => item.id === member.id ? member : item)); }

  async function saveMember(event: FormEvent<HTMLFormElement>) {

    event.preventDefault(); if (busy) return;

    setBusy(true); setError("");

    const payload = { ...form, name: form.name.trim(), role: form.role.trim(), description: form.description.trim(), skills: [...new Set(form.skills.split(",").map(value => value.trim()).filter(Boolean))], responsibilities: [...new Set(form.responsibilities.split("\n").map(value => value.trim()).filter(Boolean))], workingStyle: form.workingStyle.trim(), project: form.project.trim() || "ARKEMX" };

    try {

      if (activeMember) { const member = await request<TeamMember>(`/api/team/${encodeURIComponent(activeMember.id)}`, { method: "PATCH", body: JSON.stringify({ ...payload, revision: activeMember.revision }) }); replaceMember(member); setDialog({ kind: "profile", id: member.id }); setNotice(`${member.name} profili güncellendi.`); }

      else { const member = await request<TeamMember>("/api/team", { method: "POST", body: JSON.stringify(payload) }); setMembers(previous => [...previous, member]); setDialog({ kind: "profile", id: member.id }); setNotice(`${member.name} ekibine eklendi.`); }

      setTab("profile");

    } catch (failure) { setError(failure instanceof Error ? failure.message : "Profil kaydedilemedi."); }

    finally { setBusy(false); }

  }

  async function changeStatus(member: TeamMember) {

    if (busy) return; setBusy(true); setError("");

    try { const updated = await request<TeamMember>(`/api/team/${encodeURIComponent(member.id)}`, { method: "PATCH", body: JSON.stringify({ status: member.status === "ready" ? "paused" : "ready", revision: member.revision }) }); replaceMember(updated); setNotice(updated.status === "paused" ? `${updated.name} profili duraklatıldı.` : `${updated.name} profili yeniden hazır.`); }

    catch (failure) { setError(failure instanceof Error ? failure.message : "Durum değiştirilemedi."); }

    finally { setBusy(false); }

  }

  async function removeMember(member: TeamMember) {

    if (busy) return; setBusy(true); setError("");

    try { await request<{ id: string }>(`/api/team/${encodeURIComponent(member.id)}?revision=${member.revision}`, { method: "DELETE" }); setMembers(previous => previous.filter(item => item.id !== member.id)); setDialog(null); setNotice(`${member.name} ekipten çıkarıldı.`); }

    catch (failure) { setError(failure instanceof Error ? failure.message : "Ekip üyesi çıkarılamadı."); }

    finally { setBusy(false); }

  }

  function exportTeam() {

    const data = { schemaVersion: 1, exportedAt: new Date().toISOString(), studio: "ARKEMX Studio", members };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });

    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `arkemx-ekibim-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); setNotice("Ekip profilleri dışa aktarıldı.");

  }



  return <div className="studio-app">

    {sidebarOpen ? <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Gezinme menüsünü kapat" /> : null}

    <aside className={`sidebar${sidebarOpen ? " is-open" : ""}`} aria-label="Ana gezinme">

      <div className="brand"><StudioMark /><div><strong>ARKEMX<span> STUDIO</span></strong><small>Fikirler burada büyür.</small></div><button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Menüyü kapat"><X size={18} /></button></div>

      <div className="workspace-switch"><span className="workspace-icon"><Layers3 size={17} /></span><div><strong>Yazılım stüdyom</strong><small>Kişisel çalışma alanı</small></div><ChevronDown size={14} /></div>

      <p className="nav-label">ÇALIŞMA ALANI</p>

      <nav className="main-navigation"><a href="#ekibim" className="nav-item active" aria-current="page" onClick={() => setSidebarOpen(false)}><Users size={19} /><span>Ekibim</span><span className="nav-count">{members.length}</span></a><button className="nav-item" disabled><FolderKanban size={19} /><span>Projeler</span><small>Yakında</small></button><button className="nav-item" disabled><Video size={19} /><span>Toplantılar</span><small>Yakında</small></button><button className="nav-item" disabled><ClipboardList size={19} /><span>Görevler</span><small>Yakında</small></button></nav>

      <div className="sidebar-projects"><p className="nav-label">İLK PROJEN</p><div className="project-row"><span className="project-square">A</span><span>ARKEMX</span><span className="project-dot" /></div><p>Ekibinin ilk çalışma alanı.</p></div>

      <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-symbol"><Sparkles size={18} /></span><strong>Küçük ekip. Büyük fikirler.</strong><p>Ekibini kur, rollerini belirle.<br />Birlikte üretmeye hazırlan.</p><span className="step-label">İLK ADIM <span>01 / 03</span></span><div className="step-track"><span /></div></div><div className="founder"><span className="founder-avatar">K</span><div><strong>Kurucu</strong><small>Çalışma alanı sahibi</small></div><span className="founder-dot" /></div></div>

    </aside>



    <div className="app-body">

      <header className="topbar"><div className="topbar-location"><button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Gezinme menüsünü aç" aria-expanded={sidebarOpen}><Menu size={21} /></button><span className="topbar-studio">Yazılım stüdyom</span><span className="breadcrumb-separator">/</span><span>Ekibim</span></div><div className="topbar-actions"><span className="local-badge"><span />Kişisel çalışma alanı</span><span className="topbar-avatar" aria-label="Kurucu profili">K</span></div></header>



      <main className="main-content" id="ekibim">

        <div className="page-heading"><div><p className="eyebrow"><span /> STÜDYO / EKİP</p><h1>Ekibim<span className="heading-period">.</span></h1><p className="page-subtitle">Fikirlerini hayata geçirecek ekiple tanış.</p></div><button className="button button-primary add-member-button" onClick={() => openForm()}><Plus size={18} /><span>Ekip üyesi ekle</span></button></div>



        <section className="welcome-banner" aria-labelledby="welcome-title"><div className="banner-copy"><span className="banner-overline"><Sparkles size={14} /> BİRLİKTE, FİKİRDEN ÜRÜNE</span><h2 id="welcome-title">İyi işler, iyi bir ekiple başlar.</h2><p>Her birinin bir rolü, çalışma tarzı ve zamanla oluşacak bir hikâyesi var.<br className="desktop-break" /> Önce ekibini tanı. Sonra ilk hedefinizi birlikte belirleyin.</p><div className="banner-status"><span className="status-ring"><Check size={10} /></span>Ekip profilleri hazır<span className="status-divider" />AI bağlantıları henüz kurulmadı</div></div><div className="banner-art" aria-hidden="true"><span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" /><span className="art-axis" /><span className="art-star star-one">✦</span><span className="art-star star-two">✦</span><div className="art-card art-card-back"><Code2 size={23} /></div><div className="art-card art-card-main"><Users size={27} /><span>EKİBİN</span><div className="art-card-lines"><i /><i /></div></div><div className="art-pill"><span />Birlikte daha ileri</div></div></section>



        <section className="team-stats" aria-label="Ekip özeti"><div className="stat-item"><span className="stat-icon"><Users size={18} /></span><div><span className="stat-number">{members.length}</span><span className="stat-label">Ekip üyesi</span></div></div><div className="stat-item"><span className="stat-icon"><Layers3 size={18} /></span><div><span className="stat-number">0</span><span className="stat-label">Bağlı AI ajanı</span></div><span className="stat-hint">Kurulum bekliyor</span></div><div className="stat-item"><span className="stat-icon"><ShieldCheck size={18} /></span><div><span className="stat-number">{completedCount}</span><span className="stat-label">Doğrulanmış çalışma</span></div></div></section>



        <section className="team-section" aria-labelledby="team-title"><div className="section-heading"><div><h2 id="team-title">Ekibinle tanış.</h2><p>Kalıcı profiller. Net sorumluluklar. Ortak bir hedef.</p></div><button className="button button-quiet export-button" onClick={exportTeam}><ArrowDownToLine size={16} /><span>Dışa aktar</span></button></div>

          <div className="team-toolbar"><label className="search-field"><Search size={18} /><span className="sr-only">Ekipte ara</span><input type="search" placeholder="İsim, rol veya yetkinlik ara..." value={search} onChange={event => setSearch(event.target.value)} />{search ? <button aria-label="Aramayı temizle" onClick={() => setSearch("")}><X size={15} /></button> : <kbd>⌕</kbd>}</label><div className="toolbar-right"><label className="department-filter"><span className="sr-only">Departmana göre filtrele</span><Settings2 size={15} /><select value={department} onChange={event => setDepartment(event.target.value)}><option>Tüm departmanlar</option>{DEPARTMENTS.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label><div className="view-switch" aria-label="Görünüm"><button className={view === "grid" ? "selected" : ""} onClick={() => setView("grid")} aria-label="Kart görünümü" aria-pressed={view === "grid"}><Grid2X2 size={17} /></button><button className={view === "list" ? "selected" : ""} onClick={() => setView("list")} aria-label="Liste görünümü" aria-pressed={view === "list"}><List size={18} /></button></div></div></div>

          <div className="results-caption"><span>{visibleMembers.length} ekip üyesi{department !== "Tüm departmanlar" ? ` · ${department}` : ""}</span><span><i />{readyCount} profil hazır</span></div>

          {visibleMembers.length ? <div className={`team-grid ${view === "list" ? "list-view" : ""}`}>{visibleMembers.map(member => <article className={`member-card${member.status === "paused" ? " is-paused" : ""}`} key={member.id} style={{ "--member-color": member.color } as React.CSSProperties}>

            <div className="member-card-top"><Portrait member={member} /><div className="member-card-top-right"><span className={`member-status ${member.status}`}><i />{member.status === "ready" ? "Profil hazır" : "Duraklatıldı"}</span><button className="icon-button member-more" onClick={() => openProfile(member)} aria-label={`${member.name} profilini aç`}><MoreHorizontal size={20} /></button></div></div>

            <div className="member-main"><span className="member-department">{member.department}</span><h3>{member.name}</h3><p className="member-role">{member.role}</p><p className="member-description">{member.description}</p><div className="skills-list">{member.skills.slice(0, 3).map(skill => <span className="skill-chip" key={skill}>{skill}</span>)}{member.skills.length > 3 ? <span className="skill-chip">+{member.skills.length - 3}</span> : null}</div></div>

            <div className="member-card-bottom"><span className="member-project"><span className="tiny-project-mark">A</span>{member.project || "ARKEMX"}</span><button className="profile-link" onClick={() => openProfile(member)}>Profili görüntüle<ArrowUpRight size={15} /></button></div>

          </article>)}<button className="add-member-card" onClick={() => openForm()}><span className="add-card-icon"><Plus size={23} /></span><strong>Ekibinde bir kişilik daha yer var.</strong><span>Yeni bir rol, yeni bir bakış açısı.</span><span className="add-card-link">Ekip üyesi ekle<ArrowRight size={15} /></span></button></div> : <div className="empty-results"><span><Search size={25} /></span><h3>{members.length ? "Aradığın ekip üyesi bulunamadı." : "Ekibinin hikâyesi burada başlıyor."}</h3><p>{members.length ? "Başka bir isim, rol veya yetkinlik deneyebilirsin." : "İlk ekip üyesini ekleyerek çalışma alanını oluştur."}</p><button className="button button-secondary" onClick={() => { if (!members.length) openForm(); else { setSearch(""); setDepartment("Tüm departmanlar"); } }}>{members.length ? "Filtreleri temizle" : "İlk ekip üyesini ekle"}</button></div>}

        </section>



        <footer className="page-footer"><span><ShieldCheck size={15} />İş geçmişi, tamamlanan ve doğrulanan çalışmalarla oluşur.</span><span>ARKEMX Studio<span className="footer-dot">·</span>İlk sürüm · v0.1</span></footer>

      </main>

    </div>



    {notice ? <div className="toast" role="status"><span><Check size={15} /></span>{notice}<button onClick={() => setNotice("")} aria-label="Bildirimi kapat"><X size={15} /></button></div> : null}



    {dialog?.kind === "profile" && activeMember ? <Dialog title="Çalışan profili" onClose={closeDialog}><div className="profile-hero"><Portrait member={activeMember} large /><span className={`member-status ${activeMember.status}`}><i />{activeMember.status === "ready" ? "Profil hazır" : "Duraklatıldı"}</span><h3>{activeMember.name}</h3><p>{activeMember.role}</p><span className="profile-department">{activeMember.department}</span></div><div className="profile-actions"><button className="button button-primary" onClick={() => openForm(activeMember)}><Settings2 size={15} />Profili düzenle</button>

    {activeMember.id === "ece" ? (
          <a href="/ece" className="button button-secondary">
            <MessageSquare size={15} />Sohbet başlat
          </a>
        ) : (
          <button
            type="button"
            className="button button-secondary"
            disabled
            title="AI bağlantısı henüz kurulmadı"
          >
            <MessageSquare size={15} />Sohbet başlat
          </button>
        )}

      </div><p className="connection-caption"><span />{activeMember.id === "ece" ? "Yerel AI sohbeti kullanılabilir" : "AI bağlantısı bekliyor"}</p>

      <div className="profile-tabs" role="tablist" aria-label="Profil bölümleri">{([{ key: "profile", label: "Profil" }, { key: "cv", label: "CV ve geçmiş" }, { key: "connections", label: "Bağlantılar" }] as const).map(item => <button key={item.key} role="tab" aria-selected={tab === item.key} aria-controls={`profile-panel-${item.key}`} id={`profile-tab-${item.key}`} onClick={() => setTab(item.key)}>{item.label}</button>)}</div>

      <div className="profile-content" role="tabpanel" id={`profile-panel-${tab}`} aria-labelledby={`profile-tab-${tab}`}>

        {error ? <div className="inline-error" role="alert">{error}</div> : null}

        {tab === "profile" ? <><section className="profile-section"><h4>Ekibe katkısı</h4><p>{activeMember.description || "Bu profil için açıklama henüz eklenmedi."}</p></section><section className="profile-section"><h4>Tanımlanan yetkinlikler</h4><div className="skills-list profile-skills">{activeMember.skills.length ? activeMember.skills.map(skill => <span className="skill-chip" key={skill}>{skill}</span>) : <p>Henüz yetkinlik tanımlanmadı.</p>}</div><small className="field-note">Rolün hedef yetkinlikleri. Doğrulanmış deneyim geçmişte ayrıca gösterilir.</small></section><section className="profile-section"><h4>Sorumluluklar</h4><ul className="responsibility-list">{activeMember.responsibilities.length ? activeMember.responsibilities.map(item => <li key={item}><Check size={14} />{item}</li>) : <li>Henüz sorumluluk tanımlanmadı.</li>}</ul></section><section className="profile-section"><h4>Çalışma tarzı</h4><p>{activeMember.workingStyle || "Çalışma tarzı henüz tanımlanmadı."}</p></section><div className="profile-project-panel"><span className="project-square">A</span><div><small>İlk çalışma alanı</small><strong>{activeMember.project || "ARKEMX"}</strong></div><FolderKanban size={19} /></div></> : null}

        {tab === "cv" ? <><section className="cv-summary"><span><FileText size={23} /></span><h4>Her iş, hikâyeye yeni bir satır.</h4><p>Bu CV, ajanın kendi teslimleri ve kontrol sonuçlarıyla oluşur. Önceden devraldığı proje bilgisi, yaptığı iş olarak sayılmaz.</p></section><div className="cv-meta"><div><small>Ekibe katılım</small><strong>{shortDate(activeMember.createdAt)}</strong></div><div><small>Doğrulanmış çalışma</small><strong>{activeMember.experience.filter(item => item.verification === "verified").length}</strong></div></div><section className="profile-section"><h4>Çalışma geçmişi</h4>{activeMember.experience.length ? <ul className="experience-list">{activeMember.experience.map(experience => <li key={experience.id}><span className={`evidence-dot ${experience.verification}`} /><div><strong>{experience.title}</strong><p>{experience.project} · {shortDate(experience.date)}</p><span className="evidence-status">{experience.verification === "verified" ? "Doğrulandı" : "Doğrulama bekliyor"}</span>{experience.evidenceUrl && /^https?:\/\//i.test(experience.evidenceUrl) ? <a href={experience.evidenceUrl} target="_blank" rel="noopener noreferrer">Çalışma kanıtını aç<ArrowUpRight size={13} /></a> : null}</div></li>)}</ul> : <div className="history-empty"><span><ClipboardList size={23} /></span><strong>Henüz çalışma kaydı yok.</strong><p>İlk görevi tamamlandığında ürettiği sonuçlar ve doğrulama bilgileri burada yer alacak.</p></div>}</section></> : null}

        {tab === "connections" ? <><div className="connection-empty"><span><Code2 size={27} /></span><h4>Bir sonraki adım: AI bağlantısı.</h4><p>Bu çalışan henüz bir AI modeline veya kod ajanına bağlı değil. Profilini şimdi hazırlayabilir, bağlantısını sonraki aşamada kurabilirsin.</p><span className="connection-state"><i />Henüz bağlanmadı</span></div><div className="connection-explanation"><CircleHelp size={17} /><p>“Profil hazır”, rol ve sorumlulukların hazır olduğunu belirtir. Ajanın çalıştığı veya çevrimiçi olduğu anlamına gelmez.</p></div></> : null}

      </div><div className="profile-management"><button className="button button-quiet" disabled={busy} onClick={() => changeStatus(activeMember)}>{busy ? <LoaderCircle className="spin" size={15} /> : activeMember.status === "ready" ? <Pause size={15} /> : <Play size={15} />}{activeMember.status === "ready" ? "Profili duraklat" : "Profili etkinleştir"}</button><button className="remove-member" disabled={busy} onClick={() => { setError(""); setDialog({ kind: "delete", id: activeMember.id }); }}>Ekipten çıkar</button></div></Dialog> : null}



    {dialog?.kind === "form" ? <Dialog title={activeMember ? "Profili düzenle" : "Yeni ekip üyesi"} description={activeMember ? "Rolünü ve ekibe nasıl katkı sağlayacağını güncelle." : "Ekibine yeni bir bakış açısı ekle. AI bağlantısı daha sonra kurulacak."} onClose={closeDialog} kind="form" back={activeMember ? () => { setError(""); setDialog({ kind: "profile", id: activeMember.id }); } : undefined}><form className="member-form" onSubmit={saveMember}>

      {error ? <div className="inline-error" role="alert">{error}</div> : null}

      <div className="form-avatar-row"><Portrait member={{ name: form.name || "Yeni", color: form.color, avatarKey: form.avatarKey }} /><div><strong>Çalışan kimliği</strong><span>Profilin ekibinde kalıcı olarak yer alır.</span><div className="color-options" aria-label="Profil rengi">{COLORS.map(color => <button type="button" key={color} aria-label={`${color} profil rengi`} aria-pressed={form.color === color} className={form.color === color ? "selected" : ""} style={{ backgroundColor: color }} onClick={() => updateForm("color", color)}>{form.color === color ? <Check size={12} /> : null}</button>)}</div></div></div>

      <div className="form-row"><label>İsim<span className="required-star">*</span><input required maxLength={80} value={form.name} onChange={event => updateForm("name", event.target.value)} placeholder="Örn. Ece" autoComplete="off" /></label><label>Departman<span className="required-star">*</span><select value={form.department} onChange={event => updateForm("department", event.target.value)}>{DEPARTMENTS.map(item => <option key={item}>{item}</option>)}</select></label></div>

      <label>Rol / unvan<span className="required-star">*</span><input required maxLength={80} value={form.role} onChange={event => updateForm("role", event.target.value)} placeholder="Örn. Yazılım mimarı" /></label>

      <label>Ekibe katkısı<span className="required-star">*</span><textarea required rows={3} maxLength={700} value={form.description} onChange={event => updateForm("description", event.target.value)} placeholder="Hangi işi üstlenecek, ekibe nasıl katkı sağlayacak?" /></label>

      <label>Hedef yetkinlikler<input maxLength={600} value={form.skills} onChange={event => updateForm("skills", event.target.value)} placeholder="React, Kullanıcı deneyimi, Arayüz tasarımı" /><small>Yetkinlikleri virgülle ayır. Gerçek deneyim çalışmalarıyla oluşacak.</small></label>

      <label>Sorumluluklar<textarea rows={3} maxLength={2000} value={form.responsibilities} onChange={event => updateForm("responsibilities", event.target.value)} placeholder={"Her sorumluluğu ayrı satıra yaz.\nÖrn. Kullanıcı akışlarını tasarlamak"} /></label>

      <label>Çalışma tarzı<textarea rows={2} maxLength={600} value={form.workingStyle} onChange={event => updateForm("workingStyle", event.target.value)} placeholder="Örn. Küçük adımlarla ilerler, kararlarının gerekçesini açıklar." /></label>

      <div className="form-row"><label>İlk çalışma alanı<input maxLength={80} value={form.project} onChange={event => updateForm("project", event.target.value)} placeholder="ARKEMX" /></label><label>Profil karakteri<select value={form.avatarKey} onChange={event => updateForm("avatarKey", event.target.value)}><option value="ece">Ece</option><option value="ada">Ada</option><option value="deniz">Deniz</option><option value="bora">Bora</option><option value="selin">Selin</option></select></label></div>

      <div className="form-footer"><button type="button" className="button button-secondary" disabled={busy} onClick={closeDialog}>Vazgeç</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{busy ? "Kaydediliyor…" : activeMember ? "Değişiklikleri kaydet" : "Ekibe ekle"}</button></div>

    </form></Dialog> : null}



    {dialog?.kind === "delete" && activeMember ? <Dialog kind="confirm" title="Ekipten çıkar" onClose={closeDialog}><div className="confirm-body"><p><strong>{activeMember.name}</strong> artık ekip listende görünmeyecek. Bu işlem bir AI bağlantısını veya projedeki kodları değiştirmez.</p>{error ? <div className="inline-error" role="alert">{error}</div> : null}<div className="confirm-actions"><button className="button button-secondary" disabled={busy} onClick={() => setDialog({ kind: "profile", id: activeMember.id })}>Vazgeç</button><button className="button button-danger" disabled={busy} onClick={() => removeMember(activeMember)}>{busy ? <LoaderCircle size={16} className="spin" /> : null}{busy ? "Çıkarılıyor…" : "Ekipten çıkar"}</button></div></div></Dialog> : null}

  </div>;

}
