
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseMemorySaveCommand } from
  "../src/domain/knowledge-command";

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
