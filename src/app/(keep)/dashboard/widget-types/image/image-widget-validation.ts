import { KeepApiError } from "@/shared/api";
import { WidgetData, WidgetType } from "../../types";

export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

export const IMAGE_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,.svg";

export const DEFAULT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** True only for absolute http(s) URLs, so javascript: and data: never reach an href or src. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Client-side pre-check mirroring the gateway; returns an error message or null. */
export function validateImageFile(
  file: File,
  maxBytes: number = DEFAULT_MAX_IMAGE_BYTES
): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Unsupported image type (PNG, JPEG, GIF, WEBP, SVG)";
  }
  if (file.size === 0) {
    return "Image is empty";
  }
  if (file.size > maxBytes) {
    return `Image is larger than ${Math.round(maxBytes / (1024 * 1024))} MB`;
  }
  return null;
}

/** Turns the gateway's 400 for unavailable dashboard images into a message naming the widgets. */
export function describeInvalidImageError(
  error: unknown,
  widgets: WidgetData[]
): string | null {
  if (!(error instanceof KeepApiError) || error.statusCode !== 400) {
    return null;
  }
  const ids = error.responseJson?.invalid_image_ids;
  if (!Array.isArray(ids)) {
    return null;
  }
  const names = widgets
    .filter(
      (w) =>
        w.widgetType === WidgetType.IMAGE &&
        w.image?.imageId !== undefined &&
        ids.includes(w.image.imageId)
    )
    .map((w) => w.name);
  return names.length
    ? `Image missing for widget(s): ${names.join(", ")}. Re-upload it and save again.`
    : "Some image widgets have no available image. Re-upload and save again.";
}
