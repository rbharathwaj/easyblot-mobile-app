/**
 * Profile picture pipeline.
 *
 * Two stages, kept separate so the crop editor can preview and export from
 * the same source image without re-reading the file:
 *   readImageFile()      decode any format the browser can handle
 *   renderCroppedAvatar() rasterise the chosen crop to a square data URL
 *
 * Output is always downscaled and re-encoded — a 6 MB phone photo lands at
 * roughly 15–25 KB. That matters because localStorage is a ~5 MB budget
 * shared by every account, protocol, and forum post in this browser, and it
 * is the right shape against a real backend too: never upload megabytes to
 * serve a 36 px circle.
 */

export const AVATAR_PX = 256;
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const QUALITY = 0.82;
const MAX_STORED_CHARS = 400_000;

/**
 * Formats offered in the file picker. `image/*` covers everything the browser
 * can decode; the explicit extensions are there because some pickers (notably
 * Windows and a few Android vendors) show nothing useful for a bare wildcard.
 * HEIC/HEIF are listed so iPhone photos are selectable — Safari decodes them,
 * and other browsers get a clear error rather than a silent failure.
 */
export const ACCEPTED_IMAGE_TYPES = [
  'image/*',
  '.jpg', '.jpeg', '.jfif', '.pjpeg',
  '.png', '.apng',
  '.gif',
  '.webp',
  '.avif',
  '.bmp',
  '.tif', '.tiff',
  '.svg',
  '.heic', '.heif',
  '.ico',
].join(',');

export class AvatarError extends Error {}

export interface LoadedImage {
  el: HTMLImageElement;
  width: number;
  height: number;
  /** Call when the editor closes to release the object URL. */
  release(): void;
}

export async function readImageFile(file: File): Promise<LoadedImage> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new AvatarError('That file is over 25 MB. Pick a smaller image.');
  }
  const looksLikeImage = file.type.startsWith('image/')
    || /\.(jpe?g|jfif|png|apng|gif|webp|avif|bmp|tiff?|svg|hei[cf]|ico)$/i.test(file.name);
  if (!looksLikeImage) {
    throw new AvatarError('That does not look like an image file.');
  }

  const url = URL.createObjectURL(file);
  try {
    const el = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(
        // Almost always HEIC outside Safari, or a corrupt file.
        new AvatarError(
          /\.hei[cf]$/i.test(file.name)
            ? 'This browser cannot open HEIC images. Export it as JPEG first, or use Safari.'
            : 'That image could not be decoded. Try a different file.',
        ),
      );
      img.src = url;
    });

    // SVGs and some exotic files report no intrinsic size.
    const width = el.naturalWidth || el.width;
    const height = el.naturalHeight || el.height;
    if (!width || !height) {
      throw new AvatarError('That image has no usable dimensions. Try a JPEG or PNG.');
    }

    return { el, width, height, release: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

export interface CropParams {
  /** Side length of the on-screen crop box, in CSS pixels. */
  box: number;
  /** Multiplier on top of the cover-fit scale. 1 = fully zoomed out. */
  zoom: number;
  /** Pan offset from centre, in crop-box pixels. */
  offsetX: number;
  offsetY: number;
}

/** Scale at which the image exactly covers the crop box. */
export function coverScale(img: { width: number; height: number }, box: number): number {
  return Math.max(box / img.width, box / img.height);
}

/**
 * How far the image may be panned before a gap would show at an edge.
 * Symmetric about centre, so one number per axis is enough.
 */
export function panLimits(img: { width: number; height: number }, p: CropParams) {
  const s = coverScale(img, p.box) * p.zoom;
  return {
    x: Math.max(0, (img.width * s - p.box) / 2),
    y: Math.max(0, (img.height * s - p.box) / 2),
  };
}

export function clampOffsets(img: { width: number; height: number }, p: CropParams) {
  const lim = panLimits(img, p);
  return {
    offsetX: Math.min(lim.x, Math.max(-lim.x, p.offsetX)),
    offsetY: Math.min(lim.y, Math.max(-lim.y, p.offsetY)),
  };
}

/**
 * Which part of the source image the crop box is showing.
 *
 * Undo the display scale, then undo the pan. Working in source coordinates
 * keeps full resolution — we never sample an already-downscaled preview.
 * Pure and exported so the geometry can be tested without a canvas.
 */
export function cropSourceRect(img: { width: number; height: number }, p: CropParams) {
  const s = coverScale(img, p.box) * p.zoom;
  const side = p.box / s;                       // source-pixel side of the crop
  return {
    sx: img.width / 2 - side / 2 - p.offsetX / s,
    sy: img.height / 2 - side / 2 - p.offsetY / s,
    side,
  };
}

/** Rasterise the visible crop to a square data URL. */
export function renderCroppedAvatar(img: LoadedImage, p: CropParams): string {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_PX;
  canvas.height = AVATAR_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AvatarError('Your browser could not process that image.');

  const { sx, sy, side } = cropSourceRect(img, p);

  ctx.imageSmoothingQuality = 'high';
  // Flatten onto white: transparent PNGs would otherwise go black in JPEG.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, AVATAR_PX, AVATAR_PX);
  ctx.drawImage(
    img.el,
    Math.max(0, sx), Math.max(0, sy),
    Math.min(side, img.width), Math.min(side, img.height),
    0, 0, AVATAR_PX, AVATAR_PX,
  );

  let out = canvas.toDataURL('image/webp', QUALITY);
  if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', QUALITY);
  if (out.length > MAX_STORED_CHARS) {
    out = canvas.toDataURL('image/jpeg', 0.7);
  }
  if (out.length > MAX_STORED_CHARS) {
    throw new AvatarError('That image could not be compressed enough. Try a simpler picture.');
  }
  return out;
}
