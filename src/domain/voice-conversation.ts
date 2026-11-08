import { captureSpeech, type Recognition } from "./speech-capture";
export type ConversationPhase = "idle" | "listening" | "responding";

/** Never reopen the microphone until the reply has finished playing. */
export function createVoiceConversation(deps: {
  recognition(): Recognition;
  reply(text: string, isCurrent: () => boolean): Promise<boolean>;
  stopOutput(): void; phase(value: ConversationPhase): void;
  preview(text: string): void; error(message: string): void;
}) {
  let enabled = false, generation = 0;
  let capture: ReturnType<typeof captureSpeech> | null = null;
  function stop() {
    enabled = false; generation++; capture?.dispose(); capture = null;
    deps.stopOutput(); deps.phase("idle");
  }
  function listen(epoch: number) {
    if (!enabled || generation !== epoch) return;
    deps.preview(""); deps.phase("listening");
    const current = () => enabled && generation === epoch;
    try {
      const next = captureSpeech(deps.recognition(), {
        preview: text => { if (current()) deps.preview(text); }, end: () => {},
        error: message => { if (current()) { stop(); deps.error(message); } },
        complete: async text => {
          if (!current()) return;
          deps.phase("responding");
          try {
            const success = await deps.reply(text, current);
            if (!current()) return;
            if (success) listen(epoch); else stop();
          } catch {
            if (current()) { stop(); deps.error("Görüşme kesildi. Yeniden başlatabilir veya yazıyla devam edebilirsin."); }
          }
        },
      });
      capture?.dispose(); capture = next;
      if (!current()) { next.dispose(); capture = null; }
    } catch { stop(); deps.error("Mikrofon başlatılamadı."); }
  }
  return {
    start() { stop(); enabled = true; listen(++generation); }, stop,
    finishUtterance() { capture?.stop(); },
    interrupt() { if (enabled) { generation++; capture?.dispose(); capture = null; deps.stopOutput(); listen(generation); } },
    dispose() { enabled = false; generation++; capture?.dispose(); capture = null; deps.stopOutput(); },
  };
}
