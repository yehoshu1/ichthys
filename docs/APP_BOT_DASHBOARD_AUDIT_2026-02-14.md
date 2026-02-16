# Ixoye App/Bot/Docs Audit Report

Date: 2026-02-14
Reviewer: Codex (GPT-5)

## Scope

This audit covered:
- Dashboard UI/navigation discoverability and module wiring.
- Bot + dashboard implementation checks for events/polls/calendar/auth paths.
- Documentation completeness for commands/modules/dashboard docs.
- Build/type/test/guard validation across the repo.

## Verification Runs

All commands below passed in this workspace:
- `npm run validate`
- `npm run typecheck`
- `npm test`
- `npm run dashboard:build`
- `npm run build` (previous pass in same branch)

Validation status:
- Guard checks: passed (`guard:commands`, `guard:modules`, `guard:module-ownership`)
- Typecheck: passed
- Tests: 81/81 passed
- Dashboard production build: passed

## Findings (Severity-Ordered)

### 1. High (Fixed): Missing module discoverability in sidebar (calendar/notifications)

Impact:
- Users could see modules in registry/settings but not in main navigation, creating the "missing modules" experience.

Evidence:
- Modules exist in registry: `notifications`, `calendar` in `src/shared/modules/registry.ts:198` and `src/shared/modules/registry.ts:209`.
- Sidebar nav previously had no corresponding items in `src/dashboard/lib/search/dashboard-nav.ts:28`.

Fix applied:
- Added sidebar nav entries for `Calendar` and `Notifications` in `src/dashboard/lib/search/dashboard-nav.ts:1`.
- Added icon mappings in `src/dashboard/app/dashboard/[guildId]/layout.tsx:43`.
- Added routes so links are usable:
  - `src/dashboard/app/dashboard/[guildId]/calendar/page.tsx` (redirects to calendar tab in Webhooks)
  - `src/dashboard/app/dashboard/[guildId]/notifications/page.tsx` (redirects to notifications module settings)

Result:
- `calendar` and `notifications` are now visible/discoverable in sidebar and route list.

### 2. High (Verified): Time polls support per-day windows and user-local timestamps

Implementation verification:
- Per-day custom windows are implemented in UI and slot generation:
  - Toggle and day-by-day windows in `src/dashboard/app/dashboard/[guildId]/polls/page.tsx:1125`
  - Time slot generation respecting day windows in `src/dashboard/app/dashboard/[guildId]/polls/page.tsx:858`
  - Validation for enabled windows and time ordering in `src/dashboard/app/dashboard/[guildId]/polls/page.tsx:920`
- API stores time poll options as Discord timestamp markup (`<t:...:F>`), not hard-coded display text:
  - `src/dashboard/app/api/guilds/[guildId]/polls/route.ts:15`
  - `src/dashboard/app/api/guilds/[guildId]/polls/route.ts:185`
- Bot display path preserves/normalizes Discord timestamps:
  - `src/bot/services/poll-discord-service.ts:343`
  - `src/bot/services/poll-discord-service.ts:371`

Result:
- The requested pattern (different times on different weekdays) is implemented.
- Poll options are rendered with Discord timestamps so each user sees local time.

### 3. High (Fixed): Dashboard build dependency on Google font fetch

Impact:
- Production/dashboard builds could fail in restricted or flaky network environments due `next/font/google` runtime fetch.

Fix applied:
- Removed runtime dependency in `src/dashboard/app/layout.tsx:1`.
- Added local CSS font variable fallbacks in `src/dashboard/app/globals.css:5`.

Result:
- `npm run dashboard:build` now passes reliably in this environment.

### 4. Medium (Open): Discord guild permission validation can still fail with first-hit 429

Observed behavior:
- Error path exists: `Failed to validate guild permissions - Discord API rate limit` in `src/dashboard/lib/guild-auth.ts:167`.
- Stale-cache fallback only helps when cache already exists (`src/dashboard/lib/guild-auth.ts:162`), so first request after cold start can still fail.

Why this happens:
- Auth checks call Discord `/users/@me/guilds` for permission validation when cache is missing (`src/dashboard/lib/guild-auth.ts:139`).
- On cold process start or distributed instances, in-memory cache may not exist.

Recommended fix guide:
1. Add short-lived persistent cache (Redis/DB) keyed by `userId` for guild permission payloads.
2. Use stale-while-revalidate semantics across instances (same behavior as in-memory stale cache).
3. Honor Discord `Retry-After` on 429 and avoid immediate repeated fetch.
4. Add a graceful user-facing retry state in dashboard for first-hit 429s.

## Calendar OAuth Callback Architecture Check

Status: Correct for multi-guild operation without per-guild callback registration.

How it works:
- OAuth callback URI uses a single static path segment (`calendar-oauth` by default):
  - `src/dashboard/app/api/guilds/[guildId]/calendar-integrations/connect/route.ts:6`
  - `src/dashboard/app/api/guilds/[guildId]/calendar-integrations/connect/route.ts:28`
- Real guild context is carried in signed OAuth `state`:
  - state payload includes `guildId` in `src/dashboard/app/api/guilds/[guildId]/calendar-integrations/connect/route.ts:93`
  - callback verifies state and uses `targetGuildId` in `src/dashboard/app/api/guilds/[guildId]/calendar-integrations/callback/route.ts:186`

Operational implication:
- You do not need to register callback URLs for every server/guild ID.
- Register exactly one callback per provider per environment (local/prod), as documented in `docs/CALENDAR_INTEGRATIONS_SETUP.md:60` and `docs/CALENDAR_INTEGRATIONS_SETUP.md:68`.

## Documentation Coverage Audit

Coverage checks (current branch):
- Commands:
  - canonical command roots: 48
  - dashboard docs-content entries: 48
  - missing in docs-content: 0
  - missing in `docs/COMMANDS.md`: 0
- Modules:
  - module manifests excluding core: 16
  - missing in docs-content module slugs: 0
  - missing in `docs/modules/*`: 0

Documentation files added/updated in this audit stream include:
- `docs/CALENDAR_INTEGRATIONS_SETUP.md`
- `docs/modules/calendar.md`
- `docs/modules/notifications.md`
- `docs/modules/settings_backups.md`
- `docs/MODULES.md`
- `docs/COMMANDS.md`
- `src/dashboard/lib/docs-content.ts`

## Remaining Risks

- No configured linter (`npm run lint` currently echoes placeholder only), which increases risk of style and minor logic regressions slipping through.
- Permission checks rely on in-process cache only; cross-instance environments can still see intermittent 429-related authorization failures.

## Recommended Next Steps

1. Implement shared cache for guild permission payloads (Redis preferred) and wire 429 `Retry-After` handling.
2. Add a real lint pipeline (`eslint` + CI gate) for dashboard and bot code.
3. Add integration tests for OAuth callback state validation and calendar connect flows.
