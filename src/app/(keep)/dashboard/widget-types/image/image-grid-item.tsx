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
  const { url: uploadUrl, error, contentType } = useDashboardImage(
    isUpload ? image.imageId : undefined
  );
  const [broken, setBroken] = useState(false);
  const src = isUpload
    ? uploadUrl
    : image.url && isHttpUrl(image.url)
      ? image.url
      : undefined;

  useEffect(() => setBroken(false), [src]);

  if (isUpload && image.imageId && !error && !uploadUrl) {
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

  const isVector = isUpload
    ? contentType === "image/svg+xml"
    : /\.svg$/i.test(new URL(src).pathname);
  const sizing =
    image.fit === "cover"
      ? "h-full w-full object-cover"
      : isVector
        ? "h-full w-full object-contain"
        : "max-h-full max-w-full object-contain";
  const picture = (
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      className={sizing}
      data-cy="dashboard-widget-image"
    />
  );
  const href = image.link && isHttpUrl(image.link) ? image.link : undefined;
  const wrapper = "flex h-full w-full items-center justify-center";
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={wrapper}>
      {picture}
    </a>
  ) : (
    <div className={wrapper}>{picture}</div>
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
