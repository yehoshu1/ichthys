# Ixoye Comprehensive Codebase Review (2026-02-13)

## Scope and method
- Static code review across bot + dashboard + shared schema.
- Command/API/security path inspection focused on events, polls, webhooks, API keys, and calendar integrations.
- Build/test/typecheck verification.

## Verification results
- `bun run build` (bot): pass.
- `bun test`: pass (58 tests, dashboard utility-focused).
- `bunx tsc -p tsconfig.json --noEmit`: fail (pre-existing dashboard/API unused-symbol errors).
- `bun run dashboard:build`: fail (`EACCES` on `src/dashboard/.next` owned by `root`).

## Executive summary
- Critical security and authorization issues exist in guild-scoped dashboard APIs.
- Webhook and calendar integration implementations are partially wired and internally inconsistent.
- Dashboard routes bypass bot services in several places, causing behavior drift and missed side effects (Discord sync, webhook emission).
- Several feature areas are incomplete (calendar OAuth/sync flow, templates management parity, webhook event parity).

## Findings

### Critical

1) Missing guild authorization on multiple guild-scoped routes
- Type: Security vulnerability
- Evidence:
  - `src/dashboard/app/api/guilds/[guildId]/webhooks/route.ts:43`
  - `src/dashboard/app/api/guilds/[guildId]/webhooks/[webhookId]/route.ts:33`
  - `src/dashboard/app/api/guilds/[guildId]/webhooks/[webhookId]/test/route.ts:15`
  - `src/dashboard/app/api/guilds/[guildId]/webhooks/[webhookId]/logs/route.ts:14`
  - `src/dashboard/app/api/guilds/[guildId]/api-keys/route.ts:25`
  - `src/dashboard/app/api/guilds/[guildId]/api-keys/[keyId]/route.ts:14`
  - `src/dashboard/app/api/guilds/[guildId]/polls/[pollId]/route.ts:21`
  - `src/dashboard/app/api/guilds/[guildId]/polls/[pollId]/results/route.ts:15`
  - `src/dashboard/app/api/guilds/[guildId]/polls/templates/route.ts:14`
  - `src/dashboard/app/api/guilds/[guildId]/calendar-integrations/route.ts:14`
  - `src/dashboard/app/api/guilds/[guildId]/calendar-integrations/[integrationId]/route.ts:14`
- Impact: Session-only auth lets any logged-in user hit routes with arbitrary `guildId` path values.
- Fix:
  - Replace `getServerSession`-only checks with `authorizeGuildApiRequest(...)` or `requireGuildManageAccess(...)`.
  - For API-key-enabled routes, enforce permission matrix (`webhooks:read/write`, etc.).

2) OAuth calendar tokens stored plaintext in DB
- Type: Security vulnerability
- Evidence:
  - `src/shared/database/schema.ts:1126`
  - `src/shared/database/schema.ts:1127`
- Impact: DB compromise exposes live provider tokens.
- Fix:
  - Encrypt `accessToken`/`refreshToken` at rest (envelope encryption, AES-GCM + key rotation support).
  - Add token redaction in logs/responses.

### High

3) Webhook secret handling is internally inconsistent (hash vs HMAC secret)
- Type: Broken feature + security design bug
- Evidence:
  - Secrets hashed on write:
    - `src/dashboard/app/api/guilds/[guildId]/webhooks/route.ts:136`
    - `src/dashboard/app/api/guilds/[guildId]/webhooks/[webhookId]/route.ts:107`
  - Hashed value used as HMAC key:
    - `src/bot/services/webhook-service.ts:79`
    - `src/dashboard/app/api/guilds/[guildId]/webhooks/[webhookId]/test/route.ts:51`
- Impact: Consumers cannot verify signatures using the originally entered secret.
- Fix:
  - Use encrypted secret-at-rest (decrypt at send time), not one-way hash.
  - If one-way hash is required, remove signature feature or redesign to avoid needing plaintext secret.

4) Dashboard event updates/deletes bypass mirror cleanup and webhook side effects
- Type: Broken feature
- Evidence:
  - Dashboard updates/deletes directly in route:
    - `src/dashboard/app/api/guilds/[guildId]/events/[eventId]/route.ts:101`
    - `src/dashboard/app/api/guilds/[guildId]/events/[eventId]/route.ts:140`
  - Bot service contains required mirror sync logic:
    - `src/bot/services/event-service.ts:275`
    - `src/bot/services/event-service.ts:302`
- Impact: Dashboard edits/deletes can leave orphaned Discord scheduled events and stale Discord event messages.
- Fix:
  - Route handlers should call a shared event service method (or dedicated domain layer) instead of raw DB mutation.
  - Emit event lifecycle webhooks from the same shared path.

5) Dashboard poll closing/editing does not reliably sync embed state
- Type: Broken feature
- Evidence:
  - Route can set `closed`:
    - `src/dashboard/app/api/guilds/[guildId]/polls/[pollId]/route.ts:197`
  - Poll sync job ignores already-closed polls for update path:
    - `src/bot/jobs/poll-message-sync.ts:88`
- Impact: Closing/editing via dashboard may not reflect in Discord message/components immediately or at all.
- Fix:
  - Add explicit sync trigger on dashboard PATCH.
  - Expand sync job to handle recently-closed polls with message IDs.

6) Webhook event catalog advertises events not emitted by backend
- Type: Incomplete feature
- Evidence:
  - UI advertises `event.updated`, `event.deleted`, `event.started`, `poll.created`:
    - `src/dashboard/app/dashboard/[guildId]/webhooks/page.tsx:142`
    - `src/dashboard/app/dashboard/[guildId]/webhooks/page.tsx:143`
    - `src/dashboard/app/dashboard/[guildId]/webhooks/page.tsx:144`
    - `src/dashboard/app/dashboard/[guildId]/webhooks/page.tsx:148`
  - Service emits `event.created`, RSVP events, `poll.voted`, `poll.closed` only:
    - `src/bot/services/event-service.ts:132`
    - `src/bot/services/event-service.ts:454`
    - `src/bot/services/poll-service.ts:251`
    - `src/bot/services/poll-service.ts:341`
- Impact: Silent expectation mismatch for integrators.
- Fix:
  - Emit full advertised set on create/update/delete/start flows.
  - Or remove unsupported options from UI/docs until implemented.

7) Calendar integration connect flow is missing
- Type: Missing feature
- Evidence:
  - UI links to `/calendar-integrations/connect?...`:
    - `src/dashboard/app/dashboard/[guildId]/webhooks/page.tsx:1339`
    - `src/dashboard/app/dashboard/[guildId]/webhooks/page.tsx:1365`
    - `src/dashboard/app/dashboard/[guildId]/webhooks/page.tsx:1424`
  - No connect route exists under `src/dashboard/app/api/guilds/[guildId]/calendar-integrations/`.
- Impact: Google/Outlook/Apple connect CTA cannot complete.
- Fix:
  - Implement provider-specific OAuth start + callback routes.
  - Persist encrypted tokens, account IDs, and integration metadata.

8) Calendar feed token design is weak and likely path-mismatched with `.ics`
- Type: Security vulnerability + broken feature risk
- Evidence:
  - URL generation appends `.ics`:
    - `src/bot/services/calendar-service.ts:174`
  - Token validation expects raw token only:
    - `src/bot/services/calendar-service.ts:177`
    - `src/dashboard/app/api/calendar/[userId]/[token]/route.ts:13`
  - Secret fallback:
    - `src/bot/services/calendar-service.ts:170`
- Impact: Feeds may fail validation; deterministic tokens are non-rotatable and weaker if env secret is default.
- Fix:
  - Use random per-user feed tokens stored in DB (rotatable/revocable).
  - Remove default secret fallback; require configured secret.
  - Align route format (`[token].ics` style route or strip suffix before validation).

### Medium

9) SSRF defense for webhook URLs is incomplete
- Type: Security vulnerability
- Evidence:
  - Hostname-only private-IP block without DNS resolution/redirect revalidation:
    - `src/dashboard/app/api/guilds/[guildId]/webhooks/route.ts:125`
    - `src/dashboard/app/api/guilds/[guildId]/webhooks/[webhookId]/route.ts:87`
- Impact: DNS rebinding/redirect chains can bypass checks.
- Fix:
  - Resolve A/AAAA and block private, loopback, link-local, multicast, reserved ranges.
  - Re-validate final resolved destination after redirects.
  - Disable redirects or allowlist domains.

10) API key hashes are returned to clients and rendered in UI
- Type: Security weakness
- Evidence:
  - Full key rows returned:
    - `src/dashboard/app/api/guilds/[guildId]/api-keys/route.ts:42`
  - Hash prefix displayed:
    - `src/dashboard/app/dashboard/[guildId]/webhooks/page.tsx:1040`
- Impact: Hash disclosure increases offline attack surface and unnecessary credential metadata exposure.
- Fix:
  - Never return `keyHash` after creation.
  - Return non-sensitive metadata only.

11) Calendar integrations are mostly CRUD placeholders, not full sync
- Type: Incomplete feature
- Evidence:
  - Only list/toggle/delete routes present:
    - `src/dashboard/app/api/guilds/[guildId]/calendar-integrations/route.ts:8`
    - `src/dashboard/app/api/guilds/[guildId]/calendar-integrations/[integrationId]/route.ts:8`
  - No import/export sync workers or provider API calls found.
- Impact: Feature appears shipped but does not sync calendars.
- Fix:
  - Add sync workers + provider clients + retry/backoff + conflict policy.
  - Wire `syncDirection` and guild include/exclude filters to actual sync logic.

12) Event recurrence behavior diverges between slash command and dashboard
- Type: Broken/inconsistent behavior
- Evidence:
  - Slash command creates repeating instances:
    - `src/bot/commands/create.ts:285`
  - Dashboard create route inserts single row only:
    - `src/dashboard/app/api/guilds/[guildId]/events/route.ts:208`
- Impact: Different results depending on creation surface.
- Fix:
  - Centralize event creation in one service path and call it from both command and dashboard API.

13) No event completion automation
- Type: Incomplete feature / dead logic
- Evidence:
  - Completion method exists but is unused:
    - `src/bot/services/event-service.ts:736`
  - No job references `markEventAsCompleted`.
- Impact: Events can remain `ACTIVE` indefinitely, affecting filtering and analytics.
- Fix:
  - Add scheduled completion job (or status-on-read transition), and emit `event.completed` if desired.

14) Business logic drift: dashboard routes bypass bot services
- Type: Architectural improvement opportunity
- Evidence:
  - Raw DB event create/update/delete in dashboard routes:
    - `src/dashboard/app/api/guilds/[guildId]/events/route.ts:208`
    - `src/dashboard/app/api/guilds/[guildId]/events/[eventId]/route.ts:101`
  - Equivalent bot service includes extra logic (Discord sync/webhooks/waitlist/etc.):
    - `src/bot/services/event-service.ts:116`
- Impact: Regressions recur when one path is fixed and the other is not.
- Fix:
  - Extract shared domain services used by both bot commands and dashboard APIs.

15) Poll/event templates only partially implemented (CRUD parity missing)
- Type: Incomplete feature
- Evidence:
  - Event templates API has GET/POST only:
    - `src/dashboard/app/api/guilds/[guildId]/events/templates/route.ts:17`
    - `src/dashboard/app/api/guilds/[guildId]/events/templates/route.ts:45`
  - Poll templates API has GET/POST only:
    - `src/dashboard/app/api/guilds/[guildId]/polls/templates/route.ts:8`
    - `src/dashboard/app/api/guilds/[guildId]/polls/templates/route.ts:37`
- Impact: Cannot edit/delete templates from dashboard.
- Fix:
  - Add `[templateId]/route.ts` with PATCH/DELETE and matching UI controls.

16) Dashboard poll/event deletion likely leaves orphan Discord messages
- Type: Broken feature
- Evidence:
  - Dashboard delete routes remove DB rows directly:
    - `src/dashboard/app/api/guilds/[guildId]/events/[eventId]/route.ts:140`
    - `src/dashboard/app/api/guilds/[guildId]/polls/[pollId]/route.ts:297`
  - Discord message delete logic exists only in bot services:
    - `src/bot/services/event-discord-service.ts:221`
    - `src/bot/services/poll-discord-service.ts:258`
- Impact: Stale embeds/buttons remain in channels.
- Fix:
  - Invoke shared delete service that removes Discord artifacts before DB deletion.

17) Default secrets in production code paths
- Type: Security vulnerability
- Evidence:
  - Calendar secret fallback:
    - `src/bot/services/calendar-service.ts:170`
  - Anonymous poll secret fallback:
    - `src/bot/services/poll-service.ts:21`
- Impact: Predictable behavior across deployments when env vars are omitted.
- Fix:
  - Fail fast on startup if required secrets are missing.
  - Add env validation and deployment checks.

### Low

18) Dead/unused code and compile hygiene issues
- Type: Dead code / maintainability
- Evidence:
  - Unused slash option in `/link`:
    - `src/bot/commands/link.ts:13`
  - Pre-existing unused imports/vars causing typecheck failure (multiple files listed by `tsc`).
- Impact: Noise, reduced confidence in CI signal.
- Fix:
  - Remove unused options/imports/state.
  - Keep dashboard `tsc` green in CI.

19) Production logging style inconsistency (`console.*` in runtime services)
- Type: Improvement
- Evidence:
  - `src/bot/services/event-discord-service.ts:216`
  - `src/bot/services/poll-discord-service.ts:253`
  - `src/bot/services/event-discord-service.ts:234`
  - `src/bot/services/poll-discord-service.ts:271`
- Impact: Harder log aggregation and severity control.
- Fix:
  - Replace with centralized logger and structured context.

20) Public debug env endpoint discloses environment presence flags
- Type: Security hardening opportunity
- Evidence:
  - `src/dashboard/app/api/debug/env/route.ts:7`
- Impact: Minor information disclosure useful for recon.
- Fix:
  - Restrict to development or admin-authenticated access.

21) Dashboard build blocked by file ownership
- Type: Operational issue
- Evidence:
  - `src/dashboard/.next` owned by `root`; local build fails with EACCES.
- Impact: Prevents local validation and CI parity.
- Fix:
  - Correct ownership/permissions and avoid running build steps as root on shared workdir.

## Priority remediation plan

### Phase 1 (Immediate: security + auth)
- Enforce guild-level auth on all guild routes currently session-only.
- Fix webhook secret model (encrypted plaintext-at-rest for signing).
- Remove default secret fallbacks and validate required env vars on startup.
- Harden webhook URL SSRF protections.

### Phase 2 (Behavior correctness)
- Route all dashboard event/poll mutations through shared service methods.
- Ensure dashboard close/edit/delete operations sync Discord messages/events.
- Emit full webhook lifecycle events that UI advertises.

### Phase 3 (Calendar completion)
- Implement `/calendar-integrations/connect` OAuth + callback flows.
- Build actual provider sync workers (Google/Microsoft first), retries, token refresh, conflict handling.
- Replace deterministic calendar feed token with rotatable per-user token.

### Phase 4 (Quality/perf)
- Resolve dashboard typecheck errors.
- Remove dead code/unused symbols and unify logging.
- Optimize N+1 query patterns in events/polls list endpoints.

## Suggested acceptance criteria
- Dashboard `tsc --noEmit` passes.
- All guild routes enforce guild auth.
- Webhook signatures verifiable with configured secret.
- Dashboard event/poll CRUD keeps Discord artifacts in sync.
- Calendar connect and sync flows pass end-to-end manual test for Google + Outlook.
- Webhook events emitted match selectable event types in UI.
