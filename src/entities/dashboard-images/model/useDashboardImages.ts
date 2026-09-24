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

/** Object URL for an uploaded image; the URL is revoked when the caller unmounts or the image changes. */
export function useDashboardImage(imageId?: string) {
  const api = useApi();
  const { data: blob, error, isLoading } = useSWRImmutable(
    api.isReady() && imageId ? ["dashboard-image", imageId] : null,
    () => fetchDashboardImageBlob(api, imageId as string)
  );
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return { url, error, isLoading };
}
