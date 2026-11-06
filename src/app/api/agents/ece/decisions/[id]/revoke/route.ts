
import { NextResponse } from "next/server";
import { revokeEceDecision } from "@/server/ece-decision-store";
import { StudioError } from "@/server/errors";
import {
  assertLocalRequest,
  readJson,
  apiError,
} from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    assertLocalRequest(request, true);

    const { id } = await context.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      throw new StudioError(400, "Karar kimliği geçersiz.");
    }

    const body = await readJson(request);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new StudioError(400, "İptal bilgisi geçersiz.");
    }

    const input = body as Record<string, unknown>;

    if (
      typeof input.reason !== "string" ||
      input.reason.trim().length < 3 ||
      input.reason.trim().length > 500
    ) {
      throw new StudioError(
        400,
        "İptal gerekçesi 3-500 karakter olmalı."
      );
    }

    const revoked = revokeEceDecision(
      id,
      input.reason
    );

    if (!revoked) {
      throw new StudioError(
        409,
        "Karar bulunamadı, onaylı değil veya zaten iptal edilmiş."
      );
    }

    return NextResponse.json(
      {
        data: {
          id,
          revoked: true,
          message: "Karar iptal geçmişine kaydedildi.",
        },
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    return apiError(error);
  }
}
