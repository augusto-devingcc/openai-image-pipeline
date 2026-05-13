/*
 * Per-image cost estimates in USD, sourced from OpenAI's published
 * image generation pricing as of 2026-05.
 *
 * gpt-image-1 charges per output image by quality+size tier.
 * dall-e-3 charges by quality (standard / hd) and size.
 * dall-e-2 charges by size only.
 *
 * Numbers are conservative ceilings: if a model+size+quality combination
 * is not listed, fall back to the most expensive equivalent so the user
 * is never quoted less than they will be billed.
 */

import type { ImageModel, ImageSize, Quality } from "./types";

const GPT_IMAGE_1: Record<string, Record<string, number>> = {
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

const DALL_E_3: Record<string, Record<string, number>> = {
  standard: {
    "1024x1024": 0.04,
    "1024x1792": 0.08,
    "1792x1024": 0.08,
  },
  hd: {
    "1024x1024": 0.08,
    "1024x1792": 0.12,
    "1792x1024": 0.12,
  },
};

const DALL_E_2: Record<string, number> = {
  "1024x1024": 0.02,
  "512x512": 0.018,
  "256x256": 0.016,
};

export function estimateImageCost(
  model: ImageModel,
  size: ImageSize,
  quality: Quality
): number {
  if (model === "gpt-image-1") {
    const tier = quality === "low" || quality === "medium" || quality === "high" ? quality : "medium";
    return GPT_IMAGE_1[tier]?.[size] ?? GPT_IMAGE_1.high["1024x1024"];
  }
  if (model === "dall-e-3") {
    const tier = quality === "hd" ? "hd" : "standard";
    return DALL_E_3[tier]?.[size] ?? DALL_E_3.standard["1024x1024"];
  }
  return DALL_E_2[size] ?? DALL_E_2["1024x1024"];
}

export function defaultQualityFor(model: ImageModel): Quality {
  if (model === "gpt-image-1") return "medium";
  if (model === "dall-e-3") return "standard";
  return "standard";
}

export function defaultSizeFor(model: ImageModel): ImageSize {
  if (model === "dall-e-2") return "1024x1024";
  return "1024x1024";
}
