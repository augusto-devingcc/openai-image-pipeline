"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidOpenAIKey } from "@/lib/use-api-key";

type Props = {
  apiKey: string | null;
  onSave: (key: string | null) => void;
  triggerVariant?: "default" | "compact";
};

export function ApiKeyDialog({ apiKey, onSave, triggerVariant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(apiKey ?? "");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      onSave(null);
      setOpen(false);
      return;
    }
    if (!isValidOpenAIKey(trimmed)) {
      setError("Key must start with sk- and be at least 23 characters.");
      return;
    }
    onSave(trimmed);
    setError(null);
    setOpen(false);
  };

  const handleClear = () => {
    setValue("");
    onSave(null);
    setError(null);
    setOpen(false);
  };

  const masked = apiKey ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}` : null;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setValue(apiKey ?? ""); }}>
      <DialogTrigger asChild>
        {triggerVariant === "compact" ? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#94a3b8] hover:text-[#34d399] border border-[#334155] hover:border-[#34d399]/50 bg-[#1e293b] px-3 py-1.5 rounded-full transition-colors"
          >
            <KeyRound className="h-3 w-3" />
            {masked ? <span>{masked}</span> : <span>Set OpenAI key</span>}
          </button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="h-11 border-[#334155] bg-[#1e293b] text-[#f4f4f5] hover:bg-[#1e293b]/80 hover:text-[#34d399]"
          >
            <KeyRound className="h-4 w-4 mr-2" />
            {masked ? `Key: ${masked}` : "Add your OpenAI API key"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[#0F172A] border-[#334155] text-[#f4f4f5] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#f4f4f5] flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-[#34d399]" /> Bring your own OpenAI key
          </DialogTitle>
          <DialogDescription className="text-[#94a3b8] pt-2 space-y-2">
            <span className="block">
              This demo runs on your own OpenAI API key. The key lives only in your
              browser&apos;s localStorage. It is sent with each request as a header, never
              persisted on the server, never logged.
            </span>
            <span className="block">
              Get one at{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#34d399] underline-offset-4 hover:underline"
              >
                platform.openai.com/api-keys
              </a>
              . Cost depends on model and size. A 10-image run at gpt-image-1 medium
              quality is roughly $0.40 to $0.50.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <label className="text-xs uppercase tracking-wider text-[#94a3b8] font-mono">
            API key
          </label>
          <div className="relative">
            <Input
              type={reveal ? "text" : "password"}
              value={value}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              placeholder="sk-..."
              className="bg-[#1e293b] border-[#334155] text-[#f4f4f5] font-mono pr-10"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="absolute inset-y-0 right-0 px-3 flex items-center text-[#94a3b8] hover:text-[#34d399]"
              aria-label={reveal ? "Hide key" : "Show key"}
            >
              {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-start gap-2 text-xs text-[#94a3b8]">
            <ShieldCheck className="h-4 w-4 text-[#34d399] mt-0.5 shrink-0" />
            <span>
              The server forwards your key to OpenAI for the duration of one run and
              throws it away. Inspect the network tab to verify. Open source at the
              repo link in the footer.
            </span>
          </div>
        </div>

        <DialogFooter className="flex flex-row sm:justify-between sm:gap-2 gap-2">
          {apiKey && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Remove key
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[#334155] bg-transparent hover:bg-[#1e293b] text-[#f4f4f5]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              className="bg-[#34d399] text-[#052e1a] hover:bg-[#34d399]/90 font-medium"
            >
              Save key
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
