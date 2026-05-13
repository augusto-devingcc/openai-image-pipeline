import type OpenAI from "openai";
import type { ImagesResponse } from "openai/resources/images";
import type { ImageModel, ImageResult, ImageSize, Quality } from "./types";
import { estimateImageCost } from "./pricing";

export async function generateImage(
  client: OpenAI,
  args: {
    prompt: string;
    model: ImageModel;
    size: ImageSize;
    quality: Quality;
  }
): Promise<ImageResult> {
  const { prompt, model, size, quality } = args;

  const params: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size,
    quality,
  };

  const res = (await client.images.generate(
    params as unknown as Parameters<typeof client.images.generate>[0]
  )) as ImagesResponse;

  const b64 = res.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI returned no image data");
  }

  return {
    b64,
    model_used: model,
    cost_estimate: estimateImageCost(model, size, quality),
  };
}
