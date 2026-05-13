import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { createOpenAIClient, isValidOpenAIKey } from "@/lib/openai/client";
import { generateImage } from "@/lib/openai/generate";
import { editImage } from "@/lib/openai/edit";
import { defaultQualityFor, defaultSizeFor } from "@/lib/openai/pricing";
import { appendError, appendResult, createRun } from "@/lib/run-store";
import { sseEvent } from "@/lib/sse";
import { makeThumbnailDataUrl } from "@/lib/preview";
import type { ImageModel, ImageSize, Mode, Quality } from "@/lib/openai/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IMAGES = 50;

function bad(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseMode(value: unknown): Mode | null {
  if (value === "generate" || value === "edit") return value;
  return null;
}

function parseModel(value: unknown): ImageModel | null {
  if (value === "gpt-image-2" || value === "gpt-image-1") return value;
  return null;
}

function parseSize(value: unknown, fallback: ImageSize): ImageSize {
  const allowed: ImageSize[] = [
    "1024x1024",
    "1024x1536",
    "1536x1024",
    "2048x2048",
  ];
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as ImageSize)
    : fallback;
}

function parseQuality(value: unknown, fallback: Quality): Quality {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  return fallback;
}

export async function POST(req: NextRequest): Promise<Response> {
  const apiKey = req.headers.get("x-openai-key");
  if (!apiKey || !isValidOpenAIKey(apiKey)) {
    return bad("Missing or malformed OpenAI API key", 401);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Expected multipart/form-data", 400);
  }

  const prompt = String(form.get("prompt") ?? "").trim();
  const mode = parseMode(form.get("mode"));
  const modelRaw = parseModel(form.get("model"));
  if (!mode) return bad("Invalid mode", 400);

  const model: ImageModel = modelRaw ?? "gpt-image-2";

  const size = parseSize(form.get("size"), defaultSizeFor());
  const quality = parseQuality(form.get("quality"), defaultQualityFor());

  const files = form.getAll("image").filter((f): f is File => f instanceof File);

  if (mode === "edit" && files.length === 0) {
    return bad("At least one image file is required for edit mode", 400);
  }
  if (files.length > MAX_IMAGES) {
    return bad(`Maximum ${MAX_IMAGES} images per run`, 400);
  }
  if (prompt.length === 0) {
    return bad("Prompt is required", 400);
  }

  const total = mode === "generate" ? Math.max(files.length || 1, 1) : files.length;
  const run_id = randomUUID();
  createRun(run_id);

  const client = createOpenAIClient(apiKey);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      send("run_started", { run_id, total, mode });

      let succeeded = 0;
      let failed = 0;

      for (let i = 0; i < total; i++) {
        const file = files[i];
        const filename = file?.name ?? `generated-${i + 1}.png`;
        const index = i + 1;

        send("image_start", { index, filename });
        const start = Date.now();

        try {
          let result;
          if (mode === "generate") {
            result = await generateImage(client, { prompt, model, size, quality });
          } else {
            const buf = Buffer.from(await file!.arrayBuffer());
            result = await editImage(client, {
              image: buf,
              filename,
              mimeType: file!.type || "image/png",
              prompt,
              model,
              size,
              quality,
            });
          }

          appendResult(run_id, filename, result.b64);
          const preview = await makeThumbnailDataUrl(result.b64);
          send("image_result", {
            index,
            filename,
            status: "success",
            duration_ms: Date.now() - start,
            preview,
            cost_estimate: result.cost_estimate,
            model_used: result.model_used,
          });
          succeeded += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          appendError(run_id, filename, message);
          send("image_error", {
            index,
            filename,
            duration_ms: Date.now() - start,
            error: message,
          });
          failed += 1;
        }
      }

      send("final", {
        succeeded,
        failed,
        total,
        download_token: run_id,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
