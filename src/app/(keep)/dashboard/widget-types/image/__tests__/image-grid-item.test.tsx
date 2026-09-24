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
  mockUseDashboardImage.mockReturnValue({ url: undefined, error: undefined, isLoading: false });
});

const upload: ImageWidgetConfig = { source: "upload", imageId: "img-1", fit: "cover" };
const byUrl: ImageWidgetConfig = { source: "url", url: "https://x.io/a.png", fit: "contain" };

describe("DashboardImageView", () => {
  it("renders an uploaded image from its blob URL with the chosen fit", () => {
    mockUseDashboardImage.mockReturnValue({ url: "blob:abc", error: undefined, isLoading: false });
    render(<DashboardImageView image={upload} alt="Topology" />);
    const img = screen.getByRole("img", { name: "Topology" });
    expect(img).toHaveAttribute("src", "blob:abc");
    expect(img).toHaveStyle({ objectFit: "cover" });
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
