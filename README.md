# OpenAI Image Pipeline

Drop a folder of images. The OpenAI API processes them in batch.

<!-- screenshot here -->

A bring-your-own-key web demo that streams progress as it generates, edits, or remixes images through the OpenAI Images API. Ships with a Python CLI that runs the same pipeline against a local folder.

## Live demo

<!-- live URL here -->

## What this is

A Next.js 16 app that lets you upload images, choose a mode (generate, edit, variation) and a model (gpt-image-1, dall-e-3, dall-e-2), and stream each image through the OpenAI Images API one at a time. Per-image progress, cost, and previews arrive over Server-Sent Events. Successful outputs are packaged as a zip for download.

## Tech stack

- Next.js 16 (App Router, React 19)
- TypeScript, strict mode
- Tailwind CSS v4 + shadcn/ui
- OpenAI Node SDK (`openai` v6)
- `sharp` for preview thumbnails
- `jszip` for download bundles
- Hosted on Vercel

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Bring your own key

The OpenAI API key never leaves the user's browser except as a per-request `X-OpenAI-Key` header to this app's own `/api/process` route. The route forwards it to OpenAI through the SDK for the duration of one run, then drops it. The key is:

- Stored only in `localStorage` under `oip.openai_key`
- Never logged on the server
- Never persisted to any database
- Cleared from the request handler as soon as the run finishes

Inspect the network tab to verify. All source is in this repo.

## Companion CLI

A Python CLI in [`cli/`](./cli) mirrors the same pipeline for unattended use on a server. It reads a directory, applies the configured operation to each file with retry and structured logging, and writes outputs to a dated output folder.

```bash
cd cli
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python process.py --input ./inputs --output ./outputs --prompt "Replace background with white" --mode edit
```

`OPENAI_API_KEY` can be passed via `--api-key` or env var.

## License

MIT.

## Author

Built by Augusto García. [github.com/augusto-devingcc](https://github.com/augusto-devingcc).
