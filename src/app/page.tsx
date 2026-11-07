"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import EceAvatar from "./ece/ece-avatar";
import "./welcome-home.css";

const GREETING_KEY = "arkemx-ece-home-greeted-v2";
const WELCOME_TEXT = "Merhaba, hoş geldin. Ben Ece. Masama buyur. Bugün aklında ne var? Yeni bir fikri konuşabiliriz. Ya da kaldığımız yerden devam edebiliriz.";

export default function HomePage() {
  const [greeting, setGreeting] = useState(false);
  const [greetingSignal, setGreetingSignal] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const voiceRequestRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Aynı tarayıcı sekmesinde yalnızca ilk açılışta otomatik el salla.
  // "Tekrar selamla" ile her zaman test edilebilir.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(GREETING_KEY) !== "yes") {
        sessionStorage.setItem(GREETING_KEY, "yes");
        setGreeting(true);
      }
    } catch {
      // Özel gezinme/güvenlik ayarlarında sessionStorage kapalı olabilir.
      setGreeting(true);
    }
  }, []);

  const stopVoice = useCallback(() => {
    voiceRequestRef.current?.abort();
    voiceRequestRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.removeAttribute("src");
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setVoiceLoading(false);
    setSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      voiceRequestRef.current?.abort();
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  async function speakWelcome() {
    stopVoice();
    setVoiceError("");
    setVoiceLoading(true);
    const controller = new AbortController();
    voiceRequestRef.current = controller;
    try {
      const response = await fetch("/api/agents/ece/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: WELCOME_TEXT, voice: "emel" }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error?.message || "Ece'nin kadın sesi alınamadı.");
      }
      if (!response.headers.get("content-type")?.includes("audio/mpeg")) {
        throw new Error("Ses servisi MP3 yerine farklı bir yanıt verdi.");
      }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { if (audioRef.current === audio) stopVoice(); };
      audio.onerror = () => {
        if (audioRef.current === audio) {
          stopVoice();
          setVoiceError("Ses dosyası oynatılamadı.");
        }
      };
      await audio.play(); // Ses sadece butona basıldığında oynatılır.
      if (audioRef.current === audio) setSpeaking(true);
    } catch (error) {
      if (!controller.signal.aborted) {
        stopVoice();
        setVoiceError(error instanceof Error ? error.message : "Ses başlatılamadı.");
      }
    } finally {
      if (voiceRequestRef.current === controller) {
        voiceRequestRef.current = null;
        setVoiceLoading(false);
      }
    }
  }

  function replayGreeting() {
    setGreetingSignal((current) => current + 1);
  }

  return (
    <main className="arkemx-home">
      <div className="arkemx-home-inner">
        <header className="arkemx-home-topbar">
          <Link className="arkemx-home-brand" href="/" aria-label="ARKEMX ana sayfası">
            <span className="arkemx-home-mark">✦</span>
            <span><strong>ARKEMX</strong><small>AI STUDIO</small></span>
          </Link>
          <nav className="arkemx-home-topnav" aria-label="Üst gezinme">
            <Link href="/ece">Ece'nin Ofisi</Link>
            <Link href="/team">AI Ekibim</Link>
          </nav>
        </header>

        <section className="arkemx-home-hero" aria-label="Ece'nin karşılaması">
          <div className="arkemx-home-avatar-wrap">
            <EceAvatar
              setting="office"
              greeting={greeting}
              greetingSignal={greetingSignal}
              showIntro={false}
              speaking={speaking}
            />
            <div className="arkemx-home-avatar-caption">
              <span className="arkemx-home-avatar-dot" aria-hidden="true" />
              <span><strong>Ece</strong><small>AI Ekip ve Ürün Lideri</small></span>
              <span className="arkemx-home-3d">3D</span>
            </div>
          </div>

          <div className="arkemx-home-hero-text">
            <span className="arkemx-home-eyebrow">ARKEMX YÖNETİCİ MERKEZİ</span>
            <h1>Merhaba,<br /><em>hoş geldin!</em> <span aria-hidden="true">👋</span></h1>
            <p>Ben Ece. Bugün yeni bir fikir mi geliştireceğiz, yoksa birlikte üzerinde çalıştığımız işlerden birine mi devam edeceğiz?</p>
            <p className="arkemx-home-secondary">Bir proje seçmek zorunda değilsin. Aklındaki herhangi bir konuyla konuşmaya başlayabiliriz.</p>
            <div className="arkemx-home-actions">
              <Link className="arkemx-home-primary" href="/ece">Ece ile çalışmaya başla <span aria-hidden="true">↗</span></Link>
              <button className="arkemx-home-secondary-button" type="button" onClick={replayGreeting}>👋 Tekrar selamla</button>
            </div>
            <div className="arkemx-home-voice-controls">

              {speaking || voiceLoading ? (
                <button type="button" onClick={stopVoice}>■ {voiceLoading ? "Ses hazırlanıyor… İptal et" : "Sesi durdur"}</button>
              ) : (
                <button type="button" onClick={() => void speakWelcome()}>♫ Ece'nin selamını dinle</button>
              )}
              <span>Türkçe kadın sesi · İsteğe bağlı</span>
            </div>
            {voiceError && <p className="arkemx-home-error" role="alert">{voiceError}</p>}
          </div>
        </section>

        <section className="arkemx-home-workspaces" aria-label="Çalışma alanları">
          <div className="arkemx-home-sectionheading">
            <h2>Çalışma alanların</h2>
            <p>İstediğin bölüme geç, çalışmalarını kaldığın yerden sürdür.</p>
          </div>
          <div className="arkemx-home-cards">
            <Link href="/team" className="arkemx-home-card">
              <span className="arkemx-home-card-icon" aria-hidden="true">◈</span>
              <strong>AI Ekibim</strong>
              <span>Uzman ajanlarını görüntüle ve yönet</span>
              <span className="arkemx-home-card-arrow" aria-hidden="true">↗</span>
            </Link>
            <Link href="/ece" className="arkemx-home-card">
              <span className="arkemx-home-card-icon" aria-hidden="true">◇</span>
              <strong>Karar Merkezi</strong>
              <span>Ece'nin Ofisi'nde Kararlar sekmesini aç</span>
              <span className="arkemx-home-card-arrow" aria-hidden="true">↗</span>
            </Link>
            <Link href="/ece" className="arkemx-home-card">
              <span className="arkemx-home-card-icon" aria-hidden="true">▤</span>
              <strong>İş Planları</strong>
              <span>Ece'nin Ofisi'nde Planlar sekmesini aç</span>
              <span className="arkemx-home-card-arrow" aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>
        <footer className="arkemx-home-footer">ARKEMX AI STUDIO <span>·</span> Ece ile yönet, ekibinle geliştir.</footer>
      </div>
    </main>
  );
}
