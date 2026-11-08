
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { chatWithEce } from "../src/server/ece-chat";

import {
  saveEceKnowledge,
  listEceKnowledge,
  getKnowledgeDatabase,
  archiveEceKnowledge,
} from "../src/server/ece-knowledge-store";

test("Ece sohbetten hafızasını güvenle yönetir", async () => {
  // Test için geçici veritabanı oluştur.
  const directory = mkdtempSync(
    join(tmpdir(), "ece-chat-archive-")
  );

  process.env.ARKEMX_STUDIO_DATA_DIR = directory;

  // 1. İki farklı hafıza kaydı oluştur.
  const target = saveEceKnowledge({
    kind: "idea",
    title: "Sanal Emlak Ofisi",
    content: "AI destekli emlak projesi.",
  });

  const other = saveEceKnowledge({
    kind: "idea",
    title: "Muhasebe Asistanı",
    content: "AI destekli muhasebe projesi.",
  });

  // 2. Sohbet üzerinden hedef kaydı arşivle.
  const archiveResponse = await chatWithEce(
    "Ece, hafızandaki Sanal Emlak Ofisi kaydını arşivle."
  );

  assert.match(archiveResponse, /arşivledim/u);

  // Hedef arşivlenmeli, diğer kayıt aktif kalmalı.
  const active = listEceKnowledge();

  assert.equal(active.length, 1);
  assert.equal(active[0].id, other.id);

  const archivedRow = getKnowledgeDatabase()
    .prepare(
      "SELECT status FROM ece_knowledge WHERE id = ?"
    )
    .get(target.id) as { status: string };

  assert.equal(archivedRow.status, "archived");

  // 3. Aynı başlıkla iki farklı aktif kayıt oluştur.
  const first = saveEceKnowledge({
    kind: "idea",
    title: "Ortak Başlık",
    content: "Birinci proje fikri.",
  });

  const second = saveEceKnowledge({
    kind: "idea",
    title: "Ortak Başlık",
    content: "İkinci proje fikri.",
  });

  // Ece belirsiz başlıktaki kayıtları arşivlememeli.
  const archiveWarning = await chatWithEce(
    "Ece, hafızandaki Ortak Başlık kaydını arşivle."
  );

  assert.match(
    archiveWarning,
    /birden fazla aktif kayıt/u
  );

  // Her iki kayıt da aktif kalmalı.
  const db = getKnowledgeDatabase();

  for (const id of [first.id, second.id]) {
    const row = db.prepare(
      "SELECT status FROM ece_knowledge WHERE id = ?"
    ).get(id) as { status: string };

    assert.equal(row.status, "saved");
  }

  // 4. İlk arşivlenen kaydı sohbetten geri yükle.
  const restoreResponse = await chatWithEce(
    "Ece, hafızandaki Sanal Emlak Ofisi kaydını geri yükle."
  );

  assert.match(
    restoreResponse,
    /geri yükledim/u
  );

  // Kayıt aynı kimlikle yeniden aktif olmalı.
  const restoredRow = getKnowledgeDatabase()
    .prepare(
      "SELECT status FROM ece_knowledge WHERE id = ?"
    )
    .get(target.id) as { status: string };

  assert.equal(restoredRow.status, "saved");

  // Geri yüklenen bilgi hafıza listesinde görünmeli.
  const activeAfterRestore = listEceKnowledge();

  assert.ok(
    activeAfterRestore.some(
      (record) => record.id === target.id
    )
  );

  // Diğer kayıt da korunmalı.
  assert.ok(
    activeAfterRestore.some(
      (record) => record.id === other.id
    )
  );

  // Sohbet üzerinden hafıza kaydını güncelle.
  const updateResponse = await chatWithEce(
    "Ece, hafızandaki Sanal Emlak Ofisi kaydını güncelle: Projeye sesli AI asistanı eklenecek."
  );

  assert.match(updateResponse, /güncelledim/u);

  // Yeni içerik aynı kayıt kimliğiyle saklanmalı.
  const updatedMemory = listEceKnowledge().find(
    (record) => record.id === target.id
  );

  assert.ok(updatedMemory);

  assert.equal(
    updatedMemory.content,
    "Projeye sesli AI asistanı eklenecek."
  );

  // Diğer kaydın içeriği değişmemeli.
  const otherMemory = listEceKnowledge().find(
    (record) => record.id === other.id
  );

  assert.ok(otherMemory);

  assert.equal(
    otherMemory.content,
    "AI destekli muhasebe projesi."
  );

  // Belirsiz başlıkla güncelleme yapılmamalı.
  const updateWarning = await chatWithEce(
    "Ece, hafızandaki Ortak Başlık kaydını güncelle: Yeni proje bilgisi."
  );

  assert.match(
    updateWarning,
    /birden fazla aktif kayıt/u
  );

  // İki kaydın da eski içeriği korunmalı.
  const firstMemory = listEceKnowledge().find(
    (record) => record.id === first.id
  );

  const secondMemory = listEceKnowledge().find(
    (record) => record.id === second.id
  );

  assert.ok(firstMemory);
  assert.ok(secondMemory);

  assert.equal(
    firstMemory.content,
    "Birinci proje fikri."
  );

  assert.equal(
    secondMemory.content,
    "İkinci proje fikri."
  );

  // 5. Aynı başlıklı iki arşiv kaydı oluştur.
  const firstArchived = saveEceKnowledge({
    kind: "note",
    title: "Ortak Arşiv",
    content: "Birinci arşiv bilgisi.",
  });

  const secondArchived = saveEceKnowledge({
    kind: "note",
    title: "Ortak Arşiv",
    content: "İkinci arşiv bilgisi.",
  });

  // İkisini de arşivle.
  assert.equal(
    archiveEceKnowledge(firstArchived.id),
    true
  );

  assert.equal(
    archiveEceKnowledge(secondArchived.id),
    true
  );

  // 6. Belirsiz başlıkla geri yükleme iste.
  const restoreWarning = await chatWithEce(
    "Ece, hafızandaki Ortak Arşiv kaydını geri yükle."
  );

  assert.match(
    restoreWarning,
    /birden fazla arşivlenmiş kayıt/u
  );

  // İki kayıt da arşivde kalmalı.
  for (const id of [firstArchived.id, secondArchived.id]) {
    const row = getKnowledgeDatabase()
      .prepare(
        "SELECT status FROM ece_knowledge WHERE id = ?"
      )
      .get(id) as { status: string };

    assert.equal(row.status, "archived");
  }
});
