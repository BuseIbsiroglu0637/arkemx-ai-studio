import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import type { TeamMember } from "../domain/team";
import { SEED_TEAM } from "../domain/seed";
import { StudioError } from "./errors";

export class TeamStore {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        revision INTEGER NOT NULL,
        profile TEXT NOT NULL CHECK(json_valid(profile)),
        archived_at TEXT
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        recorded_at TEXT NOT NULL,
        revision INTEGER NOT NULL,
        snapshot TEXT NOT NULL CHECK(json_valid(snapshot))
      );
    `);
    this.transaction(() => {
      const insert = this.database.prepare("INSERT OR IGNORE INTO team_members (id, revision, profile) VALUES (?, ?, ?)");
      for (const member of SEED_TEAM) insert.run(member.id, member.revision, JSON.stringify(member));
    });
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private audit(member: TeamMember, action: string) {
    this.database.prepare("INSERT INTO audit_events (member_id, action, actor, recorded_at, revision, snapshot) VALUES (?, ?, ?, ?, ?, ?)")
      .run(member.id, action, "local-owner", new Date().toISOString(), member.revision, JSON.stringify(member));
  }

  list(): TeamMember[] {
    return this.database.prepare("SELECT profile FROM team_members WHERE archived_at IS NULL ORDER BY rowid").all()
      .map(row => JSON.parse(row.profile as string) as TeamMember);
  }

  get(id: string): TeamMember {
    const row = this.database.prepare("SELECT profile FROM team_members WHERE id = ? AND archived_at IS NULL").get(id);
    if (!row) throw new StudioError(404, "Ekip üyesi bulunamadı.");
    return JSON.parse(row.profile as string) as TeamMember;
  }

  create(member: TeamMember): TeamMember {
    return this.transaction(() => {
      this.database.prepare("INSERT INTO team_members (id, revision, profile) VALUES (?, ?, ?)")
        .run(member.id, member.revision, JSON.stringify(member));
      this.audit(member, "created");
      return member;
    });
  }

  update(id: string, expectedRevision: number, patch: Partial<TeamMember>): TeamMember {
    return this.transaction(() => {
      const current = this.get(id);
      if (current.revision !== expectedRevision) throw new StudioError(409, "Bu profil başka bir yerde güncellendi. Sayfayı yenileyip tekrar dene.");
      const next: TeamMember = { ...current, ...patch, id, revision: current.revision + 1, updatedAt: new Date().toISOString() };
      const result = this.database.prepare("UPDATE team_members SET revision = ?, profile = ? WHERE id = ? AND revision = ? AND archived_at IS NULL")
        .run(next.revision, JSON.stringify(next), id, expectedRevision);
      if (result.changes !== 1) throw new StudioError(409, "Profil değişti; güncel kaydı yeniden aç.");
      this.audit(next, "updated");
      return next;
    });
  }

  archive(id: string, expectedRevision: number): void {
    this.transaction(() => {
      const current = this.get(id);
      if (current.revision !== expectedRevision) throw new StudioError(409, "Profil değişti; güncel kaydı yeniden aç.");
      const next = { ...current, revision: current.revision + 1, updatedAt: new Date().toISOString() };
      const result = this.database.prepare("UPDATE team_members SET archived_at = ?, revision = ?, profile = ? WHERE id = ? AND revision = ? AND archived_at IS NULL")
        .run(next.updatedAt, next.revision, JSON.stringify(next), id, expectedRevision);
      if (result.changes !== 1) throw new StudioError(409, "Profil değişti; güncel kaydı yeniden aç.");
      this.audit(next, "archived");
    });
  }

  history(id: string) {
    return this.database.prepare("SELECT action, recorded_at AS recordedAt, revision FROM audit_events WHERE member_id = ? ORDER BY id DESC LIMIT 50").all(id);
  }

  close() { this.database.close(); }
}

let store: TeamStore | undefined;

export function getTeamStore(): TeamStore {
  if (!store) {
    const dataDirectory = process.env.ARKEMX_STUDIO_DATA_DIR || join(process.cwd(), "data");
    if (!isAbsolute(dataDirectory)) throw new Error("ARKEMX_STUDIO_DATA_DIR mutlak bir klasör yolu olmalı.");
    mkdirSync(dataDirectory, { recursive: true });
    store = new TeamStore(join(dataDirectory, "studio.sqlite"));
  }
  return store;
}
