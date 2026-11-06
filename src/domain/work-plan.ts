import { z } from "zod";

// Ece'nin önerebileceği tek bir görev.

export const proposedTaskSchema = z.object({
    assigneeId: z.string().min(1),
    title: z.string().min(3),
    description: z.string().min(10),
    priority: z.enum(["low", "medium", "high"]),
    acceptanceCriteria: z.string().min(10),
}).strict();

// Ece'nin hazırlayacağı iş planı.

export const workPlanSchema = z.object({
    project: z.string().min(1),
    goal: z.string().min(5),
    summary: z.string().min(10),
    tasks: z.array(proposedTaskSchema).min(1).max(8),
}).strict();

export type ProposedTask = z.infer<typeof proposedTaskSchema>;
export type WorkPlanDraft = z.infer<typeof workPlanSchema>;