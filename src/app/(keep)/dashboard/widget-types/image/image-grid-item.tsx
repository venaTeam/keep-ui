import React, { useEffect, useState } from "react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { useDashboardImage } from "@/entities/dashboard-images/model/useDashboardImages";
import { ImageWidgetConfig, WidgetData } from "../../types";
import { isHttpUrl } from "./image-widget-validation";

/**
 * Renders an image widget's picture, or an in-card placeholder when it cannot be shown.
 */
export function DashboardImageView({
  image,
  alt,
}: {
  image: ImageWidgetConfig;
  alt: string;
}) {
  const isUpload = image.source === "upload";
  const { url: blobUrl, error, isLoading } = useDashboardImage(
    isUpload ? image.imageId : undefined
  );
  const [broken, setBroken] = useState(false);
  const src = isUpload
    ? blobUrl
    : image.url && isHttpUrl(image.url)
      ? image.url
      : undefined;

  useEffect(() => setBroken(false), [src]);

  if (isUpload && isLoading) {
    return <Skeleton containerClassName="block h-full w-full" className="h-full" />;
  }
  if (!src || error || broken) {
    return (
      <div
        className="flex h-full w-full items-center justify-center text-sm text-gray-400"
        data-cy="dashboard-widget-image-unavailable"
      >
        Image unavailable
      </div>
    );
  }

  const picture = (
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className="h-full w-full"
      style={{ objectFit: image.fit }}
      data-cy="dashboard-widget-image"
    />
  );
  const href = image.link && isHttpUrl(image.link) ? image.link : undefined;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
      {picture}
    </a>
  ) : (
    picture
  );
}

export default function ImageGridItem({ item }: { item: WidgetData }) {
  if (!item.image) {
    return null;
  }
  return (
    <div className="mt-2 min-h-0 flex-1" data-cy="dashboard-widget-image-panel">
      <DashboardImageView image={item.image} alt={item.name} />
    </div>
  );
}
