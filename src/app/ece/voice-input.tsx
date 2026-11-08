"use client";
import { useEffect, useRef, useState } from "react";
import { createVoiceConversation, type ConversationPhase } from "@/domain/voice-conversation";
import type { RecognitionConstructor } from "@/domain/speech-capture";
import "./voice-input.css";

type Props = {
  disabled: boolean; hasDraft: boolean; speaking: boolean; pendingReply: boolean; onCancelReply(): void; onClearDraft(): void;
  onStopOutput(): void; onActiveChange(active: boolean): void; onSessionChange(active: boolean): void;
  onSubmit(text: string, isCurrent: () => boolean): Promise<boolean>;
};

export default function VoiceInput(props: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<ConversationPhase>("idle");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const callbacks = useRef(props);
  const conversation = useRef<ReturnType<typeof createVoiceConversation> | null>(null);
  useEffect(() => { callbacks.current = props; }, [props]);
  useEffect(() => {
    const browser = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    setSupported(Boolean(Recognition));
    if (!Recognition) return;
    const session = createVoiceConversation({
      recognition: () => new Recognition(),
      reply: (text, current) => callbacks.current.onSubmit(text, current),
      stopOutput: () => callbacks.current.onStopOutput(),
      preview: setPreview, error: setError,
      phase: value => { setPhase(value); callbacks.current.onActiveChange(value === "listening"); callbacks.current.onSessionChange(value !== "idle"); },
    });
    conversation.current = session;
    const onVisibility = () => { if (document.hidden) session.stop(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { document.removeEventListener("visibilitychange", onVisibility); session.dispose(); conversation.current = null; };
  }, []);
  const active = phase !== "idle";
  return <section className={`ece-voice-input ${active ? "is-active" : ""}`} aria-label="Ece ile sesli görüşme">
    <div className="ece-voice-buttons">
      {!active ? <button type="button" className="voice-start" onClick={() => { setError(""); conversation.current?.start(); }} disabled={props.disabled || props.hasDraft || !supported}>◉ Sesli görüşmeyi başlat</button>
        : <><button type="button" className="voice-end" onClick={() => conversation.current?.stop()}>Görüşmeyi bitir</button>
          {phase === "listening" ? <button type="button" onClick={() => conversation.current?.finishUtterance()}>Sözümü bitirdim</button>
            : props.speaking && <button type="button" onClick={() => conversation.current?.interrupt()}>Söz al</button>}</>}
      <span role="status"><i className={active ? "voice-dot active" : "voice-dot"} />{phase === "listening" ? "Seni dinliyorum" : phase === "responding" ? props.speaking ? "Ece konuşuyor" : "Ece yanıtını hazırlıyor" : props.pendingReply ? "Önceki yanıt bekleniyor" : "Yazmadan, Türkçe konuşarak devam et"}</span>
    </div>
    {!active && props.pendingReply && <button type="button" onClick={props.onCancelReply}>Bekleyen isteği durdur</button>}
    {preview && <p className="ece-voice-transcript"><strong>Sen:</strong> {preview}</p>}
    {error && <p role="alert">{error}</p>}
    {supported === false ? <p>Bu tarayıcı sesli görüşmeyi desteklemiyor. Güncel Chrome’da açabilir veya yazıyla devam edebilirsin.</p>
      : <p>{active ? "Ece’nin yanıtı bitince yeniden seni dinleyeceğim. Sekmeden ayrılınca görüşme kapanır." : "Mikrofon görüşme boyunca sırayla açılır. Tarayıcı sesi çevrimiçi tanıma servisine gönderebilir."}</p>}
    {props.hasDraft && !active && <div><p>Başlamadan önce yazdığın taslağı gönder veya temizle.</p><button type="button" onClick={props.onClearDraft}>Taslağı temizle</button></div>}
  </section>;
}
