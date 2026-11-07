import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertLocalRequest, apiError, readJson } from "@/server/http";
import { StudioError } from "@/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const VOICE = { name: "tr-TR-EmelNeural", rate: "+0%", pitch: "-2Hz" } as const;
const MAX_TEXT_LENGTH = 2000;
const MAX_AUDIO_SIZE = 6 * 1024 * 1024;

// Mevcut /api/agents/ece/voice arayüzü değişmez: { text } -> audio/mpeg.
// Python CLI sunucu tarafında çalışır; tarayıcıda Python kurulması gerekmez.
export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);

    const body = await readJson(request);
    if (
      !body ||
      typeof body !== "object" ||
      !("text" in body) ||
      typeof body.text !== "string" ||
      !body.text.trim() ||
      body.text.length > MAX_TEXT_LENGTH
    ) {
      throw new StudioError(400, "Seslendirilecek metin 1–2000 karakter olmalı.");
    }

    const requestedVoice = "voice" in body ? body.voice : "emel";
    if (requestedVoice !== "emel") throw new StudioError(400, "Geçersiz ses seçimi.");
    const voice = VOICE;

    // Rastgele geçici klasör: metin ve MP3 dosyaları iş bitince silinir.
    // Metni komut argümanına değil UTF-8 dosyasına yazıyoruz.
    const workingDir = await mkdtemp(join(tmpdir(), "arkemx-ece-voice-"));
    try {
      const inputFile = join(workingDir, "message.txt");
      const outputFile = join(workingDir, "ece.mp3");
      await writeFile(inputFile, body.text.trim().replace(/\bARKEMX\b/g, "Arkemeks").replace(/\bAI\b/g, "yapay zekâ"), "utf8");

      // Varsayılan Windows Python launcher: py.exe.
      // Farklı yorumlayıcı için ECE_TTS_PYTHON ortam değişkeni verilebilir.
      const python = process.env.ECE_TTS_PYTHON || "py";
      try {
        await execFileAsync(
          python,
          [
            "-m", "edge_tts",
            "--voice", voice.name,
            "--file", inputFile,
            "--write-media", outputFile,
            `--rate=${voice.rate}`,
            `--pitch=${voice.pitch}`,
          ],
          { timeout: 60_000, maxBuffer: 256 * 1024, windowsHide: true }
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        if (/ENOENT|not found/i.test(detail)) {
          throw new StudioError(503, "Python bulunamadı. 'py --version' ile kontrol et.");
        }
        if (/No module named edge_tts|ModuleNotFoundError/i.test(detail)) {
          throw new StudioError(503, "Edge TTS kurulu değil. 'py -m pip install edge-tts' çalıştır.");
        }
        if (/timed out|ETIMEDOUT/i.test(detail)) {
          throw new StudioError(504, "Ece'nin ses üretimi zaman aşımına uğradı.");
        }
        // Üçüncü taraf servisten gelen ayrıntıları kullanıcıya yansıtma.
        throw new StudioError(502, "Edge TTS konuşma üretemedi. İnterneti ve Edge TTS kurulumunu kontrol et.");
      }

      let audio: Buffer;
      try {
        audio = await readFile(outputFile);
      } catch {
        throw new StudioError(502, "Edge TTS ses dosyası oluşturmadı.");
      }
      if (audio.length === 0 || audio.length > MAX_AUDIO_SIZE) {
        throw new StudioError(502, "Üretilen ses dosyasının boyutu geçersiz.");
      }

      return new Response(new Uint8Array(audio), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } finally {
      await rm(workingDir, { recursive: true, force: true });
    }
  } catch (error) {
    return apiError(error);
  }
}
