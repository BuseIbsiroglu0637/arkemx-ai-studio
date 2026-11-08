import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export type KnowledgeKind =
  | "idea"
  | "fact"
  | "preference"
  | "note";

export type KnowledgeStatus =
  | "draft"
  | "saved"
  | "archived";

export type EceKnowledge = {
  id: string;
  kind: KnowledgeKind;
  status: KnowledgeStatus;
  title: string;
  content: string;
  project: string | null;
  sourceMessageId: number | null;
  createdAt: string;
  updatedAt: string;
};

let knowledgeDatabase: DatabaseSync | undefined;

export function getKnowledgeDatabase(): DatabaseSync {
  if (knowledgeDatabase) return knowledgeDatabase;

  const directory =
    process.env.ARKEMX_STUDIO_DATA_DIR ||
    join(process.cwd(), "data");

  if (!isAbsolute(directory)) {
    throw new Error("Veritabanı yolu mutlak olmalı.");
  }

  mkdirSync(directory, { recursive: true });

  const db = new DatabaseSync(join(directory, "studio.sqlite"));

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS ece_knowledge (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL
        CHECK(kind IN ('idea', 'fact', 'preference', 'note')),
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft', 'saved', 'archived')),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      project TEXT,
      source_message_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS
      idx_ece_knowledge_saved_unique
    ON ece_knowledge (
      kind,
      title,
      content,
      IFNULL(project, '')
    )
    WHERE status = 'saved';
  `);

  knowledgeDatabase = db;
  return db;
}

export function saveEceKnowledge(input: {
  kind: KnowledgeKind;
  title: string;
  content: string;
  project?: string;
}): EceKnowledge {
  const title = input.title.trim();
  const content = input.content.trim();

  if (
    !title ||
    !content ||
    title.length > 150 ||
    content.length > 5000 ||
    (input.project?.length ?? 0) > 150
  ) {
    throw new Error("Hafıza bilgisi geçersiz.");
  }

  const existing = getKnowledgeDatabase().prepare(`
    SELECT
      id,
      kind,
      status,
      title,
      content,
      project,
      source_message_id AS sourceMessageId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM ece_knowledge
    WHERE kind = ?
      AND title = ?
      AND content = ?
      AND project IS ?
      AND status = 'saved'
    LIMIT 1
  `).get(
    input.kind,
    title,
    content,
    input.project?.trim() || null
  ) as EceKnowledge | undefined;

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();

  const record: EceKnowledge = {
    id: randomUUID(),
    kind: input.kind,
    status: "saved",
    title,
    content,
    project: input.project?.trim() || null,
    sourceMessageId: null,
    createdAt: now,
    updatedAt: now,
  };

  const db = getKnowledgeDatabase();
  const result = db.prepare(`
    INSERT INTO ece_knowledge (
      id, kind, status, title, content,
      project, source_message_id,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `).run(
    record.id,
    record.kind,
    record.status,
    record.title,
    record.content,
    record.project,
    record.sourceMessageId,
    record.createdAt,
    record.updatedAt
  );

  if (result.changes === 0) {
    const existing = db.prepare(`
      SELECT
        id, kind, status, title, content, project,
        source_message_id AS sourceMessageId,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM ece_knowledge
      WHERE kind = ?
        AND title = ?
        AND content = ?
        AND project IS ?
        AND status = 'saved'
      LIMIT 1
    `).get(
      record.kind,
      record.title,
      record.content,
      record.project
    ) as EceKnowledge | undefined;

    if (!existing) {
      throw new Error("Kayıt çakışması çözümlenemedi.");
    }
    return existing;
  }
  return record;
}
export function listEceKnowledge(
  limit = 20
): EceKnowledge[] {
  const db = getKnowledgeDatabase();

  const rows = db.prepare(`
    SELECT
      id,
      kind,
      status,
      title,
      content,
      project,
      source_message_id AS sourceMessageId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM ece_knowledge
    WHERE status = 'saved'
    ORDER BY created_at DESC, rowid DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(limit, 50)));

  return rows as EceKnowledge[];
}

export function searchEceKnowledge(
  query: string,
  limit = 10
): EceKnowledge[] {
  const term = query.trim();

  if (!term || term.length > 150) {
    return [];
  }

  const db = getKnowledgeDatabase();

  const escaped = term.replace(
    /[!%_]/g,
    (character) => `!${character}`
  );

  const pattern = `%${escaped}%`;

  const rows = db.prepare(`
    SELECT
      id,
      kind,
      status,
      title,
      content,
      project,
      source_message_id AS sourceMessageId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM ece_knowledge
    WHERE status = 'saved'
      AND (
        title LIKE ? ESCAPE '!'
        OR content LIKE ? ESCAPE '!'
        OR project LIKE ? ESCAPE '!'
      )
    ORDER BY created_at DESC, rowid DESC
    LIMIT ?
  `).all(
    pattern,
    pattern,
    pattern,
    Math.max(1, Math.min(limit, 50))
  );

  return rows as EceKnowledge[];
}