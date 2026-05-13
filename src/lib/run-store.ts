import type { RunEntry } from "./openai/types";

const TTL_MS = 15 * 60 * 1000;

declare global {
  var __oipRunStore: Map<string, RunEntry> | undefined;
}

const store: Map<string, RunEntry> =
  globalThis.__oipRunStore ?? new Map<string, RunEntry>();

if (!globalThis.__oipRunStore) {
  globalThis.__oipRunStore = store;
}

export function createRun(run_id: string): RunEntry {
  const entry: RunEntry = { run_id, created_at: Date.now(), items: [] };
  store.set(run_id, entry);
  setTimeout(() => {
    store.delete(run_id);
  }, TTL_MS).unref?.();
  return entry;
}

export function getRun(run_id: string): RunEntry | undefined {
  const entry = store.get(run_id);
  if (!entry) return undefined;
  if (Date.now() - entry.created_at > TTL_MS) {
    store.delete(run_id);
    return undefined;
  }
  return entry;
}

export function appendResult(run_id: string, filename: string, b64: string): void {
  const entry = store.get(run_id);
  if (!entry) return;
  entry.items.push({ filename, b64 });
}

export function appendError(run_id: string, filename: string, error: string): void {
  const entry = store.get(run_id);
  if (!entry) return;
  entry.items.push({ filename, error });
}
