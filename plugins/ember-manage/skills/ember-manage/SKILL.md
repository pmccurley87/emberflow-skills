---
name: ember-manage
description: Manage your Emberflow account and content — list docs, folders, spaces, check auth status, delete or move documents
argument-hint: [list docs, whoami, delete <slug>, move <slug> to <folder>, list folders, list spaces]
---

# Emberflow Manager

Manage your Emberflow account and published content at **https://www.emberflow.ai**.

## Commands

| Command | What it does |
|---------|-------------|
| `whoami` | Show who you're logged in as |
| `list docs` | List all your published documents |
| `list folders` | List your folders |
| `list spaces` | List your spaces |
| `delete <slug>` | Delete a document by slug |
| `move <slug> to <folder>` | Move a document into a folder |

If the user's request doesn't match a specific command, use your judgment to pick the right action.

## Authentication

Session tokens are stored at `~/.emberflow/token.json`. Check if a valid session exists:

```bash
cat ~/.emberflow/token.json 2>/dev/null
```

If the file exists, verify the token still works:

```bash
curl -s -H "Authorization: Bearer $(jq -r .token ~/.emberflow/token.json)" \
  https://www.emberflow.ai/api/me
```

If no session exists, it's expired, or the verify call returns 401, authenticate using the device flow:

```bash
EMBERFLOW_URL="https://www.emberflow.ai"

# Step 1: Request a device code
RESP=$(curl -s -X POST "$EMBERFLOW_URL/api/device-code")
CODE=$(echo "$RESP" | jq -r .code)
URL=$(echo "$RESP" | jq -r .verification_url)
```

Tell the user to open the URL in their browser to sign in and approve the device. Then poll until approved:

```bash
# Step 2: Poll until approved (every 3s)
while true; do
  STATUS=$(curl -s "$EMBERFLOW_URL/api/device-code/$CODE")
  S=$(echo "$STATUS" | jq -r .status)
  if [ "$S" = "approved" ]; then
    TOKEN=$(echo "$STATUS" | jq -r .session_token)
    mkdir -p ~/.emberflow
    echo "{\"token\":\"$TOKEN\"}" > ~/.emberflow/token.json
    break
  fi
  if [ "$S" = "expired" ]; then
    echo "Code expired. Please try again."
    break
  fi
  sleep 3
done
```

## API Reference

All requests require the Authorization header:

```bash
TOKEN=$(jq -r .token ~/.emberflow/token.json)
EMBERFLOW_URL="https://www.emberflow.ai"
```

### whoami

```bash
curl -s -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/me"
```

Returns: `{ email, name, short_id, profile_url, created_at }`

Present this cleanly to the user, e.g.:
- **Email**: patrick@example.com
- **Profile**: https://www.emberflow.ai/@tbnb203

### list docs

```bash
curl -sL -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/docs"
```

Returns an array of documents with `slug`, `title`, `visibility`, `folder_id`, `url`, `created_at`, `updated_at`.

Present as a table:

| Title | Visibility | URL | Updated |
|-------|-----------|-----|---------|
| ... | public | ... | ... |

### list folders

```bash
curl -sL -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/folders"
```

Returns an array with `id`, `name`, `doc_count`, `created_at`.

### list spaces

```bash
curl -sL -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/spaces"
```

Returns an array with `slug`, `title`, `visibility`, `nav_count` (number of pages), `url`, `updated_at`.

### delete doc

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/docs/SLUG"
```

**Always confirm with the user before deleting.** Show the document title and URL first.

### move doc to folder

To move a document into a folder, first look up the folder ID from `list folders`, then PATCH the document:

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$EMBERFLOW_URL/api/docs/SHORT_ID/SLUG" \
  -d '{"folder_id": "FOLDER_UUID"}'
```

To remove a document from its folder, set `folder_id` to `null`.

### update doc visibility

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$EMBERFLOW_URL/api/docs/SHORT_ID/SLUG" \
  -d '{"visibility": "private"}'
```

### create folder

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$EMBERFLOW_URL/api/folders" \
  -d '{"name": "Folder Name"}'
```

### delete folder

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/folders/FOLDER_UUID"
```

## Presentation

- Always present results in clean, readable tables or lists
- For URLs, show the full clickable link
- For timestamps, show relative time (e.g., "2 hours ago") alongside the date
- If there are no results, say so clearly (e.g., "You have no published documents yet")
- For destructive actions (delete), always confirm with the user first
