import type { InlineDataPart } from "./types";

// Fetch an image and return as Gemini inlineData part (validated).
export async function fetchImageAsInlineData(url: string): Promise<InlineDataPart> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const mimeType = contentType.startsWith("image/") ? contentType.split(";")[0] : "image/jpeg";

  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  if (!base64 || base64.length <= 10_000) {
    throw new Error("Image base64 too small or empty");
  }

  return {
    inlineData: {
      mimeType,
      data: base64,
    },
  };
}

