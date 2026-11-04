import { randomUUID } from "node:crypto";
import type { TeamMember, TeamMemberInput } from "../domain/team";
import { getTeamStore } from "./sqlite-store";
import { memberIdSchema, memberInputSchema, memberUpdateSchema } from "./validation";

export function listTeamMembers(): TeamMember[] { return getTeamStore().list(); }
export function getTeamMember(id: string): TeamMember { return getTeamStore().get(memberIdSchema.parse(id)); }

export function createTeamMember(input: unknown): TeamMember {
  const fields = memberInputSchema.parse(input) as TeamMemberInput;
  const now = new Date().toISOString();
  return getTeamStore().create({
    ...fields, id: randomUUID(), status: "ready", revision: 1,
    modelStatus: "disconnected", experience: [], createdAt: now, updatedAt: now,
  });
}

export function updateTeamMember(id: string, input: unknown): TeamMember {
  const { revision, ...patch } = memberUpdateSchema.parse(input);
  return getTeamStore().update(memberIdSchema.parse(id), revision, patch as Partial<TeamMember>);
}

export function archiveTeamMember(id: string, revision: number): void {
  getTeamStore().archive(memberIdSchema.parse(id), revision);
}

export function getMemberHistory(id: string) {
  getTeamMember(id);
  return getTeamStore().history(id);
}
