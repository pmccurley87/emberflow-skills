---
name: ember-publish
description: Publish content to Emberflow — automatically picks the right format (document, JSON explorer, or Space) based on your content
argument-hint: [topic, file path, directory, or description of what to publish]
---

# Emberflow Publisher

Publish content to Emberflow at **https://emberflow.ai**. This skill automatically determines the best format based on what you're publishing:

| Content | Published as | Equivalent skill |
|---------|-------------|-----------------|
| A topic or markdown description | Markdown document with Mermaid diagrams | `/ember-publish-doc` |
| JSON data or a `.json` file | Interactive JSON explorer with tree + graph | `/ember-publish-json` |
| A directory of `.md` files | Multi-page docs site (Space) with sidebar nav | `/ember-publish-space` |
| An interactive visual explanation of a concept | Interactive slide-based HTML explainer | `/ember-publish-explainer` |

## How to Decide

1. **If the user asks for an interactive explainer**, visual walkthrough, animated diagram, or slide-based explanation → use the `/ember-publish-explainer` workflow
2. **If the user provides a directory path** or mentions "docs site", "space", or "multi-page" → use the `/ember-publish-space` workflow
3. **If the user provides a `.json` file**, JSON data, or asks to publish JSON/API responses → use the `/ember-publish-json` workflow
4. **Otherwise** (topic description, markdown file, or general documentation request) → use the `/ember-publish-doc` workflow

## Delegation

Once you've determined the content type, follow the full instructions from the appropriate specific skill:

- **Interactive visual explainer** → Follow `/ember-publish-explainer` instructions exactly
- **Markdown documents** → Follow `/ember-publish-doc` instructions exactly
- **JSON data** → Follow `/ember-publish-json` instructions exactly
- **Directory / Space** → Follow `/ember-publish-space` instructions exactly

> **Tip:** If you're unsure, default to `/ember-publish-doc` — it's the most common use case.

## Quick Reference

### Authentication

All three workflows use the same auth. Session tokens are stored at `~/.emberflow/token.json`. Check if a valid session exists:

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

### Publish Endpoints

- **Markdown / JSON**: `POST /api/docs` with `{ slug, title, content, visibility, content_type? }`
- **Spaces**: `POST /api/spaces` then `POST /api/spaces/{id}/publish` with `{ documents, nav }`

### Document URLs

- Documents: `https://emberflow.ai/d/<shortId>/<slug>`
- Spaces: `https://emberflow.ai/s/<author_short_id>/<space_slug>`
