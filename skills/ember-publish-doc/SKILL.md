---
name: ember-publish-doc
description: Publish a markdown document with emberDiagrams to Emberflow for hosted viewing with comments
argument-hint: [topic or description of what to document]
---

# Emberflow Document Publisher

Create a polished markdown document and publish it to Emberflow — a hosted viewer at **https://emberflow.ai** with emberDiagrams (auto-layout interactive diagrams), dark mode, font selection, and per-block commenting.

## Step 1: Create the Markdown File

Write a `.md` file in the current project. The document should follow these conventions:

### Structure
- Start with a single `# Title` as the first line (this becomes the document title and slug)
- Use `##` and `###` for sections — these become commentable blocks in the viewer
- Keep paragraphs concise — each paragraph, list, table, blockquote, and heading is independently commentable by readers

### emberDiagrams

Use inline `<explainer>` blocks for interactive diagrams. The platform auto-lays-out nodes using the dagre graph engine — no manual coordinates needed.

#### Declarative Diagrams (auto-layout)

Set the `<explainer>` type to `diagram` and provide a JSON object with `nodes` and `edges`:

```markdown
<explainer type="diagram">
{
  "nodes": [
    { "id": "client", "label": "Web Client", "style": "blue" },
    { "id": "api", "label": "API Gateway", "style": "orange" },
    { "id": "db", "label": "PostgreSQL", "style": "green", "icon": "database" }
  ],
  "edges": [
    { "from": "client", "to": "api", "label": "REST" },
    { "from": "api", "to": "db" }
  ]
}
</explainer>
```

Node styles: `blue`, `green`, `orange`, `red`, `purple` — these are color-coded with matching borders and tinted backgrounds.

Node icons (optional): `server`, `database`, `browser`, `code`, `cloud`, `lock`, `user`, `file`, `api`, `cpu`, `network`, `zap`, `box`.

For grouped architecture diagrams, add a `groups` array:

```markdown
<explainer type="diagram">
{
  "groups": [
    { "label": "Frontend", "nodes": ["client", "cdn"] },
    { "label": "Backend", "nodes": ["api", "worker", "db"] }
  ],
  "nodes": [
    { "id": "client", "label": "React App", "icon": "browser" },
    { "id": "cdn", "label": "CDN", "icon": "cloud" },
    { "id": "api", "label": "API Server", "icon": "server" },
    { "id": "worker", "label": "Worker", "icon": "cpu" },
    { "id": "db", "label": "Database", "icon": "database" }
  ],
  "edges": [
    { "from": "client", "to": "api" },
    { "from": "cdn", "to": "client" },
    { "from": "api", "to": "worker" },
    { "from": "api", "to": "db" }
  ]
}
</explainer>
```

#### Custom HTML Diagrams

For richer visualisations, use raw HTML with `<style>` and `<script>`:

```markdown
<explainer>
<style>
.my-viz { display: flex; gap: 12px; }
.my-card { padding: 16px; border: 1px solid var(--border); border-radius: 10px; }
</style>
<div class="my-viz">
  <div class="my-card">Step 1</div>
  <div class="my-card">Step 2</div>
</div>
<script>
var cards = container.querySelectorAll('.my-card');
cards.forEach(function(c, i) {
  c.style.opacity = '0';
  setTimeout(function() {
    c.style.transition = 'opacity 0.3s';
    c.style.opacity = '1';
  }, 100 + i * 80);
});
</script>
</explainer>
```

Use CSS custom properties (`var(--bg)`, `var(--text)`, `var(--border)`, `var(--link)`, etc.) for theme compatibility.

### Tables, Code, Blockquotes

Standard GFM (GitHub Flavored Markdown) is fully supported:

```markdown
| Column A | Column B |
|----------|----------|
| value    | value    |

> Blockquotes render with a blue left border

`inline code` and fenced code blocks with syntax highlighting
```

### Example Document

````markdown
# API Architecture Overview

Brief introduction to the system.

## Components

<explainer type="diagram">
{
  "nodes": [
    { "id": "client", "label": "Web Client", "style": "blue", "icon": "browser" },
    { "id": "api", "label": "API Gateway", "style": "orange", "icon": "server" },
    { "id": "auth", "label": "Auth Service", "style": "purple", "icon": "lock" },
    { "id": "docs", "label": "Doc Service", "style": "green", "icon": "file" },
    { "id": "db", "label": "PostgreSQL", "style": "blue", "icon": "database" }
  ],
  "edges": [
    { "from": "client", "to": "api" },
    { "from": "api", "to": "auth" },
    { "from": "api", "to": "docs" },
    { "from": "docs", "to": "db" }
  ]
}
</explainer>

## Data Model

| Entity | Purpose |
|--------|---------|
| Users | Account management |
| Documents | Published content |
| Comments | Discussion threads |

## Design Notes

> We chose event sourcing to maintain a complete audit trail of all state changes.
````

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

## Step 3: Publish

Generate a slug from the document title and publish using the API:

```bash
# Read the file, extract title, generate slug, and publish
EMBERFLOW_URL="https://emberflow.ai"
FILE_PATH="/absolute/path/to/document.md"
TITLE=$(head -1 "$FILE_PATH" | sed 's/^#\s*//')
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')
TOKEN=$(jq -r .token ~/.emberflow/token.json)

curl -s -X POST "$EMBERFLOW_URL/api/docs" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "$(jq -n --arg slug "$SLUG" --arg title "$TITLE" --rawfile content "$FILE_PATH" \
    '{slug: $slug, title: $title, content: $content, visibility: "public"}')"
```

The response JSON includes the URL. Documents are viewable at:
- Public: `https://emberflow.ai/d/<slug>`
- Private: `https://emberflow.ai/d/<slug>?key=<private-key>`

To **update** an existing document, publish again with the same slug — the API upserts for the same author.

> **JSON documents**: You can also publish JSON data by passing `content_type: "json"` in the API payload. The content should be valid JSON (either raw data or the multi-payload format `{"payloads": [{"label": "...", "data": ...}]}`). Use the `/ember-publish-json` skill for a dedicated JSON publishing workflow.

### Other Operations

```bash
# List all your documents
curl -s -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/docs"

# Delete a document
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/docs/SLUG_HERE"
```
