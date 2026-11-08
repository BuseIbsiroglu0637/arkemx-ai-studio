
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  getKnowledgeDatabase,
  saveEceKnowledge,
  listEceKnowledge,
  searchEceKnowledge,
} from "../src/server/ece-knowledge-store";

test("Ece bir fikri kalıcı hafızaya kaydeder", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "arkemx-second-brain-")
  );

  process.env.ARKEMX_STUDIO_DATA_DIR = directory;

  const saved = saveEceKnowledge({
    kind: "idea",
    title: "Sanal Emlak Ofisi",
    content: "AI destekli emlak ofisi geliştirme fikri.",
    project: "ARKEMX",
  });

  const duplicate = saveEceKnowledge({
    kind: "idea",
    title: "Sanal Emlak Ofisi",
    content: "AI destekli emlak ofisi geliştirme fikri.",
    project: "ARKEMX",
  });

  assert.equal(duplicate.id, saved.id);

  assert.throws(() => {
    const db = getKnowledgeDatabase();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO ece_knowledge (
        id, kind, status, title, content,
        project, source_message_id,
        created_at, updated_at
      )
      VALUES (?, ?, 'saved', ?, ?, ?, NULL, ?, ?)
    `).run(
      "duplicate-test-id",
      saved.kind,
      saved.title,
      saved.content,
      saved.project,
      now,
      now
    );
  }, /UNIQUE constraint failed/);
  assert.equal(listEceKnowledge().length, 1);

  const row = getKnowledgeDatabase()
    .prepare(
      "SELECT kind, status, title FROM ece_knowledge WHERE id = ?"
    )
    .get(saved.id);

  assert.ok(row);
  assert.equal(row.kind, "idea");
  assert.equal(row.status, "saved");
  assert.equal(row.title, "Sanal Emlak Ofisi");

  const memories = listEceKnowledge();

  assert.equal(memories.length, 1);
  assert.equal(memories[0].id, saved.id);
  assert.equal(memories[0].title, "Sanal Emlak Ofisi");
  assert.equal(memories[0].kind, "idea");
  assert.equal(memories[0].project, "ARKEMX");

  // Kayıtlı bir bilgiyi anahtar kelimeyle bul.
  const results = searchEceKnowledge("emlak");

  assert.equal(results.length, 1);
  assert.equal(results[0].id, saved.id);
  assert.equal(results[0].title, "Sanal Emlak Ofisi");

  // Olmayan bir bilgi için sonuç üretme.
  const missing = searchEceKnowledge("otomobil");

  assert.equal(missing.length, 0);

  const secondDb = new DatabaseSync(
    join(directory, "studio.sqlite")
  );

  try {
    const result = secondDb.prepare(`
      INSERT INTO ece_knowledge (
        id, kind, status, title, content,
        project, source_message_id,
        created_at, updated_at
      )
      SELECT
        ?, kind, status, title, content,
        project, source_message_id,
        created_at, updated_at
      FROM ece_knowledge
      WHERE id = ?
      ON CONFLICT DO NOTHING
    `).run("second-connection-test", saved.id);

    assert.equal(result.changes, 0);

    const count = secondDb.prepare(`
      SELECT COUNT(*) AS total
      FROM ece_knowledge
      WHERE status = 'saved'
    `).get() as { total: number };

    assert.equal(count.total, 1);
  } finally {
    secondDb.close();
  }
});
