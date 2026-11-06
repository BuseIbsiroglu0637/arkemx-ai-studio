
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  workPlanSchema,
  type WorkPlanDraft,
} from "@/domain/work-plan";

let database: DatabaseSync | undefined;

export function getEcePlanDatabase(): DatabaseSync {
  if (database) {
    return database;
  }

  // Mevcut ARKEMX veritabanı klasörü
  const directory =
    process.env.ARKEMX_STUDIO_DATA_DIR ||
    join(process.cwd(), "data");

  if (!isAbsolute(directory)) {
    throw new Error(
      "ARKEMX_STUDIO_DATA_DIR mutlak bir klasör yolu olmalı."
    );
  }

  mkdirSync(directory, { recursive: true });

  // Mevcut studio.sqlite dosyasını kullan
  const db = new DatabaseSync(
    join(directory, "studio.sqlite")
  );

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS ece_work_plans (
      id TEXT PRIMARY KEY,

      project TEXT NOT NULL,
      goal TEXT NOT NULL,

      plan_json TEXT NOT NULL
        CHECK(json_valid(plan_json)),

      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status = 'draft'),

      revision INTEGER NOT NULL DEFAULT 1
        CHECK(revision >= 1),

      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      idx_ece_work_plans_updated_at
    ON ece_work_plans(updated_at DESC);
  `);

  database = db;
  return db;
}

export type SavedEcePlan = {
  id: string;
  plan: WorkPlanDraft;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

// Yeni planı taslak olarak kaydet
export function saveEcePlanDraft(
  draft: WorkPlanDraft
): SavedEcePlan {
  const db = getEcePlanDatabase();

  // Eksik veya hatalı alanların kaydedilmesini engelle
  const plan = workPlanSchema.parse(draft);

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO ece_work_plans (
      id,
      project,
      goal,
      plan_json,
      status,
      revision,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)
  `).run(
    id,
    plan.project,
    plan.goal,
    JSON.stringify(plan),
    now,
    now
  );

  return {
    id,
    plan,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

// Kayıtlı bir planı kimliğiyle geri getir
export function getEcePlanDraft(
  id: string
): SavedEcePlan | null {
  const db = getEcePlanDatabase();

  const row = db.prepare(`
    SELECT
      id,
      plan_json,
      revision,
      created_at,
      updated_at
    FROM ece_work_plans
    WHERE id = ?
      AND status = 'draft'
  `).get(id);

  if (!row) return null;

  const plan = workPlanSchema.parse(
    JSON.parse(String(row.plan_json))
  );

  return {
    id: String(row.id),
    plan,
    revision: Number(row.revision),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// Kayıtlı planların özet listesini getir
export function listEcePlanDrafts() {
  const db = getEcePlanDatabase();

  return db.prepare(`
    SELECT
      id,
      project,
      goal,
      revision,
      updated_at
    FROM ece_work_plans
    WHERE status = 'draft'
    ORDER BY updated_at DESC, rowid DESC
    LIMIT 50
  `).all().map((row) => ({
    id: String(row.id),
    project: String(row.project),
    goal: String(row.goal),
    revision: Number(row.revision),
    updatedAt: String(row.updated_at),
  }));
}
