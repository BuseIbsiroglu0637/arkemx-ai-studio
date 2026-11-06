import { NextResponse } from "next/server";

import { getEcePlanDraft } from "@/server/ece-plan-store";
import { StudioError } from "@/server/errors";
import { assertLocalRequest, apiError } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// Kaydedilmiş bir iş planını kimliğiyle getir.
export async function GET(
  request: Request,
  context: RouteContext
) {
  try {
    assertLocalRequest(request);

    const { id } = await context.params;

    if (!id || !id.trim()) {
      throw new StudioError(
        400,
        "İş planı kimliği gereklidir."
      );
    }

    const saved = getEcePlanDraft(id);

    if (!saved) {
      throw new StudioError(
        404,
        "Kayıtlı iş planı bulunamadı."
      );
    }

    return NextResponse.json(
      {
        data: {
          saved,
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
