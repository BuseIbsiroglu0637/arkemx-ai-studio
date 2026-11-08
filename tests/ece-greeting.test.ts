import { test } from "node:test";
import assert from "node:assert/strict";
import { getEceGreetingReply } from "../src/domain/ece-greeting";

test("short Turkish greetings receive immediate Turkish replies", () => {
  for (const text of ["Merhaba", "Merhabaa", "Ece, merhaba!", "Selam Ece", "İyi akşamlar."]) {
    assert.match(getEceGreetingReply(text) || "", /Merhaba, buradayım/u);
  }
});
test("greeting shortcut never swallows substantive questions or memory commands", () => {
  for (const text of ["Merhaba, emlak fikrimizi hatırlıyor musun?", "Selam Ece, hafızana kaydet: yeni proje", "Merhaba, Ada görevini bitirdi mi?", "Ece", ""]) {
    assert.equal(getEceGreetingReply(text), null);
  }
});

test("a repeated wellbeing question gets a conversational answer instead of an echo", () => {
  for (const text of ["Nasılsın", "Nasılsın Nasılsın", "Ece, nasılsın?", "Nasıl gidiyor nasıl gidiyor?"]) {
    const reply = getEceGreetingReply(text);
    assert.match(reply || "", /Sorduğun için teşekkür ederim/u);
    assert.doesNotMatch(reply || "", /Başka bir soru sor/u);
  }
});

test("personal context and follow-up questions still reach the conversation model", () => {
  for (const text of ["Nasılsın? Ben bugün çok yorgunum.", "Teşekkürler, şimdi mobil fikrimi konuşalım.", "Nasılsın Ece, bana bir plan öner."]) {
    assert.equal(getEceGreetingReply(text), null);
  }
});
