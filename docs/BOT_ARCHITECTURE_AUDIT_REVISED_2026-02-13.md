# Ixoye Bot Architecture Audit (Revised)

Date: 2026-02-13  
Branch: `feat/modular-architecture-overhaul`

## Executive Summary

The project now has a real module lifecycle foundation:

- Command execution is module-aware and centrally guarded.
- Interactive components are routed through a modular router instead of a monolithic interaction handler.
- Events/polls dashboard APIs and background jobs are module-aware in both write/read and sync paths.
- Event/poll creator role restrictions and default channel settings are now enforced in slash commands.

This is a strong improvement in safety and extensibility.  
The main remaining debt is not in one file anymore; it is now consistency debt across all feature entry points (bot commands, dashboard APIs, jobs, and services) for every module beyond events/polls.

## Current State: Add / Disable / Remove Features

### Add a new command

Difficulty: Easy  
Process:

1. Add command file in `src/bot/commands/`.
2. Register command metadata (`moduleId` on command object, or map in module registry).
3. Run deploy script.

### Add a new interactive feature (buttons/selects/modals)

Difficulty: Medium-Low  
Process:

1. Add handler in `src/bot/components/handlers/`.
2. Register custom-id prefix in component router.
3. Associate module in router registration.

This no longer requires editing a monolithic interaction file.

### Disable a module

Difficulty: Medium  
Now works in these paths:

- Slash commands (central command execution guard)
- Event/poll component interactions
- Event/poll dashboard APIs
- Event/poll jobs (including message sync jobs)

Still requires rollout of the same pattern to all modules/routes/jobs for full consistency.

### Remove a module safely

Difficulty: Medium-High  
Technically possible, but safe removal still needs a runbook:

- Remove command registrations
- Remove component handlers
- Remove job registrations
- Remove API routes/nav entries
- Keep/clean DB tables and migration strategy

The manifest and module-state model now provide a good source of truth for this runbook.

## Implemented in This Branch

### Module architecture foundations

- Module registry + typed module IDs:
  - `src/shared/modules/registry.ts`
- Persistent module state table and resolver:
  - `src/shared/database/schema.ts`
  - `src/shared/modules/state.ts`
- Dashboard module toggle API:
  - `src/dashboard/app/api/guilds/[guildId]/modules/route.ts`
- Dashboard navigation filtered by enabled modules:
  - `src/dashboard/app/dashboard/[guildId]/layout.tsx`

### Bot interaction and command refactor

- Thin interaction entrypoint:
  - `src/bot/events/interactionCreate.ts`
- Component router abstraction:
  - `src/bot/components/component-router.ts`
  - `src/bot/components/handlers/event-components.ts`
  - `src/bot/components/handlers/poll-components.ts`
- Central command guard middleware:
  - `src/bot/services/command-execution-service.ts`
  - `src/bot/types/Command.ts`

### Event/poll policy enforcement

- New shared command-side settings service:
  - `src/bot/services/event-poll-settings-service.ts`
- New command policy middleware + context:
  - `src/bot/services/command-policy-service.ts`
  - `src/bot/services/command-execution-service.ts`
  - `src/bot/types/Command.ts` (`policy` metadata)
- `/create` and `/poll` now use command metadata and middleware policy context:
  - creator role restrictions
  - default channel fallback
  - member/bot send permission checks on resolved channel
  - `src/bot/commands/create.ts`
  - `src/bot/commands/poll.ts`
- Additional commands migrated to centralized policy metadata:
  - `src/bot/commands/settings.ts` (Manage Guild)
  - `src/bot/commands/birthday.ts` (admin/test subcommand member permissions)
  - `src/bot/commands/boost.ts` (setup/claim subcommand member+bot permissions)
  - `src/bot/commands/verify.ts` (bot role-management permission)
- Remaining command-specific creator-or-admin authorization standardized with shared helper:
  - `src/bot/services/resource-authorization-service.ts`
  - `src/bot/commands/delete.ts`

### Module guards in dashboard APIs

- Events settings/templates routes are guarded:
  - `src/dashboard/app/api/guilds/[guildId]/events/settings/route.ts`
  - `src/dashboard/app/api/guilds/[guildId]/events/templates/route.ts`
  - `src/dashboard/app/api/guilds/[guildId]/events/templates/[templateId]/route.ts`
- Poll templates/results routes are guarded:
  - `src/dashboard/app/api/guilds/[guildId]/polls/templates/route.ts`
  - `src/dashboard/app/api/guilds/[guildId]/polls/templates/[templateId]/route.ts`
  - `src/dashboard/app/api/guilds/[guildId]/polls/[pollId]/results/route.ts`
- Added central module gating by API pathname in dashboard auth:
  - `src/shared/modules/route-resolution.ts`
  - `src/dashboard/lib/module-gate.ts`
  - `src/dashboard/lib/guild-auth.ts`
  - `src/dashboard/lib/guild-api-auth.ts`

### Module-aware background jobs

- Existing event/poll jobs were already guarded.
- Added guards to sync jobs:
  - `src/bot/jobs/event-message-sync.ts`
  - `src/bot/jobs/poll-message-sync.ts`
- Added module checks to non-event/poll jobs:
  - verification, boosts, birthdays, role-actions, moderation, notifications, leveling, analytics jobs
  - files under `src/bot/jobs/*.ts` now align with manifest ownership

### Module lifecycle operations

- Added `/module` command for list/enable/disable:
  - `src/bot/commands/module.ts`
- Dashboard settings now exposes module toggles:
  - `src/dashboard/app/dashboard/[guildId]/settings/page.tsx`
- Module toggle writes now emit `action_log` audit entries:
  - `src/shared/modules/admin.ts`
  - `src/dashboard/app/api/guilds/[guildId]/modules/route.ts`

### Shared domain write paths (dashboard)

- Added shared domain services for event/poll writes:
  - `src/shared/services/event-domain-service.ts`
  - `src/shared/services/poll-domain-service.ts`
- Dashboard event/poll write routes now call shared services instead of raw DB writes:
  - `src/dashboard/app/api/guilds/[guildId]/events/route.ts` (POST)
  - `src/dashboard/app/api/guilds/[guildId]/events/[eventId]/route.ts` (PATCH/DELETE)
  - `src/dashboard/app/api/guilds/[guildId]/polls/route.ts` (POST)
  - `src/dashboard/app/api/guilds/[guildId]/polls/[pollId]/route.ts` (PATCH/DELETE)
- Side-effect parity improved in shared path:
  - webhook emission for create/update/delete/close flows
  - Discord artifact cleanup on delete
  - recurring event child creation

### Bot write-path convergence

- Bot services now delegate event/poll writes to shared domain services:
  - `src/bot/services/event-service.ts`
  - `src/bot/services/poll-service.ts`
- This aligns bot command paths with dashboard API paths for:
  - event create/update/delete/repeat/message-id writes
  - poll create/update/options/delete/close/message-id writes
- `/delete` command now uses service-level artifact cleanup instead of command-local Discord message deletion:
  - `src/bot/commands/delete.ts`
- Added domain-level setters to remove remaining direct event table writes in bot flows:
  - `src/shared/services/event-domain-service.ts`
  - adopted in `src/bot/services/event-service.ts`
  - adopted in `src/bot/jobs/event-message-sync.ts`
- Added shared domain helper for custom poll option creation:
  - `src/shared/services/poll-domain-service.ts`
  - adopted in `src/bot/services/poll-service.ts`

### Command catalog and mapping hardening

- Dynamic command catalog + guard script:
  - `src/shared/command-catalog.ts`
  - `scripts/check-command-catalog.ts`
- Module route-guard contract check (events/polls):
  - `scripts/check-module-guards.ts`
- Added missing moderation module mapping for `/role`:
  - `src/shared/modules/registry.ts`
  - `src/bot/commands/role.ts`
- Added module route/job ownership CI guard:
  - `scripts/check-module-ownership.ts`
  - `package.json` (`guard:module-ownership`)

### Test coverage

- Added module registry tests:
  - `src/shared/modules/__tests__/registry.test.ts`
- Added module route resolution tests:
  - `src/shared/modules/__tests__/route-resolution.test.ts`
- Added command catalog tests:
  - `src/shared/__tests__/command-catalog.test.ts`
- Added policy service tests:
  - `src/bot/services/__tests__/event-poll-settings-service.test.ts`
  - `src/bot/services/__tests__/command-policy-service.test.ts`
- Added creator-or-admin auth helper tests:
  - `src/bot/services/__tests__/resource-authorization-service.test.ts`

## Remaining Issues and Redesign Plan

## P1: Complete module enforcement parity across all modules

Goal: every module has consistent gating in:

- commands
- component handlers
- dashboard APIs
- jobs
- any service-level scheduled tasks

Action:

1. Build a module-to-route audit checklist from `MODULE_MANIFESTS`. ✅
2. Fail CI when a module route/job is not declared or not guarded. ✅
3. Keep parity checks in CI as modules/routes/jobs are added.

## P1: Formal module lifecycle runbook

Goal: safe add/disable/remove procedure with no hidden coupling.

Action:

1. Add `docs/modules/MODULE_LIFECYCLE.md`. ✅
2. Add scripts that validate:
   - manifest entries
   - command mappings
   - route ownership
   - job ownership
   Status: implemented (`guard:commands`, `guard:modules`, `guard:module-ownership`).

## P2: Complete shared domain service adoption

Goal: remove remaining split where some advanced bot-only event/poll flows still rely on bot service internals.

Action:

1. Keep bot-only Discord client operations as thin adapters over shared domain writes. ✅
2. Continue migration for any remaining write paths not yet delegated in non-command flows.

## P2: Enforcement policy abstraction

Goal: avoid repeating per-command checks manually.

Action:

1. Add command metadata schema:
   - `moduleId`
   - `policy`: creator roles, channel fallback, permissions
2. Move policy checks to command middleware. ✅
3. Continue adopting `policy` metadata for additional commands that currently have custom inline checks. ✅ (established and applied to current high-risk command paths).

## P3: Safer remove/disable operational tooling

Goal: disable/remove feature with minimal manual risk.

Action:

1. Add `module:disable` admin command + dashboard action that:
   - toggles module state
   - suspends module jobs
   - records audit log event
   Status: implemented via:
   - `/module enable|disable|list` command
   - dashboard `Settings` module toggles
   - module-state audit writes to `action_log`
   - module-aware checks added to non-events/polls jobs
2. Add `module:remove:dry-run` script that lists affected commands/routes/tables. ✅

## Validation Snapshot

Latest branch validation on this revision:

- `npm run typecheck` ✅
- `npm run test` ✅ (81 tests)
- `npm run build` ✅
- `npm run dashboard:build` ✅
- `npm run guard:commands` ✅
- `npm run guard:module-ownership` ✅
- `npm run validate` ✅
