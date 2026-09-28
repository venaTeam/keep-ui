import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Workflows page (/workflows) — the YAML upload modal.
 *
 * Locators are centralized in the `locators` map; methods reference it.
 *
 * NOTE: in the split-service dev stack the workflows LIST page can be
 * unavailable (it depends on `GET /workflows/query?is_v2=true`, not served
 * here), so callers treat the whole UI-upload path as best-effort and fall back
 * to the workflows API. The upload modal exposes a plain <textarea> (not Monaco),
 * so it is reliably drivable when the page does come up.
 */
export class WorkflowsPage {
  readonly locators: {
    uploadButton: Locator;
    uploadModal: Locator;
    yamlTextarea: Locator;
    yamlLoadButton: Locator;
  };

  constructor(readonly page: Page) {
    const uploadModal = page.locator('[data-cy="wf-upload-modal"]');
    this.locators = {
      uploadButton: page.locator('[data-cy="wf-upload-btn"]').first(),
      uploadModal,
      yamlTextarea: uploadModal.locator('[data-cy="wf-upload-yaml-textarea"]'),
      yamlLoadButton: uploadModal.locator('[data-cy="wf-upload-yaml-load-btn"]'),
    };
  }

  async goto(): Promise<void> {
    await this.page.goto("/workflows", { waitUntil: "domcontentloaded" });
  }

  /** Open the upload modal via the (possibly slow-to-appear) upload button. */
  async openUploadModal(): Promise<Locator> {
    await this.locators.uploadButton.waitFor({ state: "visible", timeout: 20_000 });
    await this.locators.uploadButton.click();
    await expect(this.locators.uploadModal).toBeVisible();
    return this.locators.uploadModal;
  }

  /**
   * Paste YAML into the upload modal and click Load. On a single successful
   * upload the component redirects to /workflows/<id>; call `waitForDetailId()`
   * to capture it.
   */
  async uploadYaml(yaml: string): Promise<void> {
    await this.openUploadModal();
    await this.locators.yamlTextarea.fill(yaml);
    await this.locators.yamlLoadButton.click();
  }

  /** Wait for the post-upload redirect and return the workflow id from the URL. */
  async waitForDetailId(timeoutMs = 15_000): Promise<string | undefined> {
    await this.page.waitForURL(/\/workflows\/[0-9a-f-]{8,}/i, { timeout: timeoutMs });
    return this.page.url().match(/\/workflows\/([0-9a-f-]{8,})/i)?.[1];
  }
}
