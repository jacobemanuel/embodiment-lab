#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found in PATH" >&2
  exit 1
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN is required" >&2
  exit 1
fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "SUPABASE_DB_PASSWORD is required" >&2
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
if [[ -z "${PROJECT_REF}" ]]; then
  PROJECT_REF="$(awk -F'\"' '/project_id/ { print $2 }' supabase/config.toml)"
fi

if [[ -z "${PROJECT_REF}" ]]; then
  echo "SUPABASE_PROJECT_REF is required (or set project_id in supabase/config.toml)" >&2
  exit 1
fi

echo "Linking Supabase project ${PROJECT_REF}"
supabase link --project-ref "${PROJECT_REF}"

echo "Pushing migrations"
supabase db push --project-ref "${PROJECT_REF}"

echo "Deploying edge functions"
supabase functions deploy save-study-data --project-ref "${PROJECT_REF}"
supabase functions deploy save-avatar-time --project-ref "${PROJECT_REF}"
supabase functions deploy owner-edit-session --project-ref "${PROJECT_REF}"
