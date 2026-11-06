import { NextResponse } from "next/server";
import {
  listEceDecisions,
  proposeEceDecision,
} from "@/server/ece-decision-store";
import { StudioError } from "@/server/errors";
import {
  assertLocalRequest,
  readJson,
  apiError,
} from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);

    const projectParam = new URL(request.url)
      .searchParams.get("project");

    const project = projectParam?.trim();

    if (
      projectParam !== null &&
      (!project || project.length > 150)
    ) {
      throw new StudioError(400, "Proje filtresi geçersiz.");
    }

    return NextResponse.json(
      { data: { decisions: listEceDecisions(project) } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);

    const body = await readJson(request);

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new StudioError(400, "Karar verisi geçersiz.");
    }

    const input = body as Record<string, unknown>;

    if ("status" in input || "confirmedAt" in input) {
      throw new StudioError(
        400,
        "Karar durumu istemci tarafından belirlenemez."
      );
    }

    if (
      typeof input.project !== "string" ||
      typeof input.decision !== "string"
    ) {
      throw new StudioError(
        400,
        "Proje ve karar açıklaması zorunludur."
      );
    }

    const project = input.project.trim();
    const decision = input.decision.trim();

    if (
      project.length < 2 ||
      project.length > 150 ||
      decision.length < 10 ||
      decision.length > 2000
    ) {
      throw new StudioError(400, "Karar alanları geçersiz.");
    }

    const sourceMessageId = input.sourceMessageId;

    if (
      sourceMessageId !== undefined &&
      (typeof sourceMessageId !== "number" ||
        !Number.isSafeInteger(sourceMessageId) ||
        sourceMessageId < 1)
    ) {
      throw new StudioError(
        400,
        "Kaynak mesaj kimliği geçersiz."
      );
    }

    const saved = proposeEceDecision({
      project,
      decision,
      sourceMessageId: sourceMessageId as number | undefined,
    });

    return NextResponse.json(
      {
        data: {
          saved,
          message: "Karar önerisi kaydedildi; henüz onaylanmadı.",
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    return apiError(error);
  }
}
