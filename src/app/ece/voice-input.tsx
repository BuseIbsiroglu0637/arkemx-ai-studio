"use client";
import { useEffect, useRef, useState } from "react";
import { captureSpeech, type RecognitionConstructor } from "@/domain/speech-capture";
import "./voice-input.css";

type Props = {
  disabled: boolean; hasDraft: boolean; onStart(): void;
  onActiveChange(active: boolean): void; onSubmit(text: string): void;
};

export default function VoiceInput(props: Props) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const callbacks = useRef(props);
  const constructor = useRef<RecognitionConstructor | null>(null);
  const capture = useRef<ReturnType<typeof captureSpeech> | null>(null);
  useEffect(() => { callbacks.current = props; }, [props]);
  useEffect(() => {
    const browser = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
    constructor.current = browser.SpeechRecognition || browser.webkitSpeechRecognition || null;
    setSupported(Boolean(constructor.current));
    const onVisibilityChange = () => { if (document.hidden) capture.current?.cancel(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { document.removeEventListener("visibilitychange", onVisibilityChange); capture.current?.dispose(); };
  }, []);

  function start() {
    if (!constructor.current || active || props.disabled || props.hasDraft) return;
    capture.current?.dispose();
    setPreview(""); setError("");
    props.onStart(); setActive(true); props.onActiveChange(true);
    try {
      capture.current = captureSpeech(new constructor.current(), {
        preview: setPreview,
        complete: text => callbacks.current.onSubmit(text),
        error: setError,
        end: () => { setActive(false); callbacks.current.onActiveChange(false); },
      });
    } catch { setActive(false); props.onActiveChange(false); setError("Mikrofon başlatılamadı."); }
  }

  return <section className="ece-voice-input" aria-label="Ece ile sesli sohbet">
    <div className="ece-voice-buttons">
      {active ? <><button type="button" onClick={() => capture.current?.stop()}>Dinlemeyi bitir ve gönder</button><button type="button" onClick={() => { capture.current?.cancel(); setPreview(""); }}>İptal</button></>
        : <button type="button" onClick={start} disabled={props.disabled || props.hasDraft || !supported}>Mikrofonla konuş</button>}
      <span role="status">{active ? "Seni dinliyorum… Konuşman bitince Ece’ye gönderilecek." : "Türkçe dinleme · Türkçe sesli yanıt"}</span>
    </div>
    {preview && <p className="ece-voice-transcript" aria-live="polite"><strong>Duyduğum:</strong> {preview}</p>}
    {error && <p role="alert">{error}</p>}
    {supported === false ? <p>Bu tarayıcı sesli girişi desteklemiyor. Bu sayfayı güncel Chrome’da açabilir veya yazıyla devam edebilirsin.</p>
      : <p>Mikrofon yalnız sen başlattığında açılır. Tarayıcı, sesini yazıya çevirmek için çevrimiçi konuşma servisine gönderebilir. Ece yanıtladıktan sonra tekrar konuşmak için düğmeye bas.</p>}
    {props.hasDraft && !active && <p>Önce yazdığın taslağı gönder veya temizle.</p>}
  </section>;
}
