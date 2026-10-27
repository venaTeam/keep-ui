import { KeepApiError } from "@/shared/api";
import { WidgetData, WidgetType } from "../../../types";
import {
  DEFAULT_MAX_IMAGE_BYTES,
  describeInvalidImageError,
  isHttpUrl,
  validateImageFile,
} from "../image-widget-validation";

function file(type: string, size: number, name = "a.png") {
  return new File([new Uint8Array(size)], name, { type });
}

describe("isHttpUrl", () => {
  it.each(["https://x.io/a.png", "http://intranet/diagram.svg"])(
    "accepts %s",
    (value) => expect(isHttpUrl(value)).toBe(true)
  );
  it.each(["javascript:alert(1)", "data:image/png;base64,AAA", "ftp://x/a", "not a url", ""])(
    "rejects %s",
    (value) => expect(isHttpUrl(value)).toBe(false)
  );
});

describe("validateImageFile", () => {
  it("accepts each allowed type", () => {
    for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"]) {
      expect(validateImageFile(file(type, 10))).toBeNull();
    }
  });
  it("rejects unsupported types", () => {
    expect(validateImageFile(file("image/bmp", 10))).toMatch(/Unsupported/);
  });
  it("rejects empty files", () => {
    expect(validateImageFile(file("image/png", 0))).toMatch(/empty/);
  });
  it("rejects files over the cap", () => {
    expect(validateImageFile(file("image/png", DEFAULT_MAX_IMAGE_BYTES + 1))).toMatch(/5 MB/);
  });
});

describe("describeInvalidImageError", () => {
  const widgets = [
    { i: "1", name: "Topology", widgetType: WidgetType.IMAGE, image: { source: "upload", imageId: "img-1", fit: "contain" } },
    { i: "2", name: "Logo", widgetType: WidgetType.IMAGE, image: { source: "upload", imageId: "img-2", fit: "contain" } },
  ] as unknown as WidgetData[];

  it("names the widgets whose images were rejected", () => {
    const error = new KeepApiError("x", "/dashboard", "", { invalid_image_ids: ["img-2"] }, 400);
    expect(describeInvalidImageError(error, widgets)).toBe(
      "Image missing for widget(s): Logo. Re-upload it and save again."
    );
  });
  it("falls back to a generic message when no widget matches", () => {
    const error = new KeepApiError("x", "/dashboard", "", { invalid_image_ids: [] }, 400);
    expect(describeInvalidImageError(error, widgets)).toBe(
      "Some image widgets have no available image. Re-upload and save again."
    );
  });
  it("ignores other errors", () => {
    expect(describeInvalidImageError(new Error("boom"), widgets)).toBeNull();
    const other = new KeepApiError("x", "/dashboard", "", { detail: "no" }, 400);
    expect(describeInvalidImageError(other, widgets)).toBeNull();
  });
});
