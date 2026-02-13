#!/usr/bin/env bash
# Dispara o workflow preopen-analysis-hk50 via repository_dispatch.
# Requer token com escopo `workflow` em GH_TOKEN.
set -euo pipefail

REPO="andrewsouzandress20-lab/ubuntutrader"
EVENT_TYPE="preopen-hk50-trigger"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "Defina GH_TOKEN com escopo workflow" >&2
  exit 1
fi

curl -sfL \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  "https://api.github.com/repos/${REPO}/dispatches" \
  -d "{\"event_type\":\"${EVENT_TYPE}\"}"

echo "repository_dispatch enviado (event_type=${EVENT_TYPE})"
