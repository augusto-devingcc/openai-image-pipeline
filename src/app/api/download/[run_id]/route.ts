import { NextRequest } from "next/server";
import JSZip from "jszip";
import { getRun } from "@/lib/run-store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ run_id: string }> }
): Promise<Response> {
  const { run_id } = await ctx.params;
  const entry = getRun(run_id);
  if (!entry) {
    return new Response(JSON.stringify({ error: "Run not found or expired" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const zip = new JSZip();
  const errors: Array<{ filename: string; error: string; timestamp: string }> = [];
  const usedNames = new Map<string, number>();

  for (const item of entry.items) {
    if (item.error) {
      errors.push({
        filename: item.filename,
        error: item.error,
        timestamp: new Date().toISOString(),
      });
      continue;
    }
    if (!item.b64) continue;

    const base = item.filename.replace(/\.[^.]+$/, "");
    const count = usedNames.get(base) ?? 0;
    usedNames.set(base, count + 1);
    const outName = count === 0 ? `${base}.png` : `${base}-${count + 1}.png`;
    zip.file(outName, Buffer.from(item.b64, "base64"));
  }

  if (errors.length > 0) {
    const jsonl = errors.map((e) => JSON.stringify(e)).join("\n");
    zip.file("errors.jsonl", jsonl);
  }

  const blob = await zip.generateAsync({ type: "uint8array" });

  return new Response(blob as BlobPart, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="processed-${run_id}.zip"`,
    },
  });
}
