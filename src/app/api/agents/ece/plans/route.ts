
import { NextResponse } from "next/server";

import { workPlanSchema } from "@/domain/work-plan";
import {
  listEcePlanDrafts,
  saveEcePlanDraft,
} from "@/server/ece-plan-store";
import { StudioError } from "@/server/errors";
import {
  assertLocalRequest,
  readJson,
  apiError,
} from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: SQLite'a kaydedilmiş iş planlarını listele.
export async function GET(request: Request) {
  try {
    assertLocalRequest(request);

    const plans = listEcePlanDrafts();

    return NextResponse.json(
      {
        data: {
          plans,
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

// POST: Yeni bir iş planını taslak olarak kaydet.
export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);

    const body = await readJson(request);

    if (
      !body ||
      typeof body !== "object" ||
      !("plan" in body)
    ) {
      throw new StudioError(
        400,
        "Kaydedilecek iş planı bulunamadı."
      );
    }

    const parsed = workPlanSchema.safeParse(body.plan);

    if (!parsed.success) {
      const invalidFields = parsed.error.issues
        .map((issue) => issue.path.join("."))
        .join(", ");

      throw new StudioError(
        400,
        `İş planında geçersiz alanlar var: ${invalidFields}`
      );
    }

    const saved = saveEcePlanDraft(parsed.data);

    return NextResponse.json(
      {
        data: {
          saved,
          message: "İş planı taslak olarak kaydedildi.",
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return apiError(error);
  }
}
