import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chatWithEce } from "../src/server/ece-chat";
process.env.ARKEMX_STUDIO_DATA_DIR = mkdtempSync(join(tmpdir(), "ece-voice-model-test-"));

test("voice requests use a short reply profile and retain Turkish safety instructions", async context => {
  let captured: Record<string, unknown> | undefined;
  context.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    captured = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ message: { content: "Önce çözmek istediğin sorunu belirleyelim." }, done_reason: "stop" }));
  });
  const reply = await chatWithEce("Bir fikre nasıl başlamalıyım?", { mode: "voice" });
  assert.match(reply, /sorunu/u);
  assert.equal(captured?.model, process.env.ECE_VOICE_MODEL?.trim() || "qwen3:1.7b");
  assert.equal((captured?.options as { num_predict: number }).num_predict, 128);
  assert.match(JSON.stringify(captured?.messages), /Yalnızca doğal Türkçeyle/u);
  assert.match(JSON.stringify(captured?.messages), /Yapmadığın işi yaptığını söyleme/u);
});
test("cancelling the incoming chat request propagates to the local model", async context => {
  let modelSignal: AbortSignal | undefined;
  context.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    modelSignal = init.signal as AbortSignal;
    return new Promise((_resolve, reject) => modelSignal!.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true }));
  });
  const controller = new AbortController();
  const pending = chatWithEce("Bir fikre nasıl başlamalıyım?", { mode: "voice", signal: controller.signal });
  const assertion = assert.rejects(pending, /beklenenden uzun|süresi|durduruldu/u);
  controller.abort();
  await assertion;
  assert.equal(modelSignal?.aborted, true);
});
