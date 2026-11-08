
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMemorySaveCommand,
  parseMemoryArchiveCommand,
  parseMemoryRestoreCommand,
  parseMemoryUpdateCommand,
} from "../src/domain/knowledge-command";

test("Ece hafıza komutlarını doğru tanır", () => {
  const command = parseMemorySaveCommand(
    "Ece, hafızana kaydet: ARKEMX için mobil uygulama geliştireceğiz."
  );

  assert.equal(
    command,
    "ARKEMX için mobil uygulama geliştireceğiz."
  );

  const normalMessage = parseMemorySaveCommand(
    "Ece, bugün nasılsın?"
  );

  assert.equal(normalMessage, null);

  const shortCommand = parseMemorySaveCommand(
    "hafızana kaydet: abc"
  );

  assert.equal(shortCommand, null);
});

test("Ece arşivleme komutunu doğru tanır", () => {
  const command = parseMemoryArchiveCommand(
    "Ece, hafızandaki Sanal Emlak Ofisi kaydını arşivle."
  );

  assert.equal(command, "Sanal Emlak Ofisi");

  const normalMessage = parseMemoryArchiveCommand(
    "Ece, bugün nasılsın?"
  );

  assert.equal(normalMessage, null);

  const incompleteCommand = parseMemoryArchiveCommand(
    "Ece, hafızandaki kaydı arşivle."
  );

  assert.equal(incompleteCommand, null);
});

test("Ece geri yükleme komutunu doğru tanır", () => {
  const command = parseMemoryRestoreCommand(
    "Ece, hafızandaki Sanal Emlak Ofisi kaydını geri yükle."
  );

  assert.equal(command, "Sanal Emlak Ofisi");

  const normalMessage = parseMemoryRestoreCommand(
    "Ece, bugün nasılsın?"
  );

  assert.equal(normalMessage, null);

  const incompleteCommand = parseMemoryRestoreCommand(
    "Ece, hafızandaki kaydı geri yükle."
  );

  assert.equal(incompleteCommand, null);
});

test("Ece hafıza güncelleme komutunu doğru tanır", () => {
  const command = parseMemoryUpdateCommand(
    "Ece, hafızandaki Sanal Emlak Ofisi kaydını güncelle: Projeye sesli AI asistanı eklenecek."
  );

  assert.deepEqual(command, {
    title: "Sanal Emlak Ofisi",
    content: "Projeye sesli AI asistanı eklenecek.",
  });

  // Normal konuşma güncelleme komutu sayılmamalı.
  assert.equal(
    parseMemoryUpdateCommand("Ece, bugün nasılsın?"),
    null
  );

  // Yeni içerik belirtilmemişse reddedilmeli.
  assert.equal(
    parseMemoryUpdateCommand(
      "Ece, hafızandaki Sanal Emlak Ofisi kaydını güncelle:"
    ),
    null
  );
});
