import { MAX_COVER_BYTES } from "@travel-pocket/shared";

/** Longest side of an uploaded cover: sharp on a 480px-wide card at 3x. */
const MAX_SIDE = 1600;

/** JPEG qualities tried in turn until the image fits in MAX_COVER_BYTES. */
const QUALITIES = [0.82, 0.7, 0.55, 0.4];

/** The size that fits within `max` on its longest side; never enlarged. */
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Turns a picked photo into a JPEG cover the API accepts: scaled down to
 * MAX_SIDE and compressed to at most MAX_COVER_BYTES. Rejects when the
 * browser cannot read the file as an image.
 */
export async function resizeImage(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    // JPEG has no transparency; show it as white rather than black.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    for (const quality of QUALITIES) {
      const blob = await toJpeg(canvas, quality);
      if (blob && blob.size <= MAX_COVER_BYTES) return blob;
    }
    throw new Error("Image is too large");
  } finally {
    bitmap.close();
  }
}
