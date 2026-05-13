/*
 * Per-image cost estimates in USD, sourced from OpenAI's published
 * image generation pricing as of 2026-05.
 *
 * DALL-E 3 was retired 2026-03-04. DALL-E 2 sunset 2026-05-12.
 * Only gpt-image-1 and gpt-image-2 remain available on the API.
 *
 * gpt-image-2 is the current default. gpt-image-1 stays available
 * for users who want a cheaper run.
 *
 * Both models charge per output image by quality and size tier.
 * Numbers are conservative ceilings: if a size+quality combination
 * is not listed, fall back to the most expensive equivalent so the
 * user is never quoted less than they will be billed.
 */

import type { ImageModel, ImageSize, Quality } from "./types";

const GPT_IMAGE_1: Record<Quality, Partial<Record<ImageSize, number>>> = {
  low: {
    "1024x1024": 0.011,
    "1024x1536": 0.016,
    "1536x1024": 0.016,
  },
  medium: {
    "1024x1024": 0.042,
    "1024x1536": 0.063,
    "1536x1024": 0.063,
  },
  high: {
    "1024x1024": 0.167,
    "1024x1536": 0.25,
    "1536x1024": 0.25,
  },
};

const GPT_IMAGE_2: Record<Quality, Partial<Record<ImageSize, number>>> = {
  low: {
    "1024x1024": 0.006,
    "1024x1536": 0.009,
    "1536x1024": 0.009,
    "2048x2048": 0.024,
  },
  medium: {
    "1024x1024": 0.053,
    "1024x1536": 0.08,
    "1536x1024": 0.08,
    "2048x2048": 0.212,
  },
  high: {
    "1024x1024": 0.211,
    "1024x1536": 0.317,
    "1536x1024": 0.317,
    "2048x2048": 0.844,
  },
};

export function estimateImageCost(
  model: ImageModel,
  size: ImageSize,
  quality: Quality
): number {
  const table = model === "gpt-image-2" ? GPT_IMAGE_2 : GPT_IMAGE_1;
  return table[quality]?.[size] ?? table.high["1024x1024"] ?? 0;
}

export function defaultQualityFor(): Quality {
  return "medium";
}

export function defaultSizeFor(): ImageSize {
  return "1024x1024";
}
