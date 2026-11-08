import { test } from "node:test";
import assert from "node:assert/strict";
import { createVoiceConversation, type ConversationPhase } from "../src/domain/voice-conversation";
import type { Recognition } from "../src/domain/speech-capture";

function setup() {
  const microphones: Recognition[] = [], phases: ConversationPhase[] = [], errors: string[] = [];
  const replies: { text: string; current(): boolean; finish(value: boolean): void }[] = [];
  let stops = 0;
  const session = createVoiceConversation({
    recognition() {
      const r: Recognition = { lang: "", continuous: true, interimResults: false, maxAlternatives: 1, onresult: null, onerror: null, onend: null, start() {}, stop() {}, abort() {} };
      microphones.push(r); return r;
    },
    reply: (text, current) => new Promise(resolve => replies.push({ text, current, finish: resolve })),
    stopOutput: () => { stops++; }, phase: p => phases.push(p), preview: () => {}, error: e => errors.push(e),
  });
  const utterance = (r = microphones.at(-1)!) => {
    r.onresult?.({ results: [{ isFinal: true, 0: { transcript: "Bugün ne yapalım?" } }] }); r.onend?.();
  };
  return { session, microphones, replies, phases, errors, utterance, stops: () => stops };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test("conversation resumes only after reply playback completes", async () => {
  const s = setup(); s.session.start(); s.utterance();
  assert.equal(s.microphones.length, 1); assert.equal(s.phases.at(-1), "responding");
  await tick(); assert.equal(s.microphones.length, 1);
  s.replies[0].finish(true); await tick();
  assert.equal(s.microphones.length, 2); assert.equal(s.phases.at(-1), "listening"); s.session.dispose();
});
test("ending a call invalidates a pending reply and prevents microphone restart", async () => {
  const s = setup(); s.session.start(); s.utterance(); s.session.stop();
  assert.equal(s.replies[0].current(), false); s.replies[0].finish(true); await tick();
  assert.equal(s.microphones.length, 1); assert.equal(s.phases.at(-1), "idle");
});
test("old reply cannot affect a newly started call", async () => {
  const s = setup(); s.session.start(); s.utterance(); s.session.stop(); s.session.start();
  s.replies[0].finish(true); await tick();
  assert.equal(s.microphones.length, 2); assert.equal(s.phases.at(-1), "listening"); s.session.dispose();
});
test("taking the floor cancels old reply generation before listening again", async () => {
  const s = setup(); s.session.start(); s.utterance(); s.session.interrupt();
  assert.equal(s.replies[0].current(), false); assert.equal(s.microphones.length, 2);
  s.replies[0].finish(false); await tick();
  assert.equal(s.phases.at(-1), "listening"); s.session.dispose();
});
test("recognition or playback failure stops instead of retrying in a loop", async () => {
  const s = setup(); s.session.start(); s.microphones[0].onerror!({ error: "not-allowed" });
  assert.equal(s.phases.at(-1), "idle"); assert.equal(s.microphones.length, 1); assert.equal(s.errors.length, 1);
  s.session.start(); s.utterance(); s.replies[0].finish(false); await tick();
  assert.equal(s.phases.at(-1), "idle"); assert.equal(s.microphones.length, 2);
});
test("unmount invalidates callbacks and stops audio", async () => {
  const s = setup(); s.session.start(); s.utterance(); const stops = s.stops(); s.session.dispose();
  assert.equal(s.replies[0].current(), false); assert.equal(s.stops(), stops + 1);
  s.replies[0].finish(true); await tick(); assert.equal(s.microphones.length, 1);
});
