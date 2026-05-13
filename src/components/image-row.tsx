"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export type ImageRowState = {
  index: number;
  filename: string;
  status: "pending" | "running" | "success" | "error";
  preview?: string;
  error?: string;
  duration_ms?: number;
  cost_estimate?: number;
};

export function ImageRow({ row }: { row: ImageRowState }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[#334155] bg-[#1e293b]/60 p-3">
      <div className="h-14 w-14 shrink-0 rounded-md bg-[#0f172a] border border-[#334155] overflow-hidden flex items-center justify-center">
        {row.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.preview} alt={row.filename} className="h-full w-full object-cover" />
        ) : row.status === "running" ? (
          <Loader2 className="h-5 w-5 text-[#fbbf24] animate-spin" />
        ) : row.status === "error" ? (
          <AlertCircle className="h-5 w-5 text-red-400" />
        ) : (
          <span className="text-[10px] text-[#475569] font-mono">pending</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#f4f4f5] font-mono truncate">{row.filename}</span>
          {row.status === "success" && (
            <CheckCircle2 className="h-3.5 w-3.5 text-[#34d399] shrink-0" />
          )}
        </div>
        <div className="text-xs text-[#94a3b8] mt-0.5 truncate">
          {row.status === "pending" && "Waiting"}
          {row.status === "running" && "Processing"}
          {row.status === "success" &&
            `Done in ${row.duration_ms ?? 0}ms · ~$${(row.cost_estimate ?? 0).toFixed(3)}`}
          {row.status === "error" && (
            <span className="text-red-400">{row.error ?? "Failed"}</span>
          )}
        </div>
      </div>
    </div>
  );
}
