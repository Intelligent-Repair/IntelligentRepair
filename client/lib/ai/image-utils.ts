import type { InlineDataPart } from "./types";

// Maximum image size: 5MB (before base64 encoding)
// ChatGPT API limit is 20MB, but we want to be conservative
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

<<<<<<< HEAD
// Minimum image size: 5KB (to avoid empty or corrupted images)
// Reduced from 10KB to allow smaller valid images
const MIN_IMAGE_SIZE = 5 * 1024; // 5KB
=======
// Minimum image size: 1KB (to avoid empty or corrupted images)
// Very small images (like icons or compressed PNGs) can be valid
const MIN_IMAGE_SIZE = 1 * 1024; // 1KB
>>>>>>> rescue/ui-stable

// Fetch an image and return as OpenAI inlineData part (validated).
export async function fetchImageAsInlineData(url: string): Promise<InlineDataPart> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  let mimeType = contentType.startsWith("image/") ? contentType.split(";")[0] : "";
  
  // Fallback: detect from URL extension if content-type is missing
  if (!mimeType) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes(".png")) {
      mimeType = "image/png";
    } else if (urlLower.includes(".webp")) {
      mimeType = "image/webp";
    } else if (urlLower.includes(".gif")) {
      mimeType = "image/gif";
    } else {
      mimeType = "image/jpeg"; // Default fallback
    }
  } else {
    // Normalize common image types
    if (mimeType === "image/jpg") {
      mimeType = "image/jpeg";
    }
  }

  const arrayBuffer = await res.arrayBuffer();
  
  // Check image size before processing
  if (arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB (max: ${MAX_IMAGE_SIZE / 1024 / 1024}MB)`);
  }
  
  if (arrayBuffer.byteLength < MIN_IMAGE_SIZE) {
    throw new Error(`Image too small: ${arrayBuffer.byteLength} bytes (min: ${MIN_IMAGE_SIZE} bytes)`);
  }

  const base64 = Buffer.from(arrayBuffer).toString("base64");

  // Check if base64 is too small (less than 1KB after encoding suggests corrupted/empty image)
  if (!base64 || base64.length < 1000) {
    throw new Error("Image base64 too small or empty");
  }

  // Check base64 size (after encoding, base64 is ~33% larger)
  // OpenAI has a limit of 20MB for images, but we want to be conservative
  const base64SizeMB = base64.length / 1024 / 1024;
  if (base64SizeMB > 15) {
    console.warn(`[Image Utils] Large image detected: ${base64SizeMB.toFixed(2)}MB (base64). This may cause issues.`);
  }

  return {
    inlineData: {
      mimeType,
      data: base64,
    },
  };
}

