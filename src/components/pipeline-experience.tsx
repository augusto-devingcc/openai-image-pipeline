"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ArrowRight, Download, Loader2, Radio, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiKeyDialog } from "./api-key-dialog";
import { FileDrop } from "./file-drop";
import { ImageRow, type ImageRowState } from "./image-row";
import { useApiKey } from "@/lib/use-api-key";
import { estimateImageCost } from "@/lib/openai/pricing";
import type { ImageModel, Mode } from "@/lib/openai/types";

const MAX_IMAGES = 50;

const MODES: Array<{ value: Mode; title: string; desc: string }> = [
  {
    value: "edit",
    title: "Edit",
    desc: "Transform each input image using the prompt. Best for e-commerce cleanup.",
  },
  {
    value: "generate",
    title: "Generate",
    desc: "Create new images from the prompt alone. Use the count of uploaded files as the batch size.",
  },
];

type ModelOption = { value: ImageModel; label: string; note: string };

const MODEL_OPTIONS: ModelOption[] = [
  { value: "gpt-image-2", label: "Image 2.0 (gpt-image-2)", note: "Latest. Best text rendering and physics." },
  { value: "gpt-image-1", label: "Image 1 (gpt-image-1)", note: "Cheaper. Previous generation." },
];

export function PipelineExperience() {
  const { apiKey, setApiKey, hydrated } = useApiKey();
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("edit");
  const [model, setModel] = useState<ImageModel>("gpt-image-2");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [rows, setRows] = useState<ImageRowState[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [totals, setTotals] = useState<{ succeeded: number; failed: number; total: number } | null>(null);
  const [liveCost, setLiveCost] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const quality = "medium" as const;
  const size = "1024x1024" as const;

  const plannedCount = mode === "generate" ? Math.max(files.length, 1) : files.length;
  const estimatedCost = useMemo(
    () => plannedCount * estimateImageCost(model, size, quality),
    [plannedCount, model, size, quality]
  );

  const reset = useCallback(() => {
    setRows([]);
    setErrorMsg(null);
    setRunId(null);
    setTotals(null);
    setLiveCost(0);
  }, []);

  const handleEvent = useCallback((event: string, data: Record<string, unknown>) => {
    switch (event) {
      case "run_started": {
        setRunId(String(data.run_id));
        const total = Number(data.total) || 0;
        setRows(
          Array.from({ length: total }, (_, i) => ({
            index: i + 1,
            filename: `image-${i + 1}`,
            status: "pending",
          }))
        );
        break;
      }
      case "image_start": {
        const idx = Number(data.index);
        setRows((prev) => {
          const next = [...prev];
          if (next[idx - 1]) {
            next[idx - 1] = {
              ...next[idx - 1],
              filename: String(data.filename),
              status: "running",
            };
          }
          return next;
        });
        break;
      }
      case "image_result": {
        const idx = Number(data.index);
        const cost = Number(data.cost_estimate) || 0;
        setRows((prev) => {
          const next = [...prev];
          if (next[idx - 1]) {
            next[idx - 1] = {
              ...next[idx - 1],
              filename: String(data.filename),
              status: "success",
              preview: String(data.preview),
              duration_ms: Number(data.duration_ms) || 0,
              cost_estimate: cost,
            };
          }
          return next;
        });
        setLiveCost((c) => c + cost);
        break;
      }
      case "image_error": {
        const idx = Number(data.index);
        setRows((prev) => {
          const next = [...prev];
          if (next[idx - 1]) {
            next[idx - 1] = {
              ...next[idx - 1],
              filename: String(data.filename),
              status: "error",
              error: String(data.error),
              duration_ms: Number(data.duration_ms) || 0,
            };
          }
          return next;
        });
        break;
      }
      case "final":
        setTotals({
          succeeded: Number(data.succeeded) || 0,
          failed: Number(data.failed) || 0,
          total: Number(data.total) || 0,
        });
        setStatus("done");
        break;
    }
  }, []);

  const start = useCallback(async () => {
    if (!apiKey) {
      setErrorMsg("Add your OpenAI API key first. The key stays in your browser.");
      setStatus("error");
      return;
    }
    if (prompt.trim().length === 0) {
      setErrorMsg("Add a prompt before running.");
      setStatus("error");
      return;
    }
    if (mode === "edit" && files.length === 0) {
      setErrorMsg("Upload at least one image for edit mode.");
      setStatus("error");
      return;
    }

    abortRef.current?.abort();
    reset();
    setStatus("running");

    const fd = new FormData();
    fd.set("prompt", prompt);
    fd.set("mode", mode);
    fd.set("model", model);
    fd.set("size", size);
    fd.set("quality", quality);
    for (const f of files) fd.append("image", f);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "X-OpenAI-Key": apiKey },
        body: fd,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        let message = text || `Request failed with ${res.status}`;
        try {
          const parsed = JSON.parse(text);
          if (parsed?.error) message = parsed.error;
        } catch {}
        throw new Error(message);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          const parsed = parseSSE(rawEvent);
          if (parsed) handleEvent(parsed.event, parsed.data);
        }
      }

      setStatus((s) => (s === "running" ? "done" : s));
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Stream failed.";
      setErrorMsg(message);
      setStatus("error");
    }
  }, [apiKey, prompt, mode, model, size, quality, files, reset, handleEvent]);

  const isRunning = status === "running";
  const canRun =
    !!apiKey &&
    !isRunning &&
    prompt.trim().length > 0 &&
    (mode === "generate" ? true : files.length > 0);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="flex items-center justify-center gap-2 mb-4">
        <Badge
          variant="secondary"
          className="bg-[#1e293b] border-[#334155] text-[#34d399] font-mono text-[10px] uppercase tracking-wider"
        >
          <Sparkles className="h-3 w-3 mr-1" /> OpenAI Images API + streaming
        </Badge>
      </div>
      <h1 className="text-center text-3xl sm:text-5xl font-semibold tracking-tight text-[#f4f4f5]">
        OpenAI Image Pipeline
      </h1>
      <p className="mt-3 text-center text-[#94a3b8] text-base sm:text-lg max-w-2xl mx-auto">
        Drop a folder of images. The OpenAI API processes them in batch.
      </p>

      <div className="mt-6 flex justify-center">
        {hydrated && (
          <ApiKeyDialog apiKey={apiKey} onSave={setApiKey} triggerVariant="compact" />
        )}
      </div>

      {hydrated && !apiKey && (
        <div className="mt-6 max-w-2xl mx-auto rounded-md border border-[#fbbf24]/30 bg-[#fbbf24]/5 p-3 text-sm text-[#fbbf24]/90">
          This demo runs on your own OpenAI API key. The key lives only in your browser.
          Add one above to enable the pipeline.
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#1e293b]/60 border-[#334155]">
          <CardContent className="p-5 space-y-5">
            <section>
              <Label className="text-xs uppercase tracking-wider text-[#94a3b8] font-mono mb-2 block">
                Mode
              </Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as Mode)}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                disabled={isRunning}
              >
                {MODES.map((m) => (
                  <label
                    key={m.value}
                    htmlFor={`mode-${m.value}`}
                    className={`cursor-pointer rounded-md border p-3 transition-colors ${
                      mode === m.value
                        ? "border-[#34d399] bg-[#34d399]/5"
                        : "border-[#334155] hover:border-[#34d399]/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={m.value} id={`mode-${m.value}`} />
                      <span className="text-sm font-medium text-[#f4f4f5]">{m.title}</span>
                    </div>
                    <p className="text-xs text-[#94a3b8] mt-1.5 leading-snug">{m.desc}</p>
                  </label>
                ))}
              </RadioGroup>
            </section>

            <section>
              <Label className="text-xs uppercase tracking-wider text-[#94a3b8] font-mono mb-2 block">
                Model
              </Label>
              <Select
                value={model}
                onValueChange={(v) => setModel(v as ImageModel)}
                disabled={isRunning}
              >
                <SelectTrigger className="w-full bg-[#1e293b] border-[#334155] text-[#f4f4f5]">
                  <SelectValue placeholder="Pick a model" />
                </SelectTrigger>
                <SelectContent className="bg-[#1e293b] border-[#334155] text-[#f4f4f5]">
                  {MODEL_OPTIONS.map((m) => (
                    <SelectItem
                      key={m.value}
                      value={m.value}
                      className="focus:bg-[#334155] focus:text-[#f4f4f5]"
                    >
                      <span className="font-medium">{m.label}</span>
                      <span className="text-[#94a3b8] text-xs ml-2">{m.note}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>

            <section>
              <Label
                htmlFor="prompt"
                className="text-xs uppercase tracking-wider text-[#94a3b8] font-mono mb-2 block"
              >
                Prompt
              </Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                disabled={isRunning}
                placeholder={
                  mode === "generate"
                    ? "A studio product photo of a leather wallet on a marble surface, soft lighting"
                    : "Replace background with pure white. Convert to studio shot with soft lighting."
                }
                className="bg-[#1e293b] border-[#334155] text-[#f4f4f5] font-mono text-sm placeholder:text-[#475569]"
              />
            </section>

            <section>
              <Label className="text-xs uppercase tracking-wider text-[#94a3b8] font-mono mb-2 block">
                Images {mode === "generate" && <span className="text-[#475569]">(used as batch size; not sent)</span>}
              </Label>
              <FileDrop
                files={files}
                onChange={setFiles}
                max={MAX_IMAGES}
                disabled={isRunning}
              />
            </section>

            <section className="border-t border-[#334155] pt-4">
              <div className="flex items-center justify-between text-sm">
                <div>
                  <p className="text-[#f4f4f5]">
                    Estimated cost:{" "}
                    <span className="font-mono text-[#34d399]">
                      ${estimatedCost.toFixed(3)}
                    </span>
                  </p>
                  <p className="text-xs text-[#94a3b8] mt-0.5">
                    {plannedCount} image{plannedCount === 1 ? "" : "s"} · {model} · {size}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={start}
                  disabled={!canRun}
                  className="h-11 bg-[#34d399] text-[#052e1a] hover:bg-[#34d399]/90 font-medium"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Running
                    </>
                  ) : (
                    <>
                      Run pipeline <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </section>
          </CardContent>
        </Card>

        <Card className="bg-[#1e293b]/60 border-[#334155]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-[#f4f4f5]">Run progress</h2>
              <div className="flex items-center gap-3 text-xs text-[#94a3b8] font-mono">
                <span>${liveCost.toFixed(3)}</span>
                {(status !== "idle") && (
                  <span className="flex items-center gap-1">
                    <Radio
                      className={`h-3 w-3 ${
                        isRunning ? "text-[#fbbf24] animate-pulse" : "text-[#34d399]"
                      }`}
                    />
                    {isRunning ? "live" : status === "done" ? "done" : status}
                  </span>
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
                {errorMsg}
              </div>
            )}

            <ScrollArea className="h-[480px] pr-3">
              {rows.length === 0 ? (
                <div className="h-[440px] flex items-center justify-center text-center text-sm text-[#475569]">
                  Progress will stream here once you run the pipeline.
                </div>
              ) : (
                <div className="space-y-2">
                  {rows.map((r) => (
                    <ImageRow key={r.index} row={r} />
                  ))}
                </div>
              )}
            </ScrollArea>

            {totals && runId && totals.succeeded > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-[#334155] pt-4">
                <div className="text-xs text-[#94a3b8] font-mono">
                  {totals.succeeded} ok · {totals.failed} failed · total ${liveCost.toFixed(3)}
                </div>
                <a
                  href={`/api/download/${runId}`}
                  className="inline-flex items-center gap-2 rounded-md bg-[#34d399] text-[#052e1a] px-3 py-2 text-sm font-medium hover:bg-[#34d399]/90"
                  download
                >
                  <Download className="h-4 w-4" /> Download zip
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function parseSSE(raw: string): { event: string; data: Record<string, unknown> } | null {
  let event = "message";
  let dataStr = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
  }
  if (!dataStr) return null;
  try {
    return { event, data: JSON.parse(dataStr) as Record<string, unknown> };
  } catch {
    return null;
  }
}
