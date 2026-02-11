# Meilisearch Reversal Audit

Date: 2026-02-10  
Branch: `feat/postgres-migration`

## Goal

Confirm that Meilisearch/vector-search integration is not present and lock the codebase to native search only.

## Audit Results

### Compose services and volumes

- Scope checked:
  - `docker-compose.yml`
  - `docker-compose.dev.yml`
- Patterns checked:
  - `meilisearch`
  - `meili_data`
  - `MEILI_`
- Result: no matches.
- Action: keep current Postgres + app + backup sidecar stack.

### Environment variables

- Scope checked:
  - `.env.example`
- Patterns checked:
  - `MEILI_`
  - embedder/vector-specific env keys
- Result: no matches.
- Action: no env cleanup required.

### Dependencies

- Scope checked:
  - `package.json`
  - `package-lock.json`
- Patterns checked:
  - `meilisearch` package name
- Result: no matches.
- Action: no dependency cleanup required.

### Runtime adapters/jobs

- Scope checked:
  - `src/`
  - `scripts/`
- Patterns checked:
  - `meilisearch`
  - `MEILI_`
  - vector/semantic integration hooks
- Result: no matches.
- Action: no runtime cleanup required.

## Reversal Checklist

| Item | Status | Decision |
|---|---|---|
| Remove Meili compose services/volumes | Not applicable | Keep current compose as-is |
| Remove Meili env vars | Not applicable | Keep `.env` surface as-is |
| Remove Meili dependencies | Not applicable | Keep dependency set as-is |
| Remove Meili indexing jobs | Not applicable | Keep current jobs/services |
| Preserve native dashboard search | Complete | Keep `src/dashboard/lib/search/*` and `GlobalSearchModal` flow |
| Preserve telemetry contract | Complete | Keep `/api/search/telemetry` payload and behavior unchanged |
| Add architecture record (ADR) | Complete | Added under `docs/adr/` |
| Add guardrail against reintroduction | Complete | Added `guard:no-meili` script |

## Locked Non-Goals

- No vector/semantic search in this release.
- No bot runtime search refactor in this reversal.
- No external search engine dependency.
