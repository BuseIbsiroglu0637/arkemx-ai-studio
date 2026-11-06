
import { NextResponse } from "next/server";

import {
  resolveEceDecision,
} from "@/server/ece-decision-store";

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

// PATCH: Kullanıcının seçtiği karar önerisini sonuçlandırır.
export async function PATCH(
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
      throw new StudioError(400, "İstek verisi geçersiz.");
    }

    const input = body as Record<string, unknown>;

    if (
      input.status !== "confirmed" &&
      input.status !== "rejected"
    ) {
      throw new StudioError(
        400,
        "Durum confirmed veya rejected olmalı."
      );
    }

    const saved = resolveEceDecision(
      id,
      input.status
    );

    if (!saved) {
      throw new StudioError(
        409,
        "Karar bulunamadı veya daha önce sonuçlandırıldı."
      );
    }

    return NextResponse.json(
      {
        data: {
          saved,
          message:
            saved.status === "confirmed"
              ? "Karar onaylandı."
              : "Karar reddedildi.",
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
