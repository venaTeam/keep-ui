# G27 automation list and detail

Enable with `KEEP_AUTOMATIONS_ENABLED=true` and set the server-only
`AUTOMATIONS_API_URL` to the automation service origin. The flag defaults to
false and gates navigation, page routes and automation BFF endpoints. Keep the
flag off until the service and G28/G29 edit destination are deployed.

Browser reads and lifecycle mutations use ApiClient through `/backend`, even
when `API_URL_CLIENT` points to an absolute gateway. `/automation-namespaces`
is a dedicated BFF alias for upstream `/namespaces`. Internal execution/build
endpoints are not exposed by this routing. Existing session authorization and
tenant-prefixed bearer tokens are forwarded; the upstream validates identity.

## Contract assumptions

The UI payload section in the workspace's `automation-contracts.md` is still
reserved. Known fields follow the automation API DTOs; provisional mappings
are isolated in `entities/automations/model/normalize.ts`:

- List: `{ automations: [...] }`, filters `namespace`, `matching_state`,
  `build_state`. `last_run` provisionally contains `{ id, state, created_at }`
  for the latest non-suppressed execution attempt. `null` means never run;
  omitted/malformed data means unavailable. No timestamp is substituted.
- Namespace options: `{ namespaces: [{ namespace: string }] }`. Options do
  not come from the potentially capped automation list.
- Detail uses `timeout_seconds`, matching the existing API DTO. Lifecycle
  acknowledgments are partial and merged into detail before refreshing.
- Edit links to `/automations/{id}/edit`, owned by G28/G29. G27 intentionally
  contains no editor, authoring form, or run-history page.
- Enabling requires a nonblank digest. Disabling remains available for an
  active record with a missing digest, including while building.
- A delete acknowledgment shows `deleting`; only a backend `deleted` state
  means complete. Polling performs reads only and never retries the cascade.

## Verification

```sh
npm run test -- --runInBand
npm run typecheck
npm run test:e2e -- --config=playwright.automations.config.ts
AUTOMATIONS_TEST_FLAG_OFF=true npm run test:e2e -- --config=playwright.automations.config.ts
AUTOMATIONS_TEST_READ_ONLY=true npm run test:e2e -- --config=playwright.automations.config.ts
```

The dedicated Playwright suite starts a real Next.js UI and BFF with a
deterministic HTTP fixture upstream on ports 3199/4199. It uses the existing
noauth sign-in convention only in that test process. These are browser/BFF
tests, not real automation-service integration evidence. The standard Keep
sanity suite remains separate and requires the full existing Keep stack.

The GitHub Actions lane runs component tests, typecheck, a production build,
and all three browser configurations. CI passing and merge must be confirmed
separately after publishing the branch.

Two inherited typecheck blockers were repaired: a stale `mulish` reference in
the health layout and missing runtime-config fields in a workflow test fixture.
Jest now excludes Playwright's `e2e` directory; the suites have separate runners.
