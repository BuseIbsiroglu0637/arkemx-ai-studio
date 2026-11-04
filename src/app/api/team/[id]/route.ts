import { NextResponse } from "next/server";
import { archiveTeamMember, getTeamMember, updateTeamMember } from "@/server/team-service";
import { apiError, assertLocalRequest, readJson } from "@/server/http";
import { revisionSchema } from "@/server/validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    assertLocalRequest(request);
    return NextResponse.json({ data: getTeamMember((await params).id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    assertLocalRequest(request, true);
    return NextResponse.json({ data: updateTeamMember((await params).id, await readJson(request)) });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: Context) {
  try {
    assertLocalRequest(request, true);
    const { id } = await params;
    archiveTeamMember(id, revisionSchema.parse(new URL(request.url).searchParams.get("revision")));
    return NextResponse.json({ data: { id } });
  } catch (error) { return apiError(error); }
}
