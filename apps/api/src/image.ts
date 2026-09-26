import type { COVER_CONTENT_TYPES } from "@travel-pocket/shared";

type CoverContentType = (typeof COVER_CONTENT_TYPES)[number];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));

/**
 * The image format of `bytes`, judged by their signature rather than by what
 * the client claims, or null for anything else (SVG included: served from the
 * app's own origin, it could run scripts).
 */
export function detectImageType(bytes: Uint8Array): CoverContentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
  return null;
}
