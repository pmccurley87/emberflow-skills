---
name: ember-publish-space
description: Publish a directory of markdown files as an Emberflow Space — a multi-page docs site with sidebar navigation
argument-hint: [directory path or file list]
---

# Emberflow Space Publisher

Publish a collection of markdown files as an **Emberflow Space** — a multi-page docs site at **https://emberflow.ai** with sidebar navigation, emberDiagrams, dark mode, and per-block commenting.

Each markdown page in a Space supports inline `<explainer>` diagram blocks — use `<explainer type="diagram">` for auto-layout architecture diagrams, or raw HTML `<explainer>` blocks for custom visualisations. See the `/ember-publish-doc` skill for the full emberDiagrams syntax reference.

## Step 1: Collect Files

Accept a directory path or explicit file list from the user. Scan for `.md` files:

```bash
# Example: find all markdown files in a directory
DOCS_DIR="/path/to/docs"
find "$DOCS_DIR" -name "*.md" -type f | sort
```

For each `.md` file:
- Extract the title from the first `# Title` line
- Generate a slug from the title: lowercase, replace non-alphanumeric runs with `-`, trim leading/trailing `-`
- Note the parent directory name (if in a subdirectory) — this becomes a nav section

### Directory Structure Mapping

```
docs/
  getting-started.md    → top-level page
  api-reference.md      → top-level page
  guides/
    authentication.md   → page under "Guides" section
    deployment.md       → page under "Guides" section
```

## Step 2: Authenticate (if needed)

Session tokens are stored at `~/.emberflow/token.json`. Check if a valid session exists:

```bash
cat ~/.emberflow/token.json 2>/dev/null
```

If the file exists, verify the token still works:

```bash
curl -s -H "Authorization: Bearer $(jq -r .token ~/.emberflow/token.json)" \
  https://emberflow.ai/api/docs
```

If no session exists, it's expired, or the verify call returns 401, authenticate using the device flow:

```bash
EMBERFLOW_URL="https://emberflow.ai"

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

## Step 3: Create or Select Space

First, check if the user wants to publish to an existing space or create a new one:

```bash
TOKEN=$(jq -r .token ~/.emberflow/token.json)
EMBERFLOW_URL="https://emberflow.ai"

# List existing spaces
curl -s -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/spaces"
```

If creating a new space:

```bash
# Generate name and slug from directory name or user input
SPACE_NAME="My Docs"
SPACE_SLUG=$(echo "$SPACE_NAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')

SPACE_RESP=$(curl -s -X POST "$EMBERFLOW_URL/api/spaces" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg name "$SPACE_NAME" --arg slug "$SPACE_SLUG" \
    '{name: $name, slug: $slug}')")

SPACE_ID=$(echo "$SPACE_RESP" | jq -r .id)
```

If using an existing space, extract its `id` from the list response.

## Step 4: Build Payload and Batch Publish

Build the `documents` and `nav` arrays, then call the batch publish endpoint.

The API expects:
- `documents[]`: array of `{ slug, title, content }` — each doc is upserted by slug
- `nav[]`: array of nav items:
  - Sections: `{ type: "section", label: "Section Name" }`
  - Pages: `{ type: "page", label: "Page Title", slug: "page-slug" }` — top-level
  - Pages in sections: `{ type: "page", label: "Page Title", slug: "page-slug", parent_label: "Section Name" }`

```bash
TOKEN=$(jq -r .token ~/.emberflow/token.json)
EMBERFLOW_URL="https://emberflow.ai"
DOCS_DIR="/path/to/docs"

# Build the JSON payload with jq
# For each .md file: read content, extract title, generate slug, determine section

DOCUMENTS="[]"
NAV="[]"
SECTIONS_ADDED=""

for file in $(find "$DOCS_DIR" -name "*.md" -type f | sort); do
  # Extract title and slug
  TITLE=$(head -1 "$file" | sed 's/^#\s*//')
  SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')
  CONTENT=$(cat "$file")

  # Determine if in a subdirectory (becomes a section)
  REL_PATH=$(realpath --relative-to="$DOCS_DIR" "$file")
  DIR_NAME=$(dirname "$REL_PATH")

  # Add document
  DOCUMENTS=$(echo "$DOCUMENTS" | jq --arg slug "$SLUG" --arg title "$TITLE" --rawfile content "$file" \
    '. + [{slug: $slug, title: $title, content: $content}]')

  if [ "$DIR_NAME" = "." ]; then
    # Top-level page
    NAV=$(echo "$NAV" | jq --arg label "$TITLE" --arg slug "$SLUG" \
      '. + [{type: "page", label: $label, slug: $slug}]')
  else
    # Page under a section
    SECTION_LABEL=$(echo "$DIR_NAME" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')

    # Add section if not already added
    if ! echo "$SECTIONS_ADDED" | grep -qF "$SECTION_LABEL"; then
      NAV=$(echo "$NAV" | jq --arg label "$SECTION_LABEL" \
        '. + [{type: "section", label: $label}]')
      SECTIONS_ADDED="$SECTIONS_ADDED|$SECTION_LABEL"
    fi

    NAV=$(echo "$NAV" | jq --arg label "$TITLE" --arg slug "$SLUG" --arg parent "$SECTION_LABEL" \
      '. + [{type: "page", label: $label, slug: $slug, parent_label: $parent}]')
  fi
done

# Write payload to temp file (handles large doc sets)
jq -n --argjson documents "$DOCUMENTS" --argjson nav "$NAV" \
  '{documents: $documents, nav: $nav}' > /tmp/emberflow-publish.json

# Publish
RESULT=$(curl -s -X POST "$EMBERFLOW_URL/api/spaces/$SPACE_ID/publish" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/emberflow-publish.json)

echo "$RESULT"
rm -f /tmp/emberflow-publish.json
```

## Step 5: Output Result

The API response includes:
```json
{
  "published": true,
  "url": "https://emberflow.ai/s/<author_short_id>/<space_slug>",
  "document_count": 5
}
```

Show the user:
- The Space URL
- Number of documents published
- The nav structure that was created

To **update** an existing space, publish again to the same space — documents are upserted by slug, and nav items are recreated.

### Other Operations

```bash
# List your spaces
curl -s -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/spaces"

# Delete a space
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/spaces/SPACE_ID_HERE"
```
