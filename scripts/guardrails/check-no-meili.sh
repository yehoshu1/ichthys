#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

has_failure=0

echo "Running guardrail: no Meilisearch integration artifacts"

check_for_pattern() {
    local description="$1"
    local pattern="$2"
    shift 2
    local files=("$@")

    if rg -n --color=never -e "$pattern" "${files[@]}"; then
        echo "FAIL: ${description}"
        has_failure=1
    else
        echo "PASS: ${description}"
    fi
}

check_for_pattern \
    "No Meili env keys in env/compose configuration" \
    "MEILI_" \
    .env.example docker-compose.yml docker-compose.dev.yml

check_for_pattern \
    "No Meilisearch service/dependency declarations in compose or package manifests" \
    "\\bmeilisearch\\b" \
    docker-compose.yml docker-compose.dev.yml package.json package-lock.json

check_for_pattern \
    "No runtime imports of meilisearch package" \
    "from ['\\\"]meilisearch['\\\"]|require\\(['\\\"]meilisearch['\\\"]\\)" \
    src scripts

check_for_pattern \
    "No runtime usage of MEILI_* process env keys" \
    "process\\.env\\.MEILI_" \
    src scripts

if [[ "$has_failure" -ne 0 ]]; then
    echo "Guardrail failed: Meilisearch artifacts detected."
    exit 1
fi

echo "Guardrail passed: Meilisearch integration is not present."
