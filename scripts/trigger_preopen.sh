#!/usr/bin/env bash
# Dispara o workflow preopen-analysis via repository_dispatch ou workflow_dispatch.
# Requer token com escopo `workflow` em GH_TOKEN.
set -euo pipefail

REPO="andrewsouzandress20-lab/ubuntutrader"
WORKFLOW="preopen-analysis.yml"
REF="main"
EVENT_TYPE="preopen-trigger"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "Defina GH_TOKEN com escopo workflow" >&2
  exit 1
fi

# Opção 1: repository_dispatch (usa EVENT_TYPE). Ideal para cron-job.org/Cloudflare Workers.
curl -sfL \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  "https://api.github.com/repos/${REPO}/dispatches" \
  -d "{\"event_type\":\"${EVENT_TYPE}\"}"

echo "repository_dispatch enviado (event_type=${EVENT_TYPE})"

# Opção 2: workflow_dispatch direto (descomente se preferir)
# curl -sfL \
#   -X POST \
#   -H "Accept: application/vnd.github+json" \
#   -H "Authorization: Bearer ${GH_TOKEN}" \
#   "https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches" \
#   -d "{\"ref\":\"${REF}\"}"
# echo "workflow_dispatch enviado (workflow=${WORKFLOW}, ref=${REF})"
