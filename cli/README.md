# OpenAI Image Pipeline CLI

A small Python command-line tool that runs a folder of images through the OpenAI Images API in batch. It is the server-side companion to the `openai-image-pipeline` web demo. The web demo is for interactive testing in a browser; this CLI is what you run on a box when you actually need to process hundreds of files unattended.

## Install

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your key, or export `OPENAI_API_KEY` in your shell.

```bash
cp .env.example .env
```

## Usage

The CLI supports three modes that map one-to-one to the OpenAI Images API.

### Edit mode (default)

Takes each image in the input folder, applies the prompt as a transformation, and writes the result.

```bash
python process.py \
  --input ./sample \
  --output ./out \
  --mode edit \
  --prompt "Replace the background with a soft studio gradient. Keep the subject untouched."
```

### Generate mode

Ignores the pixel contents of each input image and uses its filename to produce one generated output per input. Useful when you want a deterministic mapping between source filenames and new images.

```bash
python process.py \
  --input ./sample \
  --output ./out \
  --mode generate \
  --prompt "A minimal flat-vector illustration of a product on a pastel background, 4k, centered."
```

### Variation mode

Remixes each input image. Note: as of writing, only `dall-e-2` supports variations through the OpenAI API. Pass `--model dall-e-2` when using this mode.

```bash
python process.py \
  --input ./sample \
  --output ./out \
  --mode variation \
  --model dall-e-2 \
  --size 1024x1024
```

### All flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--input` | yes | — | Directory with source images (`.jpg`, `.jpeg`, `.png`, `.webp`). |
| `--output` | yes | — | Output root. A dated subfolder is created on each run. |
| `--prompt` | yes for `generate` / `edit` | — | Prompt applied to every image. |
| `--mode` | no | `edit` | One of `generate`, `edit`, `variation`. |
| `--model` | no | `gpt-image-1` | OpenAI image model. Use `dall-e-2` for variations. |
| `--size` | no | `1024x1024` | Output size. Must be valid for the chosen model. |
| `--api-key` | no | — | OpenAI key. Falls back to `OPENAI_API_KEY`. |
| `--max-retries` | no | `3` | Retry attempts per image (exponential backoff). |
| `--concurrency` | no | `1` | Images processed in parallel. |
| `--verbose` | no | off | Enable DEBUG logging. |

## Output structure

Each run creates a timestamped subfolder under `--output`:

```
out/
  2026-05-12-141233/
    product-001.png
    product-002.png
    product-003.png
    errors.jsonl        # only if at least one image failed
```

Successful outputs preserve the original filename stem and are saved as PNG, which is what the OpenAI API returns. Failures are recorded one per line in `errors.jsonl`:

```json
{"filename": "product-002.jpg", "error": "Rate limit exceeded", "timestamp": "2026-05-12T14:12:48+00:00"}
```

The process never crashes on a single image failure. It logs the error, writes it to the JSONL file, and moves on.

## Cost estimate

Pricing for `gpt-image-1` at `1024x1024` (verify on the OpenAI pricing page before quoting a client):

| Quality | Approximate cost per image |
|---------|----------------------------|
| Low     | around $0.011 |
| Medium  | around $0.04 |
| High    | around $0.17 |

A batch of 100 images at medium quality runs roughly $4. `dall-e-2` is cheaper (under $0.02 per image at 1024x1024) but produces lower-quality output. The CLI does not set a quality flag explicitly, so it inherits the API default for the chosen model.

## Why a CLI and not the web demo

The web demo is for interactive testing: paste a key, drag a few files, watch them stream through in the browser. That is great for showing a client what is possible, but it falls over for the real job. Production batches are usually:

- Triggered by cron, a queue, or another service on a server.
- Long enough that a browser tab would time out or be closed.
- Sensitive enough that the API key should never touch a frontend.

This CLI reads from local disk, holds the key in an env var, retries on transient API failures, and produces a clean dated folder with a JSONL error log. It is the piece you actually deploy.

## Notes

- API keys are never written to logs or to disk by this script. The only place the key is held is in memory during a run.
- The script verifies each input file with Pillow before sending it to the API, which catches truncated or non-image files early.
- For very large batches, raise `--concurrency` carefully. The OpenAI Images API enforces per-account rate limits and you will hit them well before you saturate a typical machine.

---

Built by Augusto García · github.com/augusto-devingcc
