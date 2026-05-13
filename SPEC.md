# OpenAI Image Pipeline — Spec

**Purpose:** Portfolio Piece 3 for Augusto García's Upwork profile + closer for a $500 fixed-price Upwork job titled "OpenAI API integration for Image Processing" from a German client.

The demo shows a working end-to-end image batch processor: drag-drop a folder of images, paste an OpenAI API key (BYOK), paste a prompt, watch each image process through the OpenAI API, then download the results as a zip. The companion Python CLI in `/cli` mirrors the same logic but reads from disk (which is what the actual Upwork client would run on their server).

## Live URL

`<vercel-default>.vercel.app` (assigned by Vercel on deploy, will be stable). The custom domain is optional and lives on the workfuelai.app zone if we choose to attach one later. For Upwork's Project URL field the `.vercel.app` URL is required because Upwork rejects other `.app` TLDs.

## What the demo does

1. User pastes their OpenAI API key (stored in browser localStorage, sent only as `Authorization: Bearer <key>` style header per request, never persisted on the server).
2. User picks images via file input (multiple files at once, or a single zip).
3. User pastes a prompt (the same prompt is applied to every image).
4. User picks the operation mode: **generate** (text-only prompt creates a new image), **edit** (prompt + input image creates a transformed image), or **variation** (just an input image to remix).
5. On submit, the backend opens a Server-Sent Events stream and processes each image one at a time, calling the appropriate OpenAI endpoint.
6. Each image emits `image_start` / `image_result` / `image_error` events with the image filename, duration, and result preview (small thumbnail).
7. Failures are caught per-image: the loop continues, the failure is logged to the SSE stream as `image_error`, and the final summary lists which files succeeded vs failed.
8. When the run is complete, user can download a zip of all processed images. Failures are listed in an `errors.jsonl` inside the zip.

## Stack (matches the Sales Intelligence Agent demo for consistency)

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router (React 19) |
| Styling | Tailwind v4 + shadcn/ui |
| Hosting | Vercel |
| AI | OpenAI API via `openai` Node SDK |
| Streaming | Next.js Route Handler with `ReadableStream`, SSE event protocol |
| Image utilities | `sharp` for thumbnailing the preview, `jszip` for the final download |
| Domain | `<vercel-default>.vercel.app` |
| Auth pattern | Bring-your-own-key (BYOK), `X-OpenAI-Key` header, browser localStorage |

## Brand (same as Sales Intel demo, for visual consistency across portfolio)

- Background: `#0F172A` (slate-900)
- Surface: `#1E293B` (slate-800)
- Accent: `#34D399` (emerald-400)
- Text primary: `#F4F4F5` (zinc-100)
- Text muted: `#94A3B8` (slate-400)
- Tool call / active: `#FBBF24` (amber-400)
- Fonts: Geist Sans + Geist Mono
- Author footer: "Built by Augusto García · github.com/augusto-devingcc"

## SSE event protocol

```
event: run_started
data: {"run_id":"...","total":12,"mode":"edit"}

event: image_start
data: {"index":1,"filename":"product-001.jpg"}

event: image_result
data: {"index":1,"filename":"product-001.jpg","status":"success","duration_ms":3210,"preview":"data:image/jpeg;base64,..."}

event: image_error
data: {"index":2,"filename":"product-002.jpg","duration_ms":820,"error":"Rate limit exceeded"}

event: final
data: {"succeeded":11,"failed":1,"total":12,"download_token":"..."}
```

## OpenAI API reference (must be verified by research agent)

### Endpoints

- `POST /v1/images/generations` — text-only prompt, returns generated image
- `POST /v1/images/edits` — prompt + input image (+ optional mask), returns edited image
- `POST /v1/images/variations` — input image only, returns a remix

### Models (verify currency)

- `gpt-image-1` (Augusto refers to this as "Image 2.0", latest model)
- `dall-e-3`
- `dall-e-2`

### Payload format

- `/v1/images/generations`: JSON body, `{model, prompt, n, size, quality?, response_format?}`
- `/v1/images/edits`: multipart/form-data, `{model, image, mask?, prompt, n, size, quality?, response_format?}`
- `/v1/images/variations`: multipart/form-data, `{model, image, n, size, response_format}` (dall-e-2 only)

### Response

- `response_format: "url"` → temporary URL valid for ~1 hour
- `response_format: "b64_json"` → base64-encoded image inline. Better for our pipeline because we re-encode for download.

Notes verified against OpenAI docs (May 2026):

- `response_format` only applies to `dall-e-3` and `dall-e-2`. `gpt-image-1` (and later) always returns base64 inline.
- `variations` endpoint is `dall-e-2` only. For variation mode we force `model=dall-e-2`.
- `gpt-image-1` takes a `quality` of `low | medium | high | auto`; `dall-e-3` takes `standard | hd`; `dall-e-2` takes neither.
- Approximate per-image pricing tiers shipped in `src/lib/openai/pricing.ts`. Update there when OpenAI changes the pricing page.

## Companion Python CLI (`cli/process.py`)

- argparse: `--input`, `--output`, `--prompt`, `--mode {generate,edit,variation}`, `--model`, `--api-key` (or env var `OPENAI_API_KEY`)
- Loop over images in `--input` folder
- Calls the same OpenAI endpoints via the `openai` Python SDK
- Saves outputs under `<output>/YYYY-MM-DD/` preserving original filenames
- Failures append to `<output>/errors.jsonl` with `{filename, error, timestamp}`
- Retry with `tenacity` decorator (exponential backoff, max 3 attempts)
- Structured stdout logging via `logging` module

## Author / publishing

- GitHub user: `augusto-devingcc`
- Repo: `https://github.com/augusto-devingcc/openai-image-pipeline` (already created, empty as of build start)
- All commits clean and professional. No "AI generated" prefixes. No emojis in commits.
- Build artifacts (`.next/`, `node_modules/`, `__pycache__/`, `dist/`) gitignored.

## What "done" means

1. ✅ Live demo at the assigned `.vercel.app` URL, working end-to-end.
2. ✅ Companion Python CLI in `/cli` works against a sample folder.
3. ✅ README at repo root explains both, with install + run instructions.
4. ✅ Pushed to `origin/main`.
5. ✅ Vercel build green, no console errors, no exposed secrets.
