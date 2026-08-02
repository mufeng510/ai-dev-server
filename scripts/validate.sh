#!/usr/bin/env bash
set -euo pipefail

script_path="${BASH_SOURCE[0]}"
if [[ "${script_path}" == */* ]]; then
  script_dir="${script_path%/*}"
else
  script_dir="."
fi
script_dir="$(CDPATH= cd -- "${script_dir}" && pwd -P)"
repo_root="$(CDPATH= cd -- "${script_dir}/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'ERROR: node is required to run offline contract validation' >&2
  exit 1
fi

cd "${repo_root}"
node scripts/validate.mjs "$@"
