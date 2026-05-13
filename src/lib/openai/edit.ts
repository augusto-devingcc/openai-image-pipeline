import { toFile } from "openai";
import type OpenAI from "openai";
import type { ImagesResponse } from "openai/resources/images";
import type { ImageModel, ImageResult, ImageSize, Quality } from "./types";
import { estimateImageCost } from "./pricing";

export async function editImage(
  client: OpenAI,
  args: {
    image: Buffer;
    filename: string;
    mimeType: string;
    prompt: string;
    model: Extract<ImageModel, "gpt-image-1" | "dall-e-2">;
    size: ImageSize;
    quality: Quality;
  }
): Promise<ImageResult> {
  const { image, filename, mimeType, prompt, model, size, quality } = args;

  const file = await toFile(image, filename, { type: mimeType });

  const params: Record<string, unknown> = {
    model,
    image: file,
    prompt,
    n: 1,
    size,
  };

  if (model === "gpt-image-1") {
    params.quality = quality;
  } else {
    params.response_format = "b64_json";
  }

  const res = (await client.images.edit(
    params as unknown as Parameters<typeof client.images.edit>[0]
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
