export const MAX_CV_BYTES = 3 * 1024 * 1024;
/** Each Firestore document may hold < 1 MiB, so the CV is stored as base64 text split into chunks. */
export const CV_CHUNK_CHARS = 500_000;

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step));
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function splitChunks(text: string, size = CV_CHUNK_CHARS): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size));
  return parts.length ? parts : [""];
}

export type CvValidationError = "not_pdf" | "too_large" | "empty" | "bad_signature" | "bad_name";

export interface CvMeta {
  name: string;
  type: string;
  size: number;
}

export function validateCvMeta(meta: CvMeta): CvValidationError[] {
  const errors: CvValidationError[] = [];
  if (!meta.size) errors.push("empty");
  if (meta.size > MAX_CV_BYTES) errors.push("too_large");
  if (meta.type !== "application/pdf" || !/\.pdf$/i.test(meta.name)) errors.push("not_pdf");
  if (/[\\/\u0000-\u001f]/.test(meta.name) || meta.name.length > 200) errors.push("bad_name");
  return errors;
}

/** Real PDFs start with "%PDF-". Guards against renamed non-PDF files. */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return sig.every((b, i) => bytes[i] === b);
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "cv.pdf";
  const cleaned = base.replace(/[^\p{L}\p{N}._\- ()]+/gu, "_").slice(0, 120);
  return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned || "cv"}.pdf`;
}
