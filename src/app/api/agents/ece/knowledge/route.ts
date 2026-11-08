import { NextResponse } from "next/server";
import { assertLocalRequest, apiError } from "@/server/http";
import { listEceKnowledge } from "@/server/ece-knowledge-store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  try {
    assertLocalRequest(request);
    return NextResponse.json({ data: { records: listEceKnowledge(50) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
