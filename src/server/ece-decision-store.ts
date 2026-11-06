
import { randomUUID } from "node:crypto";
import { getEcePlanDatabase } from "@/server/ece-plan-store";

export type EceDecisionStatus =
  | "proposed"
  | "confirmed"
  | "rejected";

export type EceDecision = {
  id: string;
  project: string;
  decision: string;
  status: EceDecisionStatus;
  sourceMessageId: number | null;
  createdAt: string;
  confirmedAt: string | null;
};

function getDecisionDatabase() {
  const db = getEcePlanDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS ece_decisions (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      decision_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'proposed'
        CHECK(status IN (
          'proposed',
          'confirmed',
          'rejected'
        )),
      source_message_id INTEGER,
      created_at TEXT NOT NULL,
      confirmed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS
      idx_ece_decisions_project
    ON ece_decisions(project, created_at DESC);

    CREATE TABLE IF NOT EXISTS ece_decision_revocations (
        decision_id TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        revoked_at TEXT NOT NULL,
        FOREIGN KEY (decision_id) REFERENCES ece_decisions(id)
    );
  `);

  return db;
}

// Yeni bir karar ÖNERİSİ oluşturur.
// Kullanıcı onayı anlamına gelmez.
export function proposeEceDecision(input: {
  project: string;
  decision: string;
  sourceMessageId?: number;
}): EceDecision {
  const project = input.project.trim();
  const decision = input.decision.trim();

  if (
    project.length < 2 ||
    project.length > 150 ||
    decision.length < 10 ||
    decision.length > 2000
  ) {
    throw new Error("Karar önerisi alanları geçersiz.");
  }

  const sourceMessageId =
    input.sourceMessageId === undefined
      ? null
      : input.sourceMessageId;

  if (
    sourceMessageId !== null &&
    (!Number.isSafeInteger(sourceMessageId) ||
      sourceMessageId < 1)
  ) {
    throw new Error("Kaynak mesaj kimliği geçersiz.");
  }

  const db = getDecisionDatabase();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO ece_decisions (
      id,
      project,
      decision_text,
      status,
      source_message_id,
      created_at,
      confirmed_at
    )
    VALUES (?, ?, ?, 'proposed', ?, ?, NULL)
  `).run(
    id,
    project,
    decision,
    sourceMessageId,
    createdAt
  );

  return {
    id,
    project,
    decision,
    status: "proposed",
    sourceMessageId,
    createdAt,
    confirmedAt: null,
  };
}


export function listEceDecisions(
  project?: string
): Array<EceDecision & { isRevoked: boolean }> {
  const db = getDecisionDatabase();

  const query = `
    SELECT
      d.id,
      d.project,
      d.decision_text,
      d.status,
      d.source_message_id,
      d.created_at,
      d.confirmed_at,
      CASE
        WHEN r.decision_id IS NULL THEN 0
        ELSE 1
      END AS is_revoked
    FROM ece_decisions d
    LEFT JOIN ece_decision_revocations r
      ON r.decision_id = d.id
  `;

  const rows = project
    ? db.prepare(`
        ${query}
        WHERE d.project = ?
        ORDER BY d.created_at DESC
        LIMIT 50
      `).all(project)
    : db.prepare(`
        ${query}
        ORDER BY d.created_at DESC
        LIMIT 50
      `).all();

  return rows.map((row) => ({
    id: String(row.id),
    project: String(row.project),
    decision: String(row.decision_text),
    status: String(row.status) as EceDecisionStatus,
    sourceMessageId:
      row.source_message_id === null
        ? null
        : Number(row.source_message_id),
    createdAt: String(row.created_at),
    confirmedAt:
      row.confirmed_at === null
        ? null
        : String(row.confirmed_at),
    isRevoked: Number(row.is_revoked) === 1,
  }));
}

export function resolveEceDecision(
  id: string,
  status: "confirmed" | "rejected"
): EceDecision | null {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new Error("Karar kimliği geçersiz.");
  }

  if (status !== "confirmed" && status !== "rejected") {
    throw new Error("Karar durumu geçersiz.");
  }

  const db = getDecisionDatabase();

  const row = db.prepare(`
    UPDATE ece_decisions
    SET
      status = ?,
      confirmed_at = ?
    WHERE id = ?
      AND status = 'proposed'
    RETURNING
      id,
      project,
      decision_text,
      status,
      source_message_id,
      created_at,
      confirmed_at
  `).get(
    status,
    status === "confirmed"
      ? new Date().toISOString()
      : null,
    id
  );

  if (!row) return null;

  return {
    id: String(row.id),
    project: String(row.project),
    decision: String(row.decision_text),
    status: String(row.status) as EceDecisionStatus,
    sourceMessageId:
      row.source_message_id === null
        ? null
        : Number(row.source_message_id),
    createdAt: String(row.created_at),
    confirmedAt:
      row.confirmed_at === null
        ? null
        : String(row.confirmed_at),
  };
}
export function revokeEceDecision(
  id: string,
  reason: string
): boolean {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new Error("Geçersiz karar kimliği.");
  }

  const cleanReason = reason.trim();

if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw new Error("Geçerli bir iptal gerekçesi gerekli.");
  }

  const db = getDecisionDatabase();

const result = db.prepare(`
    INSERT INTO ece_decision_revocations (
      decision_id,
      reason,
      revoked_at
    )
    SELECT id, ?, ?
    FROM ece_decisions
    WHERE id = ?
      AND status = 'confirmed'
      AND NOT EXISTS (
        SELECT 1
        FROM ece_decision_revocations
        WHERE decision_id = ?
      )
  `).run(
    cleanReason,
    new Date().toISOString(),
    id,
    id
  );

return result.changes === 1;
}