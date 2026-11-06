
import { NextResponse } from "next/server";

import { createEceWorkPlan } from "@/server/ece-planner";
import { validateEceWorkPlan } from "@/server/ece-plan-validator";
import { getTeamMember } from "@/server/team-service";
import { StudioError } from "@/server/errors";
import {
  assertLocalRequest,
  readJson,
  apiError,
} from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agents/ece/plan
 *
 * Kullanıcının hedefinden YENİ bir iş planı oluşturur.
 *
 * İstek:
 * {
 *   "goal": "Proje hedefi..."
 * }
 *
 * Sonuç:
 * {
 *   "data": {
 *     "status": "draft",
 *     "plan": {...},
 *     "issues": [],
 *     "quality": "passed"
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);

    const ece = getTeamMember("ece");

    if (!ece || ece.status !== "ready") {
      throw new StudioError(
        409,
        "Ece şu anda iş planı oluşturmak için hazır değil."
      );
    }

    const body = await readJson(request);

    if (
      !body ||
      typeof body !== "object" ||
      !("goal" in body) ||
      typeof body.goal !== "string"
    ) {
      throw new StudioError(
        400,
        "İş planı oluşturmak için hedef girilmelidir."
      );
    }

    const goal = body.goal.trim();

    if (goal.length < 10 || goal.length > 1500) {
      throw new StudioError(
        400,
        "Plan hedefi 10-1500 karakter arasında olmalı."
      );
    }

    // MCP ekip üyelerini kullanarak Ollama ile taslak üret.
    const plan = await createEceWorkPlan(goal);

    // Kullanıcının gönderdiği hedefi esas al.
    const finalPlan = {
      ...plan,
      goal,
    };

    // Planın ilk kalite kontrolünü yap.
    const issues = validateEceWorkPlan(finalPlan, goal);

    console.log("Ece plan oluşturma başarılı:", {
      taskCount: finalPlan.tasks.length,
      issueCount: issues.length,
    });

    // Taslak döndürülür. SQLite kaydı veya görev ataması yok.
    return NextResponse.json(
      {
        data: {
          status: "draft",
          plan: finalPlan,
          issues,
          quality:
            issues.length === 0
              ? "passed"
              : "needs_review",
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return apiError(error);
  }
}
