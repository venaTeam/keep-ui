import { useEffect, useState } from "react";
import useSWRImmutable from "swr/immutable";
import { ApiClient } from "@/shared/api";
import { useApi } from "@/shared/lib/hooks/useApi";

export interface DashboardImageUpload {
  id: string;
  name: string;
  content_type: string;
  size_bytes: number;
}

/** Uploads the file as the raw request body; the gateway keeps it pending until a dashboard save claims it. */
export function uploadDashboardImage(
  api: ApiClient,
  file: File
): Promise<DashboardImageUpload> {
  return api.request<DashboardImageUpload>(
    `/dashboard-images?name=${encodeURIComponent(file.name)}`,
    {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type },
    }
  );
}

/** Fetches image bytes with the session's auth headers; rejects on any non-2xx. */
export async function fetchDashboardImageBlob(
  api: ApiClient,
  imageId: string
): Promise<Blob> {
  const response = await fetch(
    `${api.getApiBaseUrl()}/dashboard-images/${encodeURIComponent(imageId)}`,
    { headers: api.getHeaders() as HeadersInit }
  );
  if (!response.ok) {
    throw new Error(`Image request failed with ${response.status}`);
  }
  return response.blob();
}

/** Reads a Blob into a base64 data: URL. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

type Converted = { blob: Blob; url?: string; error?: Error };

/**
 * data: URL for an uploaded image. A data: URL, unlike a same-origin blob: URL,
 * is an opaque origin, so an SVG opened from it cannot script the Keep UI.
 * `isLoading` stays true until the fetched bytes have been converted.
 */
export function useDashboardImage(imageId?: string) {
  const api = useApi();
  const {
    data: blob,
    error: fetchError,
    isLoading: isFetching,
  } = useSWRImmutable(
    api.isReady() && imageId ? ["dashboard-image", imageId] : null,
    () => fetchDashboardImageBlob(api, imageId as string)
  );
  const [converted, setConverted] = useState<Converted>();

  useEffect(() => {
    if (!blob) {
      return;
    }
    let cancelled = false;
    blobToDataUrl(blob).then(
      (url) => !cancelled && setConverted({ blob, url }),
      (error) => !cancelled && setConverted({ blob, error })
    );
    return () => {
      cancelled = true;
    };
  }, [blob]);

  const current = blob && converted?.blob === blob ? converted : undefined;
  const url = current?.url;
  const error = fetchError ?? current?.error;
  const isLoading = isFetching || (!!blob && !current);

  return { url, error, isLoading };
}
