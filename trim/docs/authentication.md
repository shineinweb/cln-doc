# Authentication

Serenity Phase 1 uses signed JSON Web Tokens. There is no server session.

## Flow

1. `POST /auth/login` accepts an email and password.
2. The API loads the user and compares the password with the bcrypt hash stored on `credentials`.
3. A match returns a bearer access token (`HS256`) plus the session profile.
4. The browser keeps the token in `sessionStorage` under `trim.accessToken` and sends `Authorization: Bearer <token>` on later requests.
5. Every authenticated request verifies the signature and expiry, then reloads the user, organization role, and site memberships from MySQL.

The token only identifies the user (`sub`, `orgId`, `email`). Site access is not copied into the token. Revoking a membership takes effect on the next request.

`JWT_EXPIRES_IN_SECONDS` controls the lifetime (12 hours in the dev env file). There is no refresh token in this phase. When the token expires, the person signs in again.

Redis is reserved for BullMQ. It does not store sessions.

## Authorization

A signed-in user belongs to one organization.

- Organization admins hold a role with `isOrgWide = true`. They can read every site in that organization.
- Everyone else can read a site only when a `site_memberships` row links them to it.
- A site in another organization is treated as missing (`404`), even if the caller guesses the id.
- A site in the caller's organization without membership returns `403`.
- Missing or invalid tokens return `401`.

Permission keys (`dashboard.read`, `sites.read`, `rooms.write`, `access.manage`, and the rest of the module catalog) are enforced on API controllers through `PermissionsGuard` + `@RequirePermissions(...)`. Organization admins (`isOrgWide`) bypass key checks and receive the full catalog on `/auth/me` for UI gating. Site operators receive the day-to-day key set (not `access.manage`, `settings.manage`, `workflows.manage`, `facilities.write`, or `timeclock.manage`). Site membership still limits which facilities open after a permission check passes.

Every authenticated API call (except health, login, `/auth/me`, and time-clock status polls) is written to `audit_logs` by the global audit interceptor. Sign-ins and access-directory mutations also keep their richer summaries.

## Passwords

Hashes are bcrypt. Login failures use the same response for an unknown email and a wrong password.
