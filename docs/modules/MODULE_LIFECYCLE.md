# Module Lifecycle Runbook

This runbook defines safe procedures to add, disable, and remove modules without breaking unrelated features.

## Add Module

1. Add module manifest entry in `src/shared/modules/registry.ts`:
   - `id`, `commandIds`, `componentPrefixes`, `jobs`, `routes`, `tables`, `requiredEnv`.
2. Add module state integration (if new legacy mapping is needed) in `src/shared/modules/state.ts`.
3. Add command metadata:
   - set `moduleId` on command exports where applicable.
   - use `policy` metadata for creator/channel/permission checks instead of inline command checks.
   - prefer `subcommandMemberPermissions` / `subcommandBotPermissions` for mixed-permission command trees.
4. Register component handlers through `src/bot/components/*` with module binding.
5. Add module gating for dashboard API routes:
   - `requireGuildModuleEnabled(guildId, '<module-id>')`.
6. Add job gating:
   - `isModuleEnabled(guildId, '<module-id>')`.
7. Update dashboard navigation mapping in `src/dashboard/app/dashboard/[guildId]/layout.tsx`.
8. Add/adjust tests:
   - module registry tests and feature-specific route/logic tests.
9. Run full validation:
   - `npm run validate`
   - `npm run dashboard:build`
   - `npm run build`

## Disable Module

1. Toggle module state through modules API:
   - `PUT /api/guilds/[guildId]/modules` (or dashboard modules UI).
   - or `/module disable <module>` in Discord.
2. Verify behavior in all entry points:
   - slash commands return module-disabled response
   - component interactions return module-disabled response
   - API routes return module-disabled response
   - jobs skip processing for disabled guild/module
3. Confirm dashboard navigation hides module sections.

## Remove Module

1. Remove module routes and navigation references.
2. Remove command files and/or command mappings.
3. Remove component registrations and handlers.
4. Remove job scheduling and processing code.
5. Keep or migrate data:
   - if deleting tables, create explicit schema migration and backup first.
6. Remove module manifest entry.
7. Update docs:
   - remove feature docs and command references.
8. Run full validation/build and manual smoke checks.

## Required Guardrails

- Command catalog must remain in sync:
  - `npm run guard:commands`
- Events/polls module route guards must remain enforced:
  - `npm run guard:modules`
- Module route/job ownership must remain declared in manifests:
  - `npm run guard:module-ownership`
- Full guardrail set:
  - `npm run validate`

## Safe Removal Planning

Before deleting module code, run:

- `npm run module:remove:dry-run -- <module-id>`

This reports commands, component handlers, jobs, routes, and tables linked to the module.
