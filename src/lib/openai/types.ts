export type Mode = "generate" | "edit" | "variation";

export type ImageModel = "gpt-image-1" | "dall-e-3" | "dall-e-2";

export type ImageSize =
  | "1024x1024"
  | "1024x1536"
  | "1536x1024"
  | "1792x1024"
  | "1024x1792"
  | "512x512"
  | "256x256";

export type Quality = "low" | "medium" | "high" | "standard" | "hd";

export interface ImageResult {
  b64: string;
  model_used: ImageModel;
  cost_estimate: number;
}

export interface RunEntry {
  run_id: string;
  created_at: number;
  items: Array<{
    filename: string;
    b64?: string;
    error?: string;
  }>;
}
