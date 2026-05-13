"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  max: number;
  disabled?: boolean;
};

export function FileDrop({ files, onChange, max, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const valid = Array.from(incoming).filter((f) => ACCEPTED.includes(f.type));
      const next = [...files, ...valid].slice(0, max);
      onChange(next);
    },
    [files, max, onChange]
  );

  const remove = (i: number) => {
    const next = [...files];
    next.splice(i, 1);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled) return;
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`cursor-pointer rounded-md border border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-[#34d399] bg-[#34d399]/5"
            : "border-[#334155] bg-[#1e293b]/40 hover:border-[#34d399]/50"
        } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="mx-auto h-6 w-6 text-[#94a3b8]" />
        <p className="mt-2 text-sm text-[#f4f4f5]">
          Drop JPG, PNG, or WEBP files here or click to browse
        </p>
        <p className="mt-1 text-xs text-[#94a3b8] font-mono">
          {files.length} / {max} selected
        </p>
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="relative group aspect-square rounded-md border border-[#334155] bg-[#0f172a] overflow-hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-full w-full object-cover"
                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-500/80"
              >
                <X className="h-3 w-3" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 py-1">
                <p className="text-[10px] text-white font-mono truncate">{file.name}</p>
              </div>
            </div>
          ))}
          {files.length < max && (
            <button
              type="button"
              onClick={() => !disabled && inputRef.current?.click()}
              disabled={disabled}
              className="aspect-square rounded-md border border-dashed border-[#334155] hover:border-[#34d399]/50 bg-[#1e293b]/40 flex items-center justify-center text-[#94a3b8] hover:text-[#34d399]"
            >
              <ImagePlus className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
