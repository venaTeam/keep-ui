# Keep UI Session Reuse Fix

## The problem

Keep UI was resolving the authenticated session several times during a single page request or navigation:

1. `src/middleware.ts` was wrapped with Auth.js `auth(...)`. This wrapper already resolves the session and exposes it as `request.auth`.
2. The middleware then called `auth()` again explicitly.
3. `src/app/(keep)/layout.tsx` called `auth()` during the server render.
4. `src/components/navbar/Navbar.tsx` was an async Server Component and called `auth()` again.
5. `NextAuthProvider` accepted a session but did not pass it to Auth.js `SessionProvider`, so the browser could request `/api/auth/session` again.

Depending on the authentication provider and session strategy, each `auth()` call can validate or decrypt a token, execute Auth.js callbacks, refresh an expired access token, query a database, or contact an external identity provider. Repeating that work increases navigation latency and consumes unnecessary server and identity-provider resources.

There was also a broken custom hydration mechanism:

- `NextAuthProvider` wrote the session to `window.__NEXT_AUTH_SESSION__`.
- `useHydratedSession` tried to read `window.__NEXT_AUTH.session`.

Those are different properties, so the custom cache could not work as intended.

## The solution

The session is now resolved once by the Auth.js middleware wrapper for each matched HTTP request. The middleware reuses `request.auth` and passes that already-resolved session to the Server Component tree in an internal request header.

The Keep layout reads the header and supplies the parsed session to `NextAuthProvider`. The provider initializes Auth.js `SessionProvider` with that session. Navbar is now a Client Component and reads the same session from `useSession()`.

The new flow is:

```text
Browser navigation request
        |
        v
Auth.js middleware wrapper resolves session once
        |
        +-- request.auth is used for redirects and role checks
        |
        +-- serialized into the internal x-keep-session request header
                |
                v
Keep layout reads and parses the header
                |
                v
NextAuthProvider initializes SessionProvider
                |
                v
Navbar and other Client Components use useSession()
```

This does not cache one session forever across every request. Middleware still validates the authentication cookie once for each matched navigation request. The improvement is that all code involved in that request reuses the same resolved result.

## Code changes

### 1. Session header helper

File: `src/shared/lib/auth/sessionHeader.ts`

This file defines one shared header name:

```ts
export const SESSION_HEADER = "x-keep-session";
```

`serializeSession()` converts the Auth.js `Session` object to JSON and URI-encodes it so it can safely be stored as an HTTP header value:

```ts
export function serializeSession(session: Session): string {
  return encodeURIComponent(JSON.stringify(session));
}
```

`deserializeSession()` reverses the process. It returns `null` for a missing, malformed, or invalidly encoded value instead of crashing the layout:

```ts
export function deserializeSession(value: string | null): Session | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(value)) as Session;
  } catch {
    return null;
  }
}
```

### 2. Middleware session reuse

File: `src/middleware.ts`

The redundant call was removed:

```ts
const session = await auth();
```

It was replaced with the session already resolved by the middleware wrapper:

```ts
const session = request.auth;
```

Authentication and role routing now use this same object:

```ts
const role = session?.userRole;
const isAuthenticated = !!request.auth;
```

The middleware clones the incoming request headers and adds the session for downstream Server Components:

```ts
const requestHeaders = new Headers(request.headers);

if (session) {
  requestHeaders.set(SESSION_HEADER, serializeSession(session));
} else {
  requestHeaders.delete(SESSION_HEADER);
}
```

Deleting the header for an unauthenticated request is important. A browser or malicious caller could send its own `x-keep-session` header, but middleware must never trust it. Middleware either overwrites it with the authenticated value from `request.auth` or removes it.

The headers are forwarded upstream using:

```ts
return NextResponse.next({
  request: {
    headers: requestHeaders,
  },
});
```

This is an internal request header for the Next.js render. It is not intentionally exposed as a response header to the browser.

### 3. Tighter middleware matcher

File: `src/middleware.ts`

The matcher now bypasses routes that do not need UI authentication:

- `/api/*`
- `/_next/*`
- `/monitoring/*`
- Favicons, robots, and sitemap files
- CSS, JavaScript, source maps, images, fonts, manifests, and other static files

Application pages remain protected. The legacy `/backend/*` proxy remains matched because its rewrite is implemented inside this middleware.

This avoids executing Auth.js for every image, stylesheet, JavaScript bundle, optimized image request, and internal Next.js request.

### 4. Keep layout reads the resolved session

File: `src/app/(keep)/layout.tsx`

The layout no longer imports or calls `auth()`.

It uses the asynchronous Next.js 15 `headers()` API:

```ts
const session = deserializeSession(
  (await headers()).get(SESSION_HEADER)
);
```

The parsed object is passed directly to the existing provider:

```tsx
<NextAuthProvider session={session}>
  {children}
</NextAuthProvider>
```

The layout remains an async Server Component because reading request headers is asynchronous in Next.js 15. The expensive duplicate `auth()` operation is what was removed.

### 5. Stable Auth.js client provider

File: `src/app/auth-provider.tsx`

Previously, the component accepted `session` but ignored it:

```tsx
<SessionProvider>{children}</SessionProvider>
```

It now initializes Auth.js with the server-provided session:

```tsx
<SessionProvider
  session={session}
  refetchInterval={0}
  refetchOnWindowFocus={false}
>
  {children}
</SessionProvider>
```

Effects:

- Auth.js does not need to fetch `/api/auth/session` just to hydrate the initial client render.
- It does not poll the session periodically.
- Switching away from the browser window and returning does not trigger another session request.
- Explicit Auth.js updates, sign-in, sign-out, and middleware token-refresh behavior remain available.

The mismatched `window.__NEXT_AUTH_SESSION__` custom cache was removed because `SessionProvider` is now the single client-side source of truth.

### 6. Navbar converted to a Client Component

File: `src/components/navbar/Navbar.tsx`

Navbar now starts with:

```ts
"use client";
```

Its async server-side call was removed:

```ts
const session = await auth();
```

It now reads the provider session:

```ts
const { data: session } = useSession();
```

The same session is passed to `Menu`, `Search`, `AlertsLinks`, `NoiseReductionLinks`, `IncidentsLinks`, `UserInfo`, and `SetSentryUser` as before. These Navbar descendants were already Client Components, so this aligns the parent with the existing subtree.

### 7. Simplified hydrated-session hook

File: `src/shared/lib/hooks/useHydratedSession.tsx`

The hook previously maintained hydration state and attempted to read the incorrectly named browser global. It now delegates to the correctly initialized Auth.js provider:

```ts
export function useHydratedSession() {
  return useSession();
}
```

This prevents two competing session sources from drifting out of sync.

## Tests added

### Session header tests

File: `src/shared/lib/auth/__tests__/sessionHeader.test.ts`

The tests verify:

- A session survives serialization and deserialization.
- Unicode user names are supported.
- Missing, empty, malformed JSON, and malformed URI encoding return `null`.

### Provider test

File: `src/app/__tests__/auth-provider.test.tsx`

The test verifies that `NextAuthProvider` passes these values to `SessionProvider`:

- The initial session object.
- `refetchInterval={0}`.
- `refetchOnWindowFocus={false}`.

## Verification results

- Focused regression tests: 7 passed.
- Changed-file ESLint: passed.
- Middleware matcher checks: passed.
- Full Jest unit coverage: 55 suites and 459 tests passed.
- Twelve Playwright E2E specifications are currently collected incorrectly by Jest and fail while loading Playwright infrastructure; this is unrelated to the session change.
- The repository also has existing TypeScript errors in the health layout and an older workflow-builder test configuration fixture.

## Manual verification checklist

1. Open a protected page while signed out and confirm it redirects to `/signin`.
2. Sign in and confirm the original callback page opens.
3. Open browser developer tools and select the Network tab.
4. Filter requests by `session`.
5. Navigate between several Keep pages using the Navbar.
6. Confirm normal navigation does not repeatedly request `/api/auth/session`.
7. Confirm the Navbar does not lose or flicker its authenticated user state.
8. Switch browser tabs and return; confirm no focus-based session refetch occurs.
9. Hard-refresh a protected page and confirm authentication remains available.
10. Sign out and revisit a protected page; confirm it redirects to sign-in.
11. Confirm `/_next/*`, images, CSS, JavaScript, and font requests do not execute authentication middleware.
12. Allow the access token to expire, then navigate and confirm Auth.js refreshes it and the user stays signed in.

## Security and deployment notes

- `x-keep-session` must remain an internal upstream request header, not a response header.
- Client-provided values are removed or overwritten by middleware.
- The serialized session contains the access token used by Keep's client API layer. Reverse proxies and hosting platforms should be checked for header-size limits. Very large identity-provider tokens can cause HTTP 431 errors.
- The session is reused within one request. It is not globally cached across users or indefinitely cached across requests.
- The local Keycloak credentials used for testing are development-only and must not be used in production.

## Git information

- Branch: `fix/reuse-auth-session`
- Commit: `e57b4d9` (`fix: reuse resolved auth session`)
- Pull request: https://github.com/venaTeam/keep-ui/pull/64
