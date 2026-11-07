import { test } from "node:test";
import assert from "node:assert/strict";
import { captureSpeech, type Recognition } from "../src/domain/speech-capture";

function setup() {
  const sent: string[] = [], previews: string[] = [], errors: string[] = [];
  let ends = 0, aborts = 0, stops = 0;
  const recognition: Recognition = {
    lang: "", continuous: true, interimResults: false, maxAlternatives: 4,
    onresult: null, onerror: null, onend: null,
    start() {}, stop() { stops++; }, abort() { aborts++; },
  };
  const session = captureSpeech(recognition, { preview: t => previews.push(t), complete: t => sent.push(t), error: e => errors.push(e), end: () => ends++ });
  return { recognition, session, sent, previews, errors, ends: () => ends, aborts: () => aborts, stops: () => stops };
}

test("Turkish utterance sends finalized transcript exactly once, after recognition ends", () => {
  const s = setup();
  assert.equal(s.recognition.lang, "tr-TR");
  assert.equal(s.recognition.continuous, false);
  s.recognition.onresult!({ results: [{ isFinal: false, 0: { transcript: "Mer" } }] });
  assert.deepEqual(s.sent, []);
  s.recognition.onresult!({ results: [{ isFinal: true, 0: { transcript: "Merhaba Ece" } }] });
  s.recognition.onend!(); s.recognition.onend!();
  assert.deepEqual(s.sent, ["Merhaba Ece"]); assert.equal(s.ends(), 1);
});
test("cancel prevents even late final results from sending a message", () => {
  const s = setup(); s.session.cancel();
  s.recognition.onresult!({ results: [{ isFinal: true, 0: { transcript: "Gönderme" } }] });
  s.recognition.onend!();
  assert.deepEqual(s.sent, []); assert.equal(s.aborts(), 1);
});
test("denied microphone and network failure stop capture without sending partial content", () => {
  for (const error of ["not-allowed", "network"]) {
    const s = setup(); s.recognition.onerror!({ error }); s.recognition.onend!();
    assert.equal(s.errors.length, 1); assert.deepEqual(s.sent, []); assert.equal(s.aborts(), 1);
  }
});
test("silence and unfinished recognition do not fabricate a user message", () => {
  const s = setup();
  s.recognition.onresult!({ results: [{ isFinal: false, 0: { transcript: "Belirsiz" } }] });
  s.recognition.onend!(); assert.deepEqual(s.sent, []); assert.equal(s.errors.length, 1);
});
test("stop waits for final result and an oversized utterance is rejected", () => {
  const s = setup(); s.session.stop(); assert.equal(s.stops(), 1); assert.deepEqual(s.sent, []);
  s.recognition.onresult!({ results: [{ isFinal: true, 0: { transcript: "a".repeat(2001) } }] });
  s.recognition.onend!(); assert.deepEqual(s.sent, []); assert.equal(s.errors.length, 1);
});
test("unmount removes recognition callbacks and aborts capture", () => {
  const s = setup(); s.session.dispose();
  assert.equal(s.recognition.onresult, null); assert.equal(s.recognition.onend, null); assert.equal(s.aborts(), 1);
});
