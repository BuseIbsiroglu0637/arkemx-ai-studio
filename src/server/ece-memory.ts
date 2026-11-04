
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export type EceMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

let database: DatabaseSync | undefined;

function getMemoryDatabase(): DatabaseSync {
  if (database) return database;

  const directory =
    process.env.ARKEMX_STUDIO_DATA_DIR ||
    join(process.cwd(), "data");

  if (!isAbsolute(directory)) {
    throw new Error("Veritabanı yolu mutlak olmalı.");
  }

  mkdirSync(directory, { recursive: true });

  const db = new DatabaseSync(
    join(directory, "studio.sqlite")
  );

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS ece_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL
        CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  database = db;
  return db;
}

export function listEceMessages(
  limit = 20
): EceMessage[] {
  const db = getMemoryDatabase();

  const rows = db.prepare(`
    SELECT
      id,
      role,
      content,
      created_at AS createdAt
    FROM ece_messages
    ORDER BY id DESC
    LIMIT ?
  `).all(Math.max(1, Math.min(limit, 50)));

  return (rows as EceMessage[]).reverse();
}

export function saveEceExchange(
  userMessage: string,
  assistantMessage: string
): void {
  const db = getMemoryDatabase();

  const insert = db.prepare(`
    INSERT INTO ece_messages
      (role, content, created_at)
    VALUES (?, ?, ?)
  `);

  db.exec("BEGIN IMMEDIATE");

  try {
    const now = new Date().toISOString();

    insert.run("user", userMessage, now);
    insert.run("assistant", assistantMessage, now);

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
