# Why HOSSTED_DASHBOARD_URL / HOSSTED_PROXY_URL live in .env.production, not Docker build-args

`next.config.js` has:

```js
env: {
  HOSSTED_PROXY_URL: process.env.HOSSTED_PROXY_URL,
  HOSSTED_DASHBOARD_URL: process.env.HOSSTED_DASHBOARD_URL,
  HOSSTED_TOAST_DISABLED: process.env.HOSSTED_TOAST_DISABLED,
},
```

Next.js's bundler replaces each of these with a literal string inside the
browser JavaScript during `next build`. The browser has no process and no
filesystem at runtime, so whatever value is in the bundle at build time is
permanent until the image is rebuilt. This is different from vars like
`API_URL` or `AUTH_TYPE`, which are read by server code with
`process.env` at container start and can be changed per deployment through
the Deployment/Helm runtime environment without a rebuild.

## There is no single "production" value

`@hossted/keep-integration` (the npm package these vars configure) isn't
run as one shared image across every deployment — it's handed out as a
package that gets built into separate, independent copies of this
codebase: Hossted's own deployment, and each client's own copy, each
wired to its own backend and its own Hossted dashboard link. So
`HOSSTED_DASHBOARD_URL` and `HOSSTED_PROXY_URL` don't have one correct
"prod" value the way, say, `KEEP_VERSION` might — each separate instance
needs its own.

Because these vars can only be set at build time (see above), and each
instance needs its own value, there are two ways to give an instance's
production build its own values instead of the dev ones:

- **Docker build-args**: declare `ARG`/`ENV` pairs in the Dockerfile's
  builder stage, and have whatever builds the image pass
  `--build-arg HOSSTED_DASHBOARD_URL=...`. In OpenShift, this is what
  "set it in the console" usually means for a BuildConfig — the console is
  a UI over the same build-arg mechanism, not a different one.
- **A `.env.production` file, filled in per instance**: Next.js already
  loads this file automatically during `next build` (it forces production
  mode for the build regardless of the shell's `NODE_ENV`, and
  `.env.production` takes precedence over `.env`). No Dockerfile change
  and no CI change are needed — whoever builds a given instance edits this
  one file for that instance.

We went with `.env.production` because `HOSSTED_DASHBOARD_URL` and
`HOSSTED_PROXY_URL` are not secrets — they're public URLs the browser
already needs to know — so there's no reason to keep them out of a
build's own config file. Each instance (this repo's own deployment, or a
client's copy) fills in this one file with its own values, the same way
they'd edit their own copy of a Helm `values.yaml`.

Two things this relies on:

- `.dockerignore` excluded `.env.*`, which also excluded
  `.env.production` from ever reaching the Docker build context — so even
  an instance that correctly filled this file in would silently never get
  the values into its image. It now has `!.env.production` so that file
  is copied in while `.env.local` and `.env.development` (dev-only) stay
  excluded.
- Only vars that `next.config.js`'s `env` key inlines belong in
  `.env.production`. A server-side-only var like
  `HOSSTED_UPSTREAM_TOKEN` is a real secret and must not go there — it
  should stay a runtime Secret in that instance's Deployment/Helm chart,
  never baked into any image.

`@hossted/keep-integration`'s own `docs/INTEGRATION_GUIDE.md` (in the
`keep-npm-widget` repo) currently tells new client integrations to put
`HOSSTED_PROXY_URL`/`HOSSTED_DASHBOARD_URL` in `.env.local` instead. That
guide predates this fix and has the same dockerignore problem baked in —
any client who follows it and builds with Docker would hit the exact bug
this file fixes here. Worth updating there too.
