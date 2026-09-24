import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WidgetData, WidgetType } from "../../../types";
import { ImageWidgetForm } from "../image-widget-form";

const mockUpload = jest.fn();
jest.mock("@/entities/dashboard-images/model/useDashboardImages", () => ({
  uploadDashboardImage: (...args: unknown[]) => mockUpload(...args),
  useDashboardImage: () => ({ url: undefined, error: undefined, isLoading: false }),
}));
jest.mock("@/shared/lib/hooks/useApi", () => ({ useApi: () => ({}) }));

function lastCall(onChange: jest.Mock) {
  return onChange.mock.calls[onChange.mock.calls.length - 1];
}

function pick(fileToPick: File) {
  fireEvent.change(screen.getByLabelText("Image file"), {
    target: { files: [fileToPick] },
  });
}

const png = new File([new Uint8Array(10)], "a.png", { type: "image/png" });

beforeEach(() => mockUpload.mockReset());

describe("ImageWidgetForm", () => {
  it("is invalid until an upload completes", async () => {
    let resolve: (v: unknown) => void = () => {};
    mockUpload.mockReturnValue(new Promise((r) => (resolve = r)));
    const onChange = jest.fn();
    render(<ImageWidgetForm onChange={onChange} />);
    expect(lastCall(onChange)[1]).toBe(false);

    pick(png);
    await waitFor(() => expect(screen.getByText("Uploading…")).toBeInTheDocument());
    expect(lastCall(onChange)[1]).toBe(false);

    await act(async () => resolve({ id: "img-1", name: "a.png", content_type: "image/png", size_bytes: 10 }));
    await waitFor(() => expect(lastCall(onChange)[1]).toBe(true));
    expect(lastCall(onChange)[0]).toMatchObject({
      w: 4,
      h: 4,
      image: { source: "upload", imageId: "img-1", fit: "contain" },
    });
  });

  it("rejects an invalid file without uploading", () => {
    const onChange = jest.fn();
    render(<ImageWidgetForm onChange={onChange} />);
    pick(new File([new Uint8Array(10)], "a.bmp", { type: "image/bmp" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Unsupported image type");
    expect(mockUpload).not.toHaveBeenCalled();
    expect(lastCall(onChange)[1]).toBe(false);
  });

  it("shows the server error with a retry that re-uploads", async () => {
    mockUpload.mockRejectedValueOnce(new Error("Too many unsaved images"));
    mockUpload.mockResolvedValueOnce({ id: "img-2", name: "a.png", content_type: "image/png", size_bytes: 10 });
    const onChange = jest.fn();
    render(<ImageWidgetForm onChange={onChange} />);
    pick(png);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Too many unsaved images"));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(lastCall(onChange)[1]).toBe(true));
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });

  it("keeps an existing upload valid when editing, without layout fields", () => {
    const editingItem = {
      i: "w-1",
      name: "Topology",
      widgetType: WidgetType.IMAGE,
      image: { source: "upload", imageId: "img-9", fit: "cover" },
    } as unknown as WidgetData;
    const onChange = jest.fn();
    render(<ImageWidgetForm editingItem={editingItem} onChange={onChange} />);
    const [value, isValid] = lastCall(onChange);
    expect(isValid).toBe(true);
    expect(value).toEqual({ image: { source: "upload", imageId: "img-9", fit: "cover" } });
  });

  it("invalidates a non-http link", () => {
    const editingItem = {
      i: "w-1",
      name: "Logo",
      widgetType: WidgetType.IMAGE,
      image: { source: "url", url: "https://x.io/a.png", fit: "contain", link: "javascript:alert(1)" },
    } as unknown as WidgetData;
    const onChange = jest.fn();
    render(<ImageWidgetForm editingItem={editingItem} onChange={onChange} />);
    expect(lastCall(onChange)[1]).toBe(false);
  });
});
