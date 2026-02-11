# ADR 0001: Defer Meilisearch / Vector Search Integration

- Status: Accepted
- Date: 2026-02-10
- Owners: Ixoye maintainers

## Context

Ixoye currently provides dashboard search through an in-process index built from
existing settings sources and static docs metadata. A proposal was raised to add
Meilisearch and semantic/vector search in this cycle.

## Decision

For the current cycle, Ixoye will not introduce Meilisearch or any other
external vector search service.

The supported search architecture is:

- Local/in-process index builder in dashboard runtime.
- Existing PostgreSQL-backed data retrieval for source records.
- Existing telemetry endpoint and payload contract.

Semantic/vector search is deferred.

## Rationale

- Current search quality and speed are acceptable for present traffic.
- External search infra adds operational overhead (service lifecycle, backups,
  health checks, secrets, deployment risk) without a current product need.
- Keeping search local avoids a new source-of-truth split and reduces failure
  modes.

## Consequences

- No compose services, environment variables, or runtime dependencies for
  Meilisearch are introduced.
- Search UX and API response shapes remain stable.
- Future semantic search can be revisited with a separate RFC/ADR.

## Revisit Triggers

Re-open this decision when any of the following are true:

- Search latency/relevance becomes a user-visible problem.
- Product requirements mandate semantic retrieval.
- Query volume outgrows practical in-process indexing.
