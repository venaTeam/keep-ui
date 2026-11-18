# On-prem merge: alert tables + quick actions → `dev` (through PRs)

## Part 0 — Follow-up, 2026-11-18: two QA fixes (run THIS part)

**Status:** Parts 1–2 were completed on the air-gapped environment on 2026-11-17: all six PRs are merged into `dev`. **Don't run them again.** This part brings in the two fixes QA asked for, as two more PRs into `dev`. Nothing in keep-api-gateway changes.

### 0.1 Prompt for the agent

> You are executing a **pre-verified follow-up merge** in the air-gapped environment: **two PRs into `dev`, in order**, each bringing one QA fix. Part 1's rules all apply:
> - only `dev`, only through PRs, "merge commit" method only;
> - no rebase, squash, cherry-pick, amend, force-push, `git stash` or file edits;
> - never merge the integration branch;
> - on any conflict, mismatch, failed check or unexpected state, stop, report and ask the user.
>
> Check `dev`'s tree hash after each merge against §0.5. Before each action, print what you're about to do; when done, report as in §2.8.

### 0.2 What is merged (keep-ui only)

| Order | Source branch → target | Expected source SHA | Fix |
|---|---|---|---|
| F1 | `feat/alert-table-widget-customization` → `dev` | `de6c91d31278ef699f48f332643edfdc5201634a` | "Last Received" (time-ago) keeps counting past the first minute in the dashboard widget |
| F2 | `feat/widget-quick-actions` → `dev` | `5987c6b36f0bd2f61fda855a21838aba937f1255` | The widget's "Link to incident" is offered for every alert, as on the presets page |

Each branch is the version already merged into `dev` plus one fix commit:
- F1 is on top of `ccec909564ce776174923fb3c337d920c5ab6ecd`;
- F2 is on top of `8e86cbaccfb290563d1ff2974b1d290a1457f6f8`.

`feat/alert-table-noisy-blink` is unchanged at `8736a3f4…`; no PR for it.

Reference (compare only, never merge): keep-ui `integration/alert-tables-quick-actions` = `e06a07dbb5c504cb7cf6354bb27d524f9941e1fd`, tree `d62531ecc33ee0c6832f0c719b71f3a9bf3dfb76`.

### 0.3 Pre-flight (keep-ui clone)

```bash
git fetch origin --prune
git status --porcelain                       # must print nothing
git rev-parse 'origin/dev^{tree}'            # must be 53cad546ddb8fbb320867f0a90670c3b4832f173 (the end of Part 2)
check() { [ "$(git rev-parse "origin/$1")" = "$2" ] && echo "OK        $1" || echo "MISMATCH  $1  is $(git rev-parse "origin/$1")"; }
check feat/alert-table-widget-customization   de6c91d31278ef699f48f332643edfdc5201634a
check feat/widget-quick-actions               5987c6b36f0bd2f61fda855a21838aba937f1255
check integration/alert-tables-quick-actions  e06a07dbb5c504cb7cf6354bb27d524f9941e1fd
git merge-base --is-ancestor ccec909564ce776174923fb3c337d920c5ab6ecd origin/dev && echo "OK dev has #110 ccec9095"
git merge-base --is-ancestor 8e86cbaccfb290563d1ff2974b1d290a1457f6f8 origin/dev && echo "OK dev has #115 8e86cbac"
git push origin origin/dev:refs/heads/backup/dev-before-qa-fixes
```

Every line must print `OK`, and `dev`'s tree must match. If `dev`'s tree differs because something else was merged since, **stop and ask the user**.

### 0.4 Local dry run (never pushed)

```bash
git checkout -B dryrun/qa-fixes origin/dev
git merge --no-ff --no-edit origin/feat/alert-table-widget-customization; git rev-parse 'HEAD^{tree}'  # c39407b54e8252a52a74df6b045568a1d62b95f5
git merge --no-ff --no-edit origin/feat/widget-quick-actions;            git rev-parse 'HEAD^{tree}'  # d62531ecc33ee0c6832f0c719b71f3a9bf3dfb76
git diff --stat origin/integration/alert-tables-quick-actions HEAD   # must print nothing
git checkout --detach origin/dev && git branch -D dryrun/qa-fixes
```

Any conflict or mismatch means **stop**. If the environment can run them, also run `npm ci && npm run typecheck && npx jest --ci && npm run lint` on the dry run before deleting it (lint: 0 errors).

### 0.5 The two PRs (target `dev`, "merge commit")

Open F1 and F2 against `dev`. Each PR's diff must show only its fix commit:
- **F1:** 2 files, `src/widgets/alerts-table/lib/alert-table-time-format.tsx` and its test.
- **F2:** 9 files: the quick-actions registry, its tests and spec, with `model/has-live-incident.ts` and its test deleted.

If a PR shows more, **stop**.

Merge F1, then F2, re-checking each PR's source SHA first. After each merge:

```bash
git fetch origin
git rev-parse 'origin/dev^{tree}'
```

| After merging | `origin/dev^{tree}` must be |
|---|---|
| F1 | `c39407b54e8252a52a74df6b045568a1d62b95f5` |
| F2 | `d62531ecc33ee0c6832f0c719b71f3a9bf3dfb76` |

Final check: `git diff --stat origin/integration/alert-tables-quick-actions origin/dev` must print nothing.

Deploy keep-ui only. QA retests two things:
- **Last Received** keeps counting ("2 minutes ago", "3 minutes ago"…) without a page refresh.
- **Link to incident** is offered for an alert that's already in an incident, both in the row tray and in the selection strip.

Proof (2026-11-18): starting from a `dev` with tree `53cad546` built by Part 2's merges, F1 then F2 were simulated. Both were clean and the trees above were reached. Typecheck, jest and lint pass after F1 (1852 tests) and after F2 (1849), with 0 lint errors.

Rollback, if ever needed: a PR to `dev` reverting the F2 then F1 merge commits (`git revert -m 1 <merge-sha>`). Keep `backup/dev-before-qa-fixes` until the deploy is confirmed.

---

## Part 1 — Prompt for the agent (completed on the air-gapped side, 2026-11-17)

> You are executing a **pre-verified merge plan** in the air-gapped environment. Your job is to get six feature branches into **`dev`**: one in keep-api-gateway, five in keep-ui. You do it **only through pull requests (merge requests) that target `dev`**, merged in a fixed order with the **"merge commit"** method, and you check `dev` after every merge against the expected values in this file. The plan was proven in advance: on the expected base, every merge is conflict-free and the end result is byte-identical to the integration branch the user already tested.
>
> **Rules. They override anything you would normally do.**
> 1. **The only branch you merge into is `dev`.** Never merge into or push to `main`, `master`, a release branch or any other branch. Never push to `dev` directly. Every change reaches `dev` through a PR merge.
> 2. **One PR per feature branch, target `dev`**, created and merged in the order of §2.0. Merge method: **"merge commit"** (a non-fast-forward merge commit). Never use squash, rebase, fast-forward-only or semi-linear merges. If the server only allows those, stop and ask the user.
> 3. **Never merge `integration/alert-tables-quick-actions`** and never open a PR for it. It is the reference you compare against.
> 4. **Never** rebase, squash, cherry-pick, amend, force-push, `git stash`, or edit files. Don't delete any source branch until §2.9.
> 5. **Before merging each PR**, check that its source SHA matches §2.0 and that the server shows no conflicts. **After each merge**, check `dev`'s tree hash (§2.5).
> 6. **On any conflict, mismatch, failed check or unexpected state: stop, report, and ask the user.** Don't adapt the plan on your own and don't resolve conflicts unless the user explicitly approves, following §2.7.
> 7. If PR approvals are required, ask the user to approve. Never approve on the user's behalf by any workaround.
> 8. Before each action, print what you're about to do. When you stop, print the step, the command or PR action, the full output, and the state (`git log --oneline -5 origin/dev`, PR status).
> 9. When done, give the user the report described in §2.8.

---

## Part 2 — Runbook

> **For a from-scratch run (for example the later merge on GitHub), with the current heads, which include the QA fixes.** The air-gapped run on 2026-11-17 used the earlier heads: U3 `ccec9095`, U5 `8e86cbac`, ending at tree `53cad546`. Part 0 then brings that `dev` to the same final tree, `d62531ec`.

### 2.0 What is being merged

| Repo | Order | Source branch → target | Expected source SHA | Was | What |
|---|---|---|---|---|---|
| keep-api-gateway | G1 | `feat/dashboard-duplicate` → `dev` | `2055fe0c17585fb12317c043d1d49bb10a6ca483` | gw#126 | Duplicate a dashboard (`POST /dashboard/{id}/duplicate`) |
| keep-ui | U1 | `feat/dashboard-duplicate` → `dev` | `5b3394cc32d1dda749cfe2cadd699182878d87be` | #112 | Duplicate a dashboard from the sidebar |
| keep-ui | U2 | `feat/dashboard-drag-gravity` → `dev` | `016845042fc49ffd62e594b1054aee657018f6ad` | #109 | Panels float back when dragging over others |
| keep-ui | U3 | `feat/alert-table-widget-customization` → `dev` | `de6c91d31278ef699f48f332643edfdc5201634a` | #110 | Customizable Alert Table widget. Contains #109 |
| keep-ui | U4 | `feat/alert-table-noisy-blink` → `dev` | `8736a3f4a579522336b2912677005c81f3b589ab` | #111 | Blink critical firing alerts in noisy presets. Contains #109, #110 and the commits joining #110/#111 |
| keep-ui | U5 | `feat/widget-quick-actions` → `dev` | `5987c6b36f0bd2f61fda855a21838aba937f1255` | #115 | Quick actions in the Alert Table widget. Contains #109, #110, #111 |

Every PR targets **`dev`**, including U5, which isn't stacked on another PR here. Because U3, U4 and U5 contain the earlier branches, their PRs first show those earlier changes too. Each diff shrinks to its own changes as the earlier PRs merge. That is expected.

Reference branches. **Compare only; never merge or open a PR for them:**

| Repo | Branch | SHA | Tree |
|---|---|---|---|
| keep-ui | `integration/alert-tables-quick-actions` | `e06a07dbb5c504cb7cf6354bb27d524f9941e1fd` | `d62531ecc33ee0c6832f0c719b71f3a9bf3dfb76` |
| keep-api-gateway | `integration/alert-tables-quick-actions` | `2b18ec6971eaf08e8b68f4ef8b65304c2ba8cb75` | `d93e01ac6489df0eacbea5e2d28e07584bcf630c` |

Expected base:

| Repo | Base `dev` |
|---|---|
| keep-ui | `17720a3b51a8a7a7822d28ab8919df5d03a388cb` |
| keep-api-gateway | `c70247584f9b4bdd321f56314824d4890fff7929` |

The remote is called `origin` below. If it has another name, stop and ask the user.

### 2.1 Pre-flight (each repo, in a clean clone)

```bash
git fetch origin --prune
git status --porcelain              # must print nothing
check() { [ "$(git rev-parse "origin/$1")" = "$2" ] && echo "OK        $1" || echo "MISMATCH  $1  is $(git rev-parse "origin/$1")"; }
```

keep-api-gateway:
```bash
check dev                                     c70247584f9b4bdd321f56314824d4890fff7929
check feat/dashboard-duplicate                2055fe0c17585fb12317c043d1d49bb10a6ca483
check integration/alert-tables-quick-actions  2b18ec6971eaf08e8b68f4ef8b65304c2ba8cb75
```

keep-ui:
```bash
check dev                                     17720a3b51a8a7a7822d28ab8919df5d03a388cb
check feat/dashboard-duplicate                5b3394cc32d1dda749cfe2cadd699182878d87be
check feat/dashboard-drag-gravity             016845042fc49ffd62e594b1054aee657018f6ad
check feat/alert-table-widget-customization   de6c91d31278ef699f48f332643edfdc5201634a
check feat/alert-table-noisy-blink            8736a3f4a579522336b2912677005c81f3b589ab
check feat/widget-quick-actions               5987c6b36f0bd2f61fda855a21838aba937f1255
check integration/alert-tables-quick-actions  e06a07dbb5c504cb7cf6354bb27d524f9941e1fd
```

- **Every line says `OK`:** continue (the normal case).
- **Only `dev` mismatches:** `dev` has moved since the plan was prepared. **Stop and ask the user.** Report `git log --oneline <expected dev SHA>..origin/dev`, or say it has diverged if that command fails.
- **Any feature or integration branch mismatches:** **stop.** The branch changed after the plan was prepared.

### 2.2 Back up `dev` (each repo)

This creates a new branch. It is not a push to `dev`.

```bash
git push origin origin/dev:refs/heads/backup/dev-before-alert-tables
```

### 2.3 Local dry run: nothing is pushed

This proves the merges on your own copy before any PR is merged. It is **local only**. Never push this branch.

keep-api-gateway:
```bash
git checkout -B dryrun/alert-tables origin/dev
git merge --no-ff --no-edit origin/feat/dashboard-duplicate
git rev-parse 'HEAD^{tree}'                  # expect d93e01ac6489df0eacbea5e2d28e07584bcf630c
git diff --stat origin/integration/alert-tables-quick-actions HEAD   # must print nothing
```

keep-ui:
```bash
git checkout -B dryrun/alert-tables origin/dev
git merge --no-ff --no-edit origin/feat/dashboard-duplicate;              git rev-parse 'HEAD^{tree}'  # e6b10780649638d81cea1d8b43a50d31c043c41e
git merge --no-ff --no-edit origin/feat/dashboard-drag-gravity;           git rev-parse 'HEAD^{tree}'  # fa2bd454840ac2cbf9a184c168e705e1007d3144
git merge --no-ff --no-edit origin/feat/alert-table-widget-customization; git rev-parse 'HEAD^{tree}'  # 88a64fdefc5c18344e4a7cf4516affa32227f5fe
git merge --no-ff --no-edit origin/feat/alert-table-noisy-blink;          git rev-parse 'HEAD^{tree}'  # 1ef92bb0d38ddc01564f5e5f100bdb6e86746cd6
git merge --no-ff --no-edit origin/feat/widget-quick-actions;             git rev-parse 'HEAD^{tree}'  # d62531ecc33ee0c6832f0c719b71f3a9bf3dfb76
git diff --stat origin/integration/alert-tables-quick-actions HEAD   # must print nothing
```

- **Any conflict:** `git merge --abort` and **stop**.
- **Any hash mismatch or a non-empty final diff:** **stop**.

If the environment can run them, also run on the keep-ui dry run: `npm ci && npm run typecheck && npx jest --ci && npm run lint`. All must pass (lint: 0 errors).

Afterwards, in each repo:
```bash
git checkout --detach origin/dev && git branch -D dryrun/alert-tables
```

### 2.4 Open the PRs (all target `dev`)

Open one PR per row of §2.0: source = the branch, **target = `dev`**. Suggested title is the "What" column; in the description, say it's part of the alert-tables set, merged in order G1, U1…U5.

Before merging, confirm every PR:
- shows **target `dev`**;
- has a source head equal to the SHA in §2.0;
- reports **no conflicts**.

### 2.5 Merge the PRs in order, checking `dev` after each

Order: **G1** (gateway), then **U1, U2, U3, U4, U5** (keep-ui). For each PR:

1. Re-check it. Its source head must still equal §2.0, and the server must show no conflicts and the CI result. If a required check fails, stop.
2. Merge it with **"merge commit"**. **Don't** tick "delete source branch" or "squash".
3. Verify `dev`. The tree hash must match the table below:
   ```bash
   git fetch origin
   git rev-parse 'origin/dev^{tree}'
   ```

| After merging | `origin/dev^{tree}` must be |
|---|---|
| G1 (gateway) | `d93e01ac6489df0eacbea5e2d28e07584bcf630c` |
| U1 | `e6b10780649638d81cea1d8b43a50d31c043c41e` |
| U2 | `fa2bd454840ac2cbf9a184c168e705e1007d3144` |
| U3 | `88a64fdefc5c18344e4a7cf4516affa32227f5fe` |
| U4 | `1ef92bb0d38ddc01564f5e5f100bdb6e86746cd6` |
| U5 | `d62531ecc33ee0c6832f0c719b71f3a9bf3dfb76` |

A mismatch means **stop**: something besides this plan reached `dev`, or the merge method wasn't a plain merge commit.

**Final check (each repo), after the last merge:**
```bash
git fetch origin
git diff --stat origin/integration/alert-tables-quick-actions origin/dev   # must print nothing
```

**Deploy order:** gateway first, then keep-ui. The UI's Duplicate button needs the gateway's new route. No migration, no environment variable, no feature flag. Check that the air-gapped CI on `dev` is green.

### 2.6 What "stop" means

- Don't merge any further PR.
- Leave everything as it is.
- Report as in §2.8, and wait for the user.

### 2.7 Conflicts

On the expected base, **no PR can conflict**. If one does, something changed. **Stop and ask the user.**

If the user explicitly approves a resolution, it goes into that **feature branch** through its PR, never directly into `dev`:
1. `git checkout -B <feature-branch> origin/<feature-branch>`.
2. `git merge --no-ff origin/dev`.
3. Resolve only the conflicting hunks, keeping both sides' intent. The tested result for the feature side is `git show origin/integration/alert-tables-quick-actions:<file>`.
4. Show the user the full resolution diff, `git diff HEAD~1 -- <files>`.
5. Push the **feature branch** (a normal push, never `--force`) only after the user approves.
6. The PR then merges with "merge commit" as in §2.5. From this step on, tree hashes are no longer expected to match. Instead, the final `git diff` may only list the files the unexpected `dev` changes touched, and the user decides.

### 2.8 Report to the user

For each repo:
- the §2.1 results;
- the dry-run results (§2.3);
- for each PR: its link or ID, source SHA, the merge commit SHA on `dev`, and the tree hash check (`OK` or the difference);
- the final check output;
- any stop, with the step, the action and its output.

### 2.9 After success

- Close the inspection-only draft keep-ui PR #117 on GitHub without merging it.
- Keep `backup/dev-before-alert-tables` until the deploy is confirmed, then delete it. The source branches and `integration/alert-tables-quick-actions` can be deleted then too.
- **Rollback, if ever needed:** through a PR to `dev` that reverts the merge commits newest-first (`git revert -m 1 <merge-sha>` for U5, U4, U3, U2, U1, on a branch made from `dev`). Never rewrite `dev`.
- Not part of this set: the alerts-table null-date ("1970") fix, `fix/alerts-table-null-dates`. It is merged separately.

---

## Appendix — moving the branches into the air-gapped environment

In a GitHub-connected clone of each repo:

```bash
# keep-ui
git fetch origin
git bundle create keep-ui.bundle \
  origin/dev origin/feat/dashboard-duplicate origin/feat/dashboard-drag-gravity \
  origin/feat/alert-table-widget-customization origin/feat/alert-table-noisy-blink \
  origin/feat/widget-quick-actions origin/integration/alert-tables-quick-actions

# keep-api-gateway
git fetch origin
git bundle create keep-api-gateway.bundle \
  origin/dev origin/feat/dashboard-duplicate origin/integration/alert-tables-quick-actions
```

In the air-gapped clone:

```bash
git bundle verify /path/keep-ui.bundle
git fetch /path/keep-ui.bundle 'refs/remotes/origin/*:refs/remotes/bundle/*'
git push origin bundle/feat/widget-quick-actions:refs/heads/feat/widget-quick-actions   # repeat per branch
```

Push the feature and integration branches under the same names, **not `dev`**. The air-gapped `dev` must already be at the expected base. Then start at §2.1.

*Prepared 2026-11-17. The merge sequence was simulated on the expected bases: all merges were clean and the final trees equal the integration branches. Typecheck, jest and lint pass at every intermediate keep-ui state (after #110: 1657 tests; after #111: 1737; final: 1849).*
