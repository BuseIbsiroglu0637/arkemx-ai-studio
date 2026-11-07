export type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
export type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
export type RecognitionConstructor = new () => Recognition;

export const speechErrors: Record<string, string> = {
  "not-allowed": "Mikrofon izni verilmedi. Tarayıcının site izinlerinden mikrofonu açabilirsin.",
  "service-not-allowed": "Tarayıcı konuşma tanıma servisine izin vermiyor. Güncel Chrome ile deneyebilirsin.",
  "audio-capture": "Mikrofon bulunamadı veya başka bir uygulama kullanıyor.",
  "no-speech": "Sesini duyamadım. Mikrofona biraz yaklaşarak tekrar deneyebilirsin.",
  network: "Konuşma tanıma servisine ulaşılamadı. İnternet bağlantını kontrol et.",
  "language-not-supported": "Bu tarayıcı Türkçe konuşma tanımayı desteklemiyor.",
};

/** One utterance per explicit start; never reopens the microphone automatically. */
export function captureSpeech(recognition: Recognition, callbacks: {
  preview(text: string): void; complete(text: string): void; end(): void; error(message: string): void;
}) {
  let cancelled = false;
  let failed = false;
  let ended = false;
  let finalText = "";
  let timeout: ReturnType<typeof setTimeout> | undefined;
  recognition.lang = "tr-TR";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  const end = () => { if (!ended) { ended = true; clearTimeout(timeout); callbacks.end(); } };
  recognition.onresult = event => {
    if (cancelled || failed || ended) return;
    const results = Array.from(event.results);
    finalText = results.filter(result => result.isFinal).map(result => result[0].transcript).join(" ").trim();
    callbacks.preview(results.map(result => result[0].transcript).join(" ").trim());
    if (finalText.length > 2000) {
      failed = true;
      callbacks.error("Konuşman mesaj sınırını aştı. Daha kısa bölümler halinde söyleyebilirsin.");
      recognition.abort(); end();
    }
  };
  recognition.onerror = event => {
    if (cancelled || ended) return;
    failed = true;
    callbacks.error(speechErrors[event.error] || "Konuşma anlaşılamadı. Yazıyla devam edebilir veya tekrar deneyebilirsin.");
    end();
    recognition.abort();
  };
  recognition.onend = () => {
    if (ended) return;
    end();
    if (!cancelled && !failed) {
      if (finalText) callbacks.complete(finalText);
      else callbacks.error(speechErrors["no-speech"]);
    }
  };
  try {
    recognition.start();
    if (!ended) timeout = setTimeout(() => {
      cancelled = true;
      recognition.abort(); end();
      callbacks.error("Dinleme süresi doldu. Tekrar konuşabilir veya yazıyla devam edebilirsin.");
    }, 60_000);
  }
  catch { failed = true; callbacks.error("Mikrofon başlatılamadı. Tarayıcı izinlerini kontrol et."); end(); }
  return {
    stop() { if (!ended) { try { recognition.stop(); } catch { this.cancel(); } } },
    cancel() { cancelled = true; recognition.abort(); end(); },
    dispose() { cancelled = true; clearTimeout(timeout); recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); },
  };
}
