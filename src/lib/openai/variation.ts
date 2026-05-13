import { toFile } from "openai";
import type OpenAI from "openai";
import type { ImageResult, ImageSize } from "./types";
import { estimateImageCost } from "./pricing";

/*
 * The variations endpoint is only available on dall-e-2.
 */
export async function variationImage(
  client: OpenAI,
  args: {
    image: Buffer;
    filename: string;
    mimeType: string;
    size: ImageSize;
  }
): Promise<ImageResult> {
  const { image, filename, mimeType, size } = args;

  const file = await toFile(image, filename, { type: mimeType });

  const res = await client.images.createVariation({
    model: "dall-e-2",
    image: file,
    n: 1,
    size: size as "256x256" | "512x512" | "1024x1024",
    response_format: "b64_json",
  });

  const b64 = res.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("OpenAI returned no image data");
  }

  return {
    b64,
    model_used: "dall-e-2",
    cost_estimate: estimateImageCost("dall-e-2", size, "standard"),
  };
}
