#!/usr/bin/env bash
# Releases through the REST API. Replaces 'gh release create/upload', which answer HTTP 403 for GITHUB_TOKEN since 2026-11-01
# although direct API calls with the same token succeed (release-test.yml).
#   release.sh create <tag> <target sha> <title> <notes> [files...]   draft -> upload assets -> publish
#   release.sh upload <tag> [files...]                                 add or replace assets of a published release
# Needs GH_TOKEN and GITHUB_REPOSITORY.
set -euo pipefail
api="repos/$GITHUB_REPOSITORY/releases"
put() {  # <release id> <file>: replace an asset of the same name
  local id="$1" f="$2" name old
  name=$(basename "$f")
  old=$(gh api "$api/$id/assets" --paginate --jq ".[] | select(.name == \"$name\") | .id")
  [ -n "$old" ] && gh api -X DELETE "$api/assets/$old"
  curl -sSf --retry 3 -X POST -H "Authorization: Bearer $GH_TOKEN" -H "Content-Type: application/octet-stream" --upload-file "$f" \
    "https://uploads.github.com/$api/$id/assets?name=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$name")" >/dev/null
  echo "uploaded $name"
}
case "$1" in
  create)
    tag="$2"; target="$3"; title="$4"; notes="$5"; shift 5
    id=$(gh api "$api" -f tag_name="$tag" -f target_commitish="$target" -f name="$title" -f body="$notes" -F draft=true --jq .id)
    for f in "$@"; do put "$id" "$f"; done
    gh api -X PATCH "$api/$id" -F draft=false --jq .html_url ;;
  upload)
    tag="$2"; shift 2
    id=$(gh api "$api/tags/$tag" --jq .id)
    for f in "$@"; do put "$id" "$f"; done ;;
  *) echo "usage: release.sh create|upload ..." >&2; exit 2 ;;
esac
