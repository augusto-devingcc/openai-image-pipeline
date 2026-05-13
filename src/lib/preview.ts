import sharp from "sharp";

export async function makeThumbnailDataUrl(b64: string): Promise<string> {
  const buf = Buffer.from(b64, "base64");
  const thumb = await sharp(buf)
    .resize(192, 192, { fit: "inside" })
    .jpeg({ quality: 70 })
    .toBuffer();
  return `data:image/jpeg;base64,${thumb.toString("base64")}`;
}
