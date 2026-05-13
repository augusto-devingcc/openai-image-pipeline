"""Batch image processor for the OpenAI Images API.

Reads a directory of source images, applies the configured operation
(generate, edit, or variation) to each one, and writes the results to a
dated output folder. Designed to run unattended on a server alongside the
companion Next.js web demo.
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from dotenv import load_dotenv
from openai import APIError, OpenAI, OpenAIError
from PIL import Image, UnidentifiedImageError
from tenacity import (
    RetryError,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

SUPPORTED_EXTENSIONS: tuple[str, ...] = (".jpg", ".jpeg", ".png", ".webp")
VALID_MODES: tuple[str, ...] = ("generate", "edit", "variation")
DEFAULT_MODEL: str = "gpt-image-1"
DEFAULT_SIZE: str = "1024x1024"

logger = logging.getLogger("openai_image_pipeline")


@dataclass(frozen=True)
class CLIConfig:
    """Validated CLI configuration."""

    input_dir: Path
    output_dir: Path
    prompt: str | None
    mode: str
    model: str
    size: str
    api_key: str
    max_retries: int
    concurrency: int
    verbose: bool


@dataclass(frozen=True)
class ImageResult:
    """Outcome of processing a single image."""

    filename: str
    success: bool
    error: str | None = None


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse CLI arguments. Does not perform validation."""
    parser = argparse.ArgumentParser(
        prog="process.py",
        description=(
            "Batch process a folder of images through the OpenAI Images API. "
            "Supports text-to-image generation, prompt-based edits, and variations."
        ),
    )
    parser.add_argument(
        "--input",
        required=True,
        type=Path,
        help="Directory containing source images (jpg, jpeg, png, webp).",
    )
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Directory where processed images will be saved. Created if missing.",
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default=None,
        help="Prompt to apply. Required for 'generate' and 'edit' modes.",
    )
    parser.add_argument(
        "--mode",
        choices=VALID_MODES,
        default="edit",
        help="Operation mode. Default: edit.",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"OpenAI image model. Default: {DEFAULT_MODEL}.",
    )
    parser.add_argument(
        "--size",
        default=DEFAULT_SIZE,
        help=f"Output image size, e.g. 1024x1024. Default: {DEFAULT_SIZE}.",
    )
    parser.add_argument(
        "--api-key",
        default=None,
        help="OpenAI API key. Falls back to OPENAI_API_KEY env var.",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=3,
        help="Maximum API retry attempts per image. Default: 3.",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=1,
        help="Number of images to process in parallel. Default: 1.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable DEBUG-level logging.",
    )
    return parser.parse_args(argv)


def configure_logging(verbose: bool) -> None:
    """Configure root logger for structured stdout output."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S%z",
        stream=sys.stdout,
    )


def resolve_api_key(cli_key: str | None) -> str:
    """Return a usable API key or raise ValueError.

    The returned key is never logged. Callers must keep it out of log messages.
    """
    load_dotenv(override=False)
    key = cli_key or os.environ.get("OPENAI_API_KEY", "")
    key = key.strip()
    if not key:
        raise ValueError(
            "Missing OpenAI API key. Pass --api-key or set OPENAI_API_KEY."
        )
    if not key.startswith("sk-"):
        raise ValueError("OpenAI API key must start with 'sk-'.")
    return key


def validate_config(args: argparse.Namespace) -> CLIConfig:
    """Validate parsed arguments and return a typed config."""
    if not args.input.exists() or not args.input.is_dir():
        raise ValueError(f"Input directory does not exist: {args.input}")

    if args.mode in ("generate", "edit") and not args.prompt:
        raise ValueError(f"--prompt is required for mode '{args.mode}'.")

    if args.max_retries < 1:
        raise ValueError("--max-retries must be at least 1.")

    if args.concurrency < 1:
        raise ValueError("--concurrency must be at least 1.")

    api_key = resolve_api_key(args.api_key)

    return CLIConfig(
        input_dir=args.input.resolve(),
        output_dir=args.output.resolve(),
        prompt=args.prompt,
        mode=args.mode,
        model=args.model,
        size=args.size,
        api_key=api_key,
        max_retries=args.max_retries,
        concurrency=args.concurrency,
        verbose=args.verbose,
    )


def list_input_images(input_dir: Path) -> list[Path]:
    """Return a sorted list of image files in the input directory."""
    files = sorted(
        p
        for p in input_dir.iterdir()
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    )
    return files


def verify_image(path: Path) -> None:
    """Open the file with Pillow to confirm it is a real image."""
    with Image.open(path) as img:
        img.verify()


def create_run_dir(output_dir: Path) -> Path:
    """Create and return a dated subfolder under output_dir."""
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    run_dir = output_dir / stamp
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


def build_retry(max_attempts: int) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Return a tenacity retry decorator configured with exponential backoff."""
    return retry(
        reraise=True,
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=1, min=1, max=20),
        retry=retry_if_exception_type((APIError, OpenAIError, ConnectionError, TimeoutError)),
    )


def call_generate(client: OpenAI, config: CLIConfig) -> bytes:
    """Call the generate endpoint and return raw image bytes."""
    response = client.images.generate(
        model=config.model,
        prompt=config.prompt or "",
        size=config.size,
        n=1,
    )
    return _extract_image_bytes(response)


def call_edit(client: OpenAI, config: CLIConfig, source: Path) -> bytes:
    """Call the edits endpoint and return raw image bytes."""
    with source.open("rb") as fh:
        response = client.images.edit(
            model=config.model,
            image=fh,
            prompt=config.prompt or "",
            size=config.size,
            n=1,
        )
    return _extract_image_bytes(response)


def call_variation(client: OpenAI, config: CLIConfig, source: Path) -> bytes:
    """Call the variations endpoint and return raw image bytes.

    Note: as of this writing only dall-e-2 supports variations; gpt-image-1
    does not. The caller is responsible for picking a supported model.
    """
    with source.open("rb") as fh:
        response = client.images.create_variation(
            model=config.model,
            image=fh,
            size=config.size,
            n=1,
        )
    return _extract_image_bytes(response)


def _extract_image_bytes(response: Any) -> bytes:
    """Pull the first image out of an Images API response as raw bytes."""
    data = getattr(response, "data", None)
    if not data:
        raise RuntimeError("OpenAI response did not include any image data.")
    first = data[0]
    b64 = getattr(first, "b64_json", None)
    if b64:
        return base64.b64decode(b64)
    url = getattr(first, "url", None)
    if url:
        raise RuntimeError(
            "OpenAI returned a URL instead of base64 image data. "
            "This CLI expects b64_json responses; check the chosen model."
        )
    raise RuntimeError("OpenAI response did not contain b64_json or url.")


def process_image(
    client: OpenAI,
    config: CLIConfig,
    source: Path | None,
    run_dir: Path,
    output_name: str,
) -> ImageResult:
    """Process a single image and write the result to run_dir.

    For 'generate' mode, source may be None and output_name is synthesized.
    """

    retry_decorator = build_retry(config.max_retries)

    @retry_decorator
    def _call() -> bytes:
        if config.mode == "generate":
            return call_generate(client, config)
        if config.mode == "edit":
            assert source is not None
            return call_edit(client, config, source)
        if config.mode == "variation":
            assert source is not None
            return call_variation(client, config, source)
        raise ValueError(f"Unknown mode: {config.mode}")

    try:
        if source is not None:
            verify_image(source)
        image_bytes = _call()
        target = run_dir / _normalize_output_name(output_name)
        target.write_bytes(image_bytes)
        logger.info("Processed %s -> %s", output_name, target.name)
        return ImageResult(filename=output_name, success=True)
    except (UnidentifiedImageError, RetryError, OpenAIError, RuntimeError, ValueError) as exc:
        logger.error("Failed to process %s: %s", output_name, exc)
        return ImageResult(filename=output_name, success=False, error=str(exc))


def _normalize_output_name(name: str) -> str:
    """Force the output filename to end with .png since the API returns PNG."""
    base = Path(name)
    if base.suffix.lower() == ".png":
        return base.name
    return f"{base.stem}.png"


def append_error(run_dir: Path, result: ImageResult) -> None:
    """Append a structured error record to errors.jsonl."""
    errors_path = run_dir / "errors.jsonl"
    record = {
        "filename": result.filename,
        "error": result.error or "unknown error",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    with errors_path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record) + "\n")


def run(config: CLIConfig) -> tuple[int, int, Path]:
    """Execute the batch run. Returns (succeeded, failed, run_dir)."""
    config.output_dir.mkdir(parents=True, exist_ok=True)
    run_dir = create_run_dir(config.output_dir)
    logger.info("Run directory: %s", run_dir)

    client = OpenAI(api_key=config.api_key)

    if config.mode == "generate":
        # In generate mode the input dir is used only to decide how many
        # outputs to produce; one per input image, preserving its stem.
        sources = list_input_images(config.input_dir)
        if not sources:
            raise ValueError(
                f"No images found in {config.input_dir}. Supported: {SUPPORTED_EXTENSIONS}"
            )
        jobs: list[tuple[Path | None, str]] = [(None, p.name) for p in sources]
    else:
        sources = list_input_images(config.input_dir)
        if not sources:
            raise ValueError(
                f"No images found in {config.input_dir}. Supported: {SUPPORTED_EXTENSIONS}"
            )
        jobs = [(p, p.name) for p in sources]

    logger.info(
        "Starting run: mode=%s model=%s size=%s images=%d concurrency=%d",
        config.mode,
        config.model,
        config.size,
        len(jobs),
        config.concurrency,
    )

    succeeded = 0
    failed = 0

    def _process(job: tuple[Path | None, str]) -> ImageResult:
        source, name = job
        return process_image(client, config, source, run_dir, name)

    if config.concurrency == 1:
        results_iter: list[ImageResult] = [_process(job) for job in jobs]
    else:
        results_iter = []
        with ThreadPoolExecutor(max_workers=config.concurrency) as pool:
            futures = {pool.submit(_process, job): job for job in jobs}
            for future in as_completed(futures):
                results_iter.append(future.result())

    for result in results_iter:
        if result.success:
            succeeded += 1
        else:
            failed += 1
            append_error(run_dir, result)

    return succeeded, failed, run_dir


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    configure_logging(args.verbose)

    try:
        config = validate_config(args)
    except ValueError as exc:
        logger.error("%s", exc)
        return 2

    try:
        succeeded, failed, run_dir = run(config)
    except ValueError as exc:
        logger.error("%s", exc)
        return 2
    except KeyboardInterrupt:
        logger.warning("Interrupted by user.")
        return 130

    total = succeeded + failed
    print(
        f"Processed {total} images: {succeeded} succeeded, {failed} failed. "
        f"Output saved to {run_dir}."
    )
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
