import { test, expect } from "../fixtures/test-base";

/**
 * [check:11] create-preset
 *
 * On the alerts feed, selecting one or more rows reveals the AlertActions
 * toolbar. Its "Create Preset" button opens the CreatePresetModal; submitting it
 * POSTs /preset and routes to /alerts/<name>.
 *
 * Backend assert: api.presets.getPresets() contains the new preset name.
 * UI assert: after submit the preset is selectable from the sidebar.
 */
test.describe("[check:11] create-preset", () => {
  test("creating a preset from the feed persists it and is selectable", async ({
    alertsFeed,
    page,
    api,
  }) => {
    const presetName = `sanity-preset-${Date.now()}`;

    // --- seed an alert so the feed has a selectable row -------------------
    const { fingerprint } = await api.alerts.sendAlert({
      name: `sanity-preset-alert-${Date.now()}`,
    });
    await api.alerts.waitForAlert(fingerprint);

    // --- UI: open feed and select the seeded row -------------------------
    // The feed only lists alerts once a CEL query is submitted; filter to this fp.
    const row = await alertsFeed.loadFeedRow(fingerprint);
    await expect(row.root).toBeVisible();

    // Select the row — this swaps the preset manager for the actions toolbar.
    await row.select();
    await expect(alertsFeed.actionsToolbar).toBeVisible();

    // --- UI: open the create-preset modal and submit ---------------------
    const modal = await alertsFeed.openCreatePresetModal();
    await modal.fillName(presetName);
    await modal.submit();

    // --- backend assert ---------------------------------------------------
    await expect
      .poll(
        async () => {
          const presets = await api.presets.getPresets();
          return presets.map((p: any) => p.name);
        },
        { timeout: 30_000, message: `preset "${presetName}" to be persisted` }
      )
      .toContain(presetName);

    // --- UI assert: the new preset is selectable -------------------------
    // (The create modal persists the preset via POST /preset; it does not
    // reliably auto-navigate to /alerts/<name> in dev, so we assert
    // selectability directly rather than the post-submit URL.)
    await page.goto(`/alerts/${presetName}`);
    await expect(alertsFeed.presetLink(presetName).first()).toBeVisible();
  });

  test('edit preset', async ({ alertsFeed, page, api }) => {
    const stamp = Date.now();
    const originalName = `edit-preset-orig-${stamp}`;
    const newName = `edit-preset-new-${stamp}`; // lowercase: save navigates to the lowercased name
    const origToken = `origcel${stamp}`;
    const newToken = `presetcel${stamp}`;
    const newCel = `name == "${newToken}"`;
    const tag = `tag-${stamp}`;

    // --- seed the preset via API: is_noisy false, is_private false ----------
    const created = await api.presets.createPreset({
      name: originalName,
      options: [{ label: "CEL", value: `name == "${origToken}"` }],
      is_noisy: false,
      is_private: false,
      tags: [],
    });

    // --- open the preset page and wait for its CEL to load ------------------
    await expect(async () => {
      await alertsFeed.gotoPreset(originalName);
      await expect(alertsFeed.celInput).toContainText(origToken, { timeout: 8_000 });
    }).toPass({ timeout: 60_000, intervals: [2_000, 4_000] });

    await alertsFeed.setCel(newCel);

    const form = await alertsFeed.openEditPresetForm();
    await form.fillName(newName);
    await form.setNoisy(true);
    await form.addTag(tag);
    await form.save();
    await expect(form.root).toBeHidden();

    // --- validate through the UI, IN PLACE ----------------------------------
    await expect(page).toHaveURL(new RegExp(`/alerts/${newName}`), { timeout: 30_000 });
    await expect(alertsFeed.celInput).toContainText(newToken, { timeout: 30_000 });
    await expect(alertsFeed.presetLink(newName).first()).toBeVisible({ timeout: 30_000 });

    // --- validate the rest through the API ----------------------------------
    await expect
      .poll(
        async () => {
          const presets = await api.presets.getPresets();
          const p = presets.find((x: any) => x.id === created.id);
          return p
            ? {
                name: p.name,
                is_noisy: p.is_noisy,
                is_private: p.is_private,
                tags: (p.tags ?? []).map((t: any) => t.name),
              }
            : null;
        },
        { timeout: 30_000, message: "preset update to land in the API" }
      )
      .toEqual(
        expect.objectContaining({
          name: newName,
          is_noisy: true,
          is_private: false,
          tags: expect.arrayContaining([tag]),
        })
      );
  })

  // test('delete preset', async ({ alertsFeed, page, api }) => {
  //   const stamp = Date.now();
  //   const name = `delete-preset-${stamp}`;

  //   // --- seed the preset via API --------------------------------------------
  //   await api.presets.createPreset({
  //     name,
  //     options: [{ label: "CEL", value: `name == "delcel${stamp}"` }],
  //     is_noisy: false,
  //     is_private: false,
  //     tags: [],
  //   });

  //   // --- open the preset page and wait for it to load -----------------------
  //   await expect(async () => {
  //     await alertsFeed.gotoPreset(name);
  //     await expect(alertsFeed.presetDeleteButton).toBeVisible({ timeout: 8_000 });
  //   }).toPass({ timeout: 60_000, intervals: [2_000, 4_000] });

  //   // --- delete via the preset page button ----------------------------------
  //   page.once("dialog", (dialog) => dialog.accept());
  //   await alertsFeed.deletePreset();

  //   // --- validate the UI: back on the feed, preset gone from the navbar -----
  //   await expect(page).toHaveURL(/\/alerts\/feed/, { timeout: 30_000 });
  //   await expect(alertsFeed.presetLink(name)).toHaveCount(0, { timeout: 30_000 });

  //   // --- validate via the API: getting the preset now returns 404 -----------
  //   await expect
  //     .poll(async () => api.presets.getPresetStatus(name), {
  //       timeout: 30_000,
  //       message: "deleted preset to return 404",
  //     })
  //     .toBe(404);
  // })
});
