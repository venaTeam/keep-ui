#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: $0 <github_repo> [branch_or_tag] [output_zip]"
  echo
  echo "Examples:"
  echo "  $0 https://github.com/octocat/Hello-World"
  echo "  $0 octocat/Hello-World main"
  echo "  $0 octocat/Hello-World main hello-world.zip"
}

if [[ $# -lt 1 || $# -gt 3 ]]; then
  usage
  exit 1
fi

repo_input="$1"
ref="${2:-main}"
output_zip="${3:-}"

# Normalize input to owner/repo
if [[ "$repo_input" =~ ^https?://github\.com/([^/]+)/([^/]+?)(\.git)?/?$ ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
elif [[ "$repo_input" =~ ^([^/]+)/([^/]+)$ ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]}"
else
  echo "Error: invalid repository format."
  echo "Use either https://github.com/owner/repo or owner/repo"
  exit 1
fi

if [[ -z "$output_zip" ]]; then
  output_zip="${repo}-${ref}.zip"
fi

download_url="https://github.com/${owner}/${repo}/archive/refs/heads/${ref}.zip"

# Try branch first, then tag fallback.
if ! curl -fL -o "$output_zip" "$download_url"; then
  tag_url="https://github.com/${owner}/${repo}/archive/refs/tags/${ref}.zip"
  echo "Branch '${ref}' not found, trying tag..."
  curl -fL -o "$output_zip" "$tag_url"
fi

echo "Created zip: $output_zip"
