import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { StudioError } from "./errors";

const hosts = new Set(["127.0.0.1:3100", "localhost:3100"]);
const origins = new Set(["http://127.0.0.1:3100", "http://localhost:3100"]);

export function assertLocalRequest(request: Request, mutation = false): void {
  if (!hosts.has(request.headers.get("host") || "")) throw new StudioError(403, "Bu ilk sürüm yalnız yerel çalışma alanında kullanılabilir.");
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && !origins.has(origin))) {
    throw new StudioError(403, "İstek kaynağına izin verilmedi.");
  }
  if (mutation && (!origin || !origins.has(origin))) throw new StudioError(403, "Değişiklik bu uygulamanın ekranından yapılmalı.");
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new StudioError(415, "JSON içeriği gerekli.");
  if (Number(request.headers.get("content-length") || 0) > 20_000) throw new StudioError(413, "İçerik çok uzun.");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 20_000) throw new StudioError(413, "İçerik çok uzun.");
  try { return JSON.parse(text); } catch { throw new StudioError(400, "Gönderilen içerik okunamadı."); }
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) return NextResponse.json({ error: { message: "Profil alanlarını kontrol et. İsim, rol ve açıklama boş bırakılamaz." } }, { status: 400 });
  if (error instanceof StudioError) return NextResponse.json({ error: { message: error.message } }, { status: error.status });
  console.error("Studio request failed:", error instanceof Error ? error.message : "Unknown error");
  return NextResponse.json({ error: { message: "İşlem tamamlanamadı. Lütfen tekrar dene." } }, { status: 500 });
}
