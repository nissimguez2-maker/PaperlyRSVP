/**
 * Client-side image auto-optimization (runs in the browser before upload).
 *
 * Photos from phones/cameras are often 4000px+ and several MB — far larger than
 * any screen needs. We downscale to a generous max edge and re-encode as WebP
 * at high quality, so images stay crisp ("HD") but load fast on mobile. Small
 * images, SVGs and GIFs are passed through untouched.
 */
const MAX_EDGE = 2560;        // longest side we keep (plenty for retina)
const PASS_THROUGH_BYTES = 1_200_000; // already-small JP/PNG/WebP skip re-encoding
const QUALITY = 0.9;

export interface Optimized {
  blob: Blob;
  /** Suggested filename (extension may change to .webp). */
  name: string;
}

export async function optimizeImage(file: File): Promise<Optimized> {
  const name = file.name || "image";
  // Don't touch vector / animated / tiny files.
  if (file.type === "image/svg+xml" || file.type === "image/gif" || !file.type.startsWith("image/")) {
    return { blob: file, name };
  }
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    return { blob: file, name };
  }
  const big = Math.max(bmp.width, bmp.height) > MAX_EDGE;
  if (!big && file.size < PASS_THROUGH_BYTES) {
    bmp.close?.();
    return { blob: file, name };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bmp.close?.(); return { blob: file, name }; }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", QUALITY));
  if (!blob || blob.size >= file.size) return { blob: file, name }; // keep original if not smaller
  return { blob, name: name.replace(/\.[^.]+$/, "") + ".webp" };
}
