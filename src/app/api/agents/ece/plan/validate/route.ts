import { NextResponse } from "next/server";
import { workPlanSchema } from "@/domain/work-plan";
import { validateEceWorkPlan } from "@/server/ece-plan-validator";
import { StudioError } from "@/server/errors";
import { assertLocalRequest, readJson, apiError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);

    const body = await readJson(request);

    if (!body || typeof body !== "object" || !("plan" in body)) {
      throw new StudioError(400, "İstekte iş planı bulunamadı.");
    }

    const parsed = workPlanSchema.safeParse(body.plan);

    if (!parsed.success) {
      const fields = parsed.error.issues
        .map((issue) => issue.path.join(".") || "plan")
        .join(", ");

      throw new StudioError(400, `Plan alanları geçersiz: ${fields}`);
    }

    const plan = parsed.data;
    const issues = validateEceWorkPlan(plan, plan.goal);

    return NextResponse.json({
      data: {
        issues,
        quality: issues.length === 0 ? "passed" : "needs_review",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
