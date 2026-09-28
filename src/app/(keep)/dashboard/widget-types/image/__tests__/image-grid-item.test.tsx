import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ImageWidgetConfig } from "../../../types";
import { DashboardImageView } from "../image-grid-item";

const mockUseDashboardImage = jest.fn();
jest.mock("@/entities/dashboard-images/model/useDashboardImages", () => ({
  useDashboardImage: (id?: string) => mockUseDashboardImage(id),
}));

beforeEach(() => {
  mockUseDashboardImage.mockReset();
  mockUseDashboardImage.mockReturnValue({
    url: undefined,
    error: undefined,
    isLoading: false,
    contentType: undefined,
  });
});

const upload: ImageWidgetConfig = { source: "upload", imageId: "img-1", fit: "cover" };
const byUrl: ImageWidgetConfig = { source: "url", url: "https://x.io/a.png", fit: "contain" };

describe("DashboardImageView", () => {
  it("renders an uploaded image from its data URL", () => {
    mockUseDashboardImage.mockReturnValue({
      url: "data:image/png;base64,abc",
      error: undefined,
      isLoading: false,
      contentType: "image/png",
    });
    render(<DashboardImageView image={upload} alt="Topology" />);
    const img = screen.getByRole("img", { name: "Topology" });
    expect(img).toHaveAttribute("src", "data:image/png;base64,abc");
    expect(mockUseDashboardImage).toHaveBeenCalledWith("img-1");
  });

  it("does not fetch for URL images", () => {
    render(<DashboardImageView image={byUrl} alt="Logo" />);
    expect(screen.getByRole("img", { name: "Logo" })).toHaveAttribute("src", "https://x.io/a.png");
    expect(mockUseDashboardImage).toHaveBeenCalledWith(undefined);
  });

  it("shows the placeholder when the upload fetch fails", () => {
    mockUseDashboardImage.mockReturnValue({ url: undefined, error: new Error("404"), isLoading: false });
    render(<DashboardImageView image={upload} alt="Topology" />);
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
  });

  it("shows the skeleton while an upload has no url yet and no error", () => {
    const { container } = render(<DashboardImageView image={upload} alt="Topology" />);
    expect(container.querySelector(".react-loading-skeleton")).not.toBeNull();
    expect(screen.queryByText("Image unavailable")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows the placeholder for an upload without an image id", () => {
    const { container } = render(
      <DashboardImageView image={{ ...upload, imageId: undefined }} alt="Topology" />
    );
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
    expect(container.querySelector(".react-loading-skeleton")).toBeNull();
  });

  it("shows the placeholder when a URL image fails to load", () => {
    render(<DashboardImageView image={byUrl} alt="Logo" />);
    fireEvent.error(screen.getByRole("img", { name: "Logo" }));
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
  });

  it("never renders a non-http URL", () => {
    render(<DashboardImageView image={{ ...byUrl, url: "javascript:alert(1)" }} alt="Bad" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
  });

  it("wraps the image in a safe new-tab link when a link is set", () => {
    render(<DashboardImageView image={{ ...byUrl, link: "https://wiki/runbook" }} alt="Logo" />);
    const anchor = screen.getByRole("link");
    expect(anchor).toHaveAttribute("href", "https://wiki/runbook");
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(anchor).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("drops a non-http link", () => {
    render(<DashboardImageView image={{ ...byUrl, link: "javascript:alert(1)" }} alt="Logo" />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("DashboardImageView fit and sizing", () => {
  function renderUpload(fit: "contain" | "cover", contentType: string) {
    mockUseDashboardImage.mockReturnValue({
      url: "data:x",
      error: undefined,
      isLoading: false,
      contentType,
    });
    render(<DashboardImageView image={{ source: "upload", imageId: "img-1", fit }} alt="I" />);
    return screen.getByRole("img", { name: "I" });
  }

  it("caps a raster image at its natural size under contain (no upscale)", () => {
    const img = renderUpload("contain", "image/png");
    expect(img).toHaveClass("max-h-full", "max-w-full", "object-contain");
    expect(img).not.toHaveClass("h-full");
    expect(img).not.toHaveClass("w-full");
  });

  it("centers the contained image within the panel", () => {
    const img = renderUpload("contain", "image/png");
    const wrapper = img.parentElement as HTMLElement;
    expect(wrapper).toHaveClass("flex", "items-center", "justify-center");
  });

  it("lets a vector (SVG) image fill the panel under contain", () => {
    const img = renderUpload("contain", "image/svg+xml");
    expect(img).toHaveClass("h-full", "w-full", "object-contain");
    expect(img).not.toHaveClass("max-w-full");
  });

  it("fills and crops under cover", () => {
    const img = renderUpload("cover", "image/png");
    expect(img).toHaveClass("h-full", "w-full", "object-cover");
    expect(img).not.toHaveClass("max-w-full");
  });

  it("treats a .svg URL as vector (fills under contain)", () => {
    render(
      <DashboardImageView image={{ source: "url", url: "https://x.io/d.svg", fit: "contain" }} alt="D" />
    );
    const img = screen.getByRole("img", { name: "D" });
    expect(img).toHaveClass("h-full", "w-full", "object-contain");
  });

  it("caps a non-svg URL image (raster) under contain", () => {
    render(
      <DashboardImageView image={{ source: "url", url: "https://x.io/a.png", fit: "contain" }} alt="A" />
    );
    const img = screen.getByRole("img", { name: "A" });
    expect(img).toHaveClass("max-h-full", "max-w-full", "object-contain");
  });

  it("treats a raster URL with .svg only in the query as raster", () => {
    render(
      <DashboardImageView
        image={{ source: "url", url: "https://x.io/pic.png?ref=logo.svg", fit: "contain" }}
        alt="Q"
      />
    );
    const img = screen.getByRole("img", { name: "Q" });
    expect(img).toHaveClass("max-h-full", "max-w-full", "object-contain");
  });

  it("still crops an SVG under cover", () => {
    const img = renderUpload("cover", "image/svg+xml");
    expect(img).toHaveClass("h-full", "w-full", "object-cover");
  });

  it("falls back to raster capping when the content type is unknown", () => {
    const img = renderUpload("contain", "");
    expect(img).toHaveClass("max-h-full", "max-w-full", "object-contain");
  });
});
