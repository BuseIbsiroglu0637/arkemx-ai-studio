import { NextResponse } from "next/server";
import { createTeamMember, listTeamMembers } from "@/server/team-service";
import { apiError, assertLocalRequest, readJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  try {
    assertLocalRequest(request);
    return NextResponse.json({ data: listTeamMembers() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);
    return NextResponse.json({ data: createTeamMember(await readJson(request)) }, { status: 201 });
  } catch (error) { return apiError(error); }
}
