import React, { useEffect, useState } from "react";
import { Button, Select, SelectItem, Subtitle, TextInput } from "@tremor/react";
import { useApi } from "@/shared/lib/hooks/useApi";
import { uploadDashboardImage } from "@/entities/dashboard-images/model/useDashboardImages";
import { ImageFit, ImageWidgetConfig, LayoutItem, WidgetData } from "../../types";
import { DashboardImageView } from "./image-grid-item";
import { IMAGE_ACCEPT, isHttpUrl, validateImageFile } from "./image-widget-validation";

type ImageSource = ImageWidgetConfig["source"];

const NEW_WIDGET_LAYOUT: Partial<LayoutItem> = {
  w: 4,
  h: 4,
  minW: 0,
  minH: 2,
  static: false,
};

/** Image widget settings: upload (stored in Keep) or URL, fit mode and an optional link. */
export function ImageWidgetForm({
  editingItem,
  onChange,
}: {
  editingItem?: WidgetData | null;
  onChange: (formValue: Partial<WidgetData>, isValid: boolean) => void;
}) {
  const api = useApi();
  const initial = editingItem?.image;
  const [source, setSource] = useState<ImageSource>(initial?.source ?? "upload");
  const [imageId, setImageId] = useState<string | undefined>(initial?.imageId);
  const [uploadedName, setUploadedName] = useState<string>();
  const [url, setUrl] = useState(initial?.url ?? "");
  const [fit, setFit] = useState<ImageFit>(initial?.fit ?? "contain");
  const [link, setLink] = useState(initial?.link ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);

  const urlError =
    source === "url" && url !== "" && !isHttpUrl(url)
      ? "URL must start with http:// or https://"
      : null;
  const linkError =
    link !== "" && !isHttpUrl(link)
      ? "Link must start with http:// or https://"
      : null;
  const isValid =
    !uploading &&
    !linkError &&
    (source === "upload" ? !!imageId : url !== "" && !urlError);

  const image: ImageWidgetConfig =
    source === "upload"
      ? { source, imageId, fit, ...(link ? { link } : {}) }
      : { source, url, fit, ...(link ? { link } : {}) };

  useEffect(() => {
    onChange({ ...(editingItem ? {} : NEW_WIDGET_LAYOUT), image }, isValid);
  }, [source, imageId, url, fit, link, isValid]);

  async function upload(file: File) {
    const problem = validateImageFile(file);
    if (problem) {
      setUploadError(problem);
      setRetryFile(null);
      return;
    }
    setUploading(true);
    setUploadError(null);
    setRetryFile(file);
    setImageId(undefined);
    try {
      const result = await uploadDashboardImage(api, file);
      setImageId(result.id);
      setUploadedName(result.name);
      setRetryFile(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const showPreview = source === "upload" ? !!imageId : url !== "" && !urlError;

  return (
    <div data-cy="dashboard-widget-form-image">
      <div className="mb-4 mt-2">
        <Subtitle>Image Source</Subtitle>
        <Select
          value={source}
          onValueChange={(value) => setSource(value as ImageSource)}
          data-cy="dashboard-widget-form-image-source-select"
        >
          <SelectItem value="upload">Upload</SelectItem>
          <SelectItem value="url">URL</SelectItem>
        </Select>
      </div>

      {source === "upload" ? (
        <div className="mb-4 mt-2">
          <Subtitle>Image File (PNG, JPEG, GIF, WEBP, SVG — up to 5 MB)</Subtitle>
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            aria-label="Image file"
            className="mt-1 block w-full text-sm"
            data-cy="dashboard-widget-form-image-file-input"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              event.target.value = "";
              if (picked) {
                void upload(picked);
              }
            }}
          />
          {uploading && <p className="mt-1 text-sm text-gray-500">Uploading…</p>}
          {!uploading && uploadedName && (
            <p className="mt-1 text-sm text-gray-500">Uploaded {uploadedName}</p>
          )}
          {uploadError && (
            <div className="mt-1 flex items-center gap-2">
              <p role="alert" className="text-sm text-red-600">
                {uploadError}
              </p>
              {retryFile && !uploading && (
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  color="orange"
                  onClick={() => void upload(retryFile)}
                >
                  Retry
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="mb-4 mt-2">
          <Subtitle>Image URL</Subtitle>
          <TextInput
            value={url}
            onValueChange={setUrl}
            placeholder="https://intranet.example.com/diagram.svg"
            error={!!urlError}
            errorMessage={urlError ?? undefined}
            data-cy="dashboard-widget-form-image-url-input"
          />
        </div>
      )}

      <div className="mb-4 mt-2">
        <Subtitle>Fit</Subtitle>
        <Select
          value={fit}
          onValueChange={(value) => setFit(value as ImageFit)}
          data-cy="dashboard-widget-form-image-fit-select"
        >
          <SelectItem value="contain">Contain (show whole image)</SelectItem>
          <SelectItem value="cover">Cover (fill, may crop)</SelectItem>
        </Select>
      </div>

      <div className="mb-4 mt-2">
        <Subtitle>Link (optional)</Subtitle>
        <TextInput
          value={link}
          onValueChange={setLink}
          placeholder="https://example.com"
          error={!!linkError}
          errorMessage={linkError ?? undefined}
          data-cy="dashboard-widget-form-image-link-input"
        />
      </div>

      {showPreview && (
        <div className="mb-4 h-40 rounded border p-1">
          <DashboardImageView image={image} alt="Preview" />
        </div>
      )}
    </div>
  );
}
