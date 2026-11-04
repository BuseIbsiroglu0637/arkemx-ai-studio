import { z } from "zod";
import { DEPARTMENTS } from "../domain/team";

const shortText = z.string().trim().min(1).max(80);
export const memberInputSchema = z.object({
  name: shortText,
  role: shortText,
  department: z.enum(DEPARTMENTS as [string, ...string[]]),
  description: z.string().trim().min(1).max(700),
  skills: z.array(z.string().trim().min(1).max(60)).max(12),
  responsibilities: z.array(z.string().trim().min(1).max(240)).max(12),
  workingStyle: z.string().trim().max(600),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  avatarKey: z.enum(["ece", "ada", "deniz", "bora", "selin"]),
  project: z.string().trim().max(80),
}).strict();

export const memberUpdateSchema = memberInputSchema.partial().extend({
  status: z.enum(["ready", "paused"]).optional(),
  revision: z.number().int().positive(),
}).strict();

export const memberIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const revisionSchema = z.coerce.number().int().positive();
