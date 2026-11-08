/** Exact social turns only: never swallow a substantive question or memory command. */
export function getEceGreetingReply(message: string): string | null {
  const text = message.toLocaleLowerCase("tr-TR").trim()
    .replace(/[.!?,;:]+/gu, " ").replace(/\s+/gu, " ").trim()
    .replace(/^ece\s+/u, "").replace(/\s+ece$/u, "");
  if (/^(merhaba+|selam|günaydın|iyi günler|iyi akşamlar)(?:\s+\1){0,2}$/u.test(text)) {
    return "Merhaba, buradayım. Bugün ne üzerinde çalışalım?";
  }
  if (/^(nasılsın|nasıl gidiyor)(?:\s+\1){0,2}$/u.test(text)) {
    return "Sorduğun için teşekkür ederim. Buradayım ve seninle konuşmaya hazırım. Sen nasılsın, günün nasıl geçiyor?";
  }
  if (/^(teşekkür ederim|teşekkürler|sağ ol|sağol)(?:\s+\1){0,2}$/u.test(text)) {
    return "Rica ederim. Yardımcı olabildiysem ne güzel.";
  }
  return null;
}
