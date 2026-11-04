import TeamWorkspace from "@/components/team-workspace";
import { listTeamMembers } from "@/server/team-service";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function TeamPage() {
  const host = (await headers()).get("host");
  if (host !== "127.0.0.1:3100" && host !== "localhost:3100") {
    return <main>Bu çalışma alanını http://127.0.0.1:3100 adresinden aç.</main>;
  }
  return <TeamWorkspace initialMembers={listTeamMembers()} />;
}
