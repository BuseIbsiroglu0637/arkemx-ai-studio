
import { NextResponse } from "next/server";

import { chatWithEce } from "@/server/ece-chat";
import { getTeamMember } from "@/server/team-service";
import {
  listEceMessages,
  saveEceExchange,
} from "@/server/ece-memory";

import {
  assertLocalRequest,
  readJson,
  apiError,
} from "@/server/http";

import { StudioError } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ece'nin geçmiş konuşmalarını getir
export function GET(request: Request) {
  try {
    assertLocalRequest(request);

    const messages = listEceMessages(20);

    return NextResponse.json(
      { data: { messages } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return apiError(error);
  }
}

// Ece'ye mesaj gönder
export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);

    const ece = getTeamMember("ece");

    if (ece.status !== "ready") {
      throw new StudioError(
        409,
        "Ece şu anda duraklatılmış."
      );
    }

    const body = await readJson(request);

    if (
      !body ||
      typeof body !== "object" ||
      !("message" in body) ||
      typeof body.message !== "string" ||
      !body.message.trim() ||
      body.message.length > 2000
    ) {
      throw new StudioError(
        400,
        "Geçersiz mesaj."
      );
    }

    const userMessage = body.message.trim();

    // Ollama'dan gerçek yanıtı al
    const reply = await chatWithEce(userMessage);

    // Başarılı konuşmayı SQLite'a kaydet
    saveEceExchange(userMessage, reply);

    return NextResponse.json({
      data: {
        agentId: "ece",
        model: "qwen3.5:4b",
        reply,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
