export type Mode = "generate" | "edit";

export type ImageModel = "gpt-image-2" | "gpt-image-1";

export type ImageSize =
  | "1024x1024"
  | "1024x1536"
  | "1536x1024"
  | "2048x2048";

export type Quality = "low" | "medium" | "high";

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
