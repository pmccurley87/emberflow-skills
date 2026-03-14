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

Use inline `<explainer>` blocks for interactive visualisations. **Prefer custom HTML blocks** — they produce more visually striking, varied results. Only use `type="diagram"` for large architecture diagrams with 8+ nodes where auto-layout is genuinely needed.

#### Custom HTML Blocks (preferred)

Write HTML with `<style>` and `<script>` inside an `<explainer>` tag. This gives full creative control over layout, color, icons, and animation.

**Design rules:**
- Use CSS custom properties for theming: `var(--bg)`, `var(--bg-secondary)`, `var(--text)`, `var(--heading)`, `var(--text-muted)`, `var(--border)`, `var(--link)`
- Use inline SVGs with `stroke="currentColor"` for icons (16–20px, stroke-width 1.5)
- Color-code elements: blue `#3b82f6`, purple `#a855f7`, orange `#ea580c`, green `#22c55e`, red `#ef4444`
- Give colored elements a tinted background: `rgba(59,130,246,.1)` for blue, etc.
- Add staggered entrance animations via the `<script>` block
- Use `container` (provided by the platform) to scope all DOM queries

**Pattern: Vertical step flow** — use for sequential processes:

```markdown
<explainer>
<style>
.steps{display:flex;flex-direction:column;gap:0;max-width:400px;margin:0 auto;padding:8px 0}
.step{display:flex;align-items:center;gap:12px;padding:12px 16px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg)}
.step.blue{border-color:#3b82f6}.step.green{border-color:#22c55e}
.step-icon{width:28px;height:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:7px}
.step.blue .step-icon{background:rgba(59,130,246,.1)}
.step.blue .step-icon svg{color:#3b82f6}
.step-icon svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.5}
.step-title{font-size:13px;font-weight:600;color:var(--heading)}
.step-desc{font-size:11px;color:var(--text-muted)}
.conn{display:flex;justify-content:center;padding:2px 0;margin-left:20px}
.conn svg{width:14px;height:14px;stroke:var(--text-muted);fill:none;stroke-width:1.5;opacity:.2}
</style>
<div class="steps">
  <div class="step blue">
    <div class="step-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg></div>
    <div><div class="step-title">First step</div><div class="step-desc">Description here</div></div>
  </div>
  <div class="conn"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7"/></svg></div>
  <div class="step green">
    <div class="step-icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
    <div><div class="step-title">Done</div></div>
  </div>
</div>
<script>
var els = container.querySelectorAll(".step,.conn");
els.forEach(function(el,i){el.style.opacity="0";el.style.transform="translateY(6px)";setTimeout(function(){el.style.transition="all .3s ease-out";el.style.opacity="1";el.style.transform="translateY(0)"},60+i*70)});
</script>
</explainer>
```

**Pattern: Branching grid** — use for decision trees, routing, content type selection:

```markdown
<explainer>
<style>
.tree{display:flex;flex-direction:column;align-items:center;gap:0;padding:8px 0}
.root{padding:10px 18px;border:1.5px solid #ea580c;border-radius:10px;background:var(--bg);font-weight:600;color:var(--heading)}
.branches{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;max-width:360px}
.branch{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg)}
.branch.blue{border-color:#3b82f6}
</style>
<div class="tree">
  <div class="root">Router</div>
  <div class="branches">
    <div class="branch blue">Option A</div>
    <div class="branch">Option B</div>
  </div>
</div>
</explainer>
```

**Pattern: Horizontal flow** — use for pipelines, data flow:

```markdown
<explainer>
<style>
.flow{display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 0}
.node{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px;border:1.5px solid var(--border);border-radius:12px;background:var(--bg)}
.node.blue{border-color:#3b82f6}
.arrow{color:var(--text-muted);opacity:.2;font-size:18px}
</style>
<div class="flow">
  <div class="node blue">Input</div>
  <div class="arrow">&rarr;</div>
  <div class="node">Process</div>
  <div class="arrow">&rarr;</div>
  <div class="node">Output</div>
</div>
</explainer>
```

**Vary your visualisations.** Don't use the same pattern for every diagram in a document. Mix vertical steps, horizontal flows, grids, and file trees depending on what the content calls for.

#### Declarative Diagrams (auto-layout, for complex architectures only)

For diagrams with **8+ nodes and grouped tiers** (e.g., "Frontend / Backend / Data" architecture), use `<explainer type="diagram">` which auto-computes layout via dagre:

```markdown
<explainer type="diagram">
{
  "groups": [
    { "label": "Frontend", "nodes": ["client", "cdn"] },
    { "label": "Backend", "nodes": ["api", "worker", "db"] }
  ],
  "nodes": [
    { "id": "client", "label": "React App", "style": "blue", "icon": "browser" },
    { "id": "cdn", "label": "CDN", "style": "blue", "icon": "cloud" },
    { "id": "api", "label": "API Server", "style": "orange", "icon": "server" },
    { "id": "worker", "label": "Worker", "style": "purple", "icon": "cpu" },
    { "id": "db", "label": "Database", "style": "green", "icon": "database" }
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

Node styles: `blue`, `green`, `orange`, `red`, `purple`. Icons: `server`, `database`, `browser`, `code`, `cloud`, `lock`, `user`, `file`, `api`, `cpu`, `network`, `zap`, `box`.

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

## Request Flow

<explainer>
<style>
.rf-flow{display:flex;align-items:center;justify-content:center;gap:12px;padding:12px 0}
.rf-node{display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px;border:1.5px solid var(--border);border-radius:12px;background:var(--bg);min-width:80px}
.rf-node.blue{border-color:#3b82f6}.rf-node.orange{border-color:#ea580c}.rf-node.green{border-color:#22c55e}
.rf-icon{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:7px}
.rf-node.blue .rf-icon{background:rgba(59,130,246,.1)}
.rf-node.blue .rf-icon svg{color:#3b82f6}
.rf-node.orange .rf-icon{background:rgba(234,88,12,.1)}
.rf-node.orange .rf-icon svg{color:#ea580c}
.rf-node.green .rf-icon{background:rgba(34,197,94,.1)}
.rf-node.green .rf-icon svg{color:#22c55e}
.rf-icon svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.5}
.rf-name{font-size:12px;font-weight:600;color:var(--heading)}
.rf-arrow{color:var(--text-muted);opacity:.2;font-size:18px}
</style>
<div class="rf-flow">
  <div class="rf-node blue"><div class="rf-icon"><svg viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div><span class="rf-name">Client</span></div>
  <div class="rf-arrow">&rarr;</div>
  <div class="rf-node orange"><div class="rf-icon"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="6" rx="1"/><rect x="4" y="14" width="16" height="6" rx="1"/></svg></div><span class="rf-name">API</span></div>
  <div class="rf-arrow">&rarr;</div>
  <div class="rf-node green"><div class="rf-icon"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/></svg></div><span class="rf-name">Database</span></div>
</div>
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
