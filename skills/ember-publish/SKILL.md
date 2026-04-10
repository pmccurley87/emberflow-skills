---
name: ember-publish
description: Publish content to Emberflow — automatically picks the right format (document, JSON explorer, or Space) based on your content
argument-hint: [topic, file path, directory, or description of what to publish]
---

# Emberflow Publisher

Publish content to Emberflow at **https://emberflow.ai**. This skill automatically determines the best format based on what you're publishing:

| Content | Published as | Equivalent skill |
|---------|-------------|-----------------|
| A topic or markdown description | Markdown document with emberDiagrams | `/ember-publish-doc` |
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

### Pre-Publish Context

After authenticating, **silently** fetch the user's existing content to inform publish decisions:

```bash
TOKEN=$(jq -r .token ~/.emberflow/token.json)
EMBERFLOW_URL="https://emberflow.ai"

# Fetch existing content (run all three)
EXISTING_DOCS=$(curl -sL -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/docs")
FOLDERS=$(curl -sL -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/folders")
SPACES=$(curl -sL -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/spaces")
```

**Review the results silently. Do NOT present a menu of options.** Apply your judgment and only speak up when it's genuinely worth interrupting the user's flow.

#### When to suggest (examples)

- **Obvious folder match**: User has a folder called "Architecture" and they're publishing an architecture doc → *"I'll put this in your Architecture folder — sound good?"*
- **Sensitive content going public**: The content contains internal URLs, credentials, API keys, or private project names and would default to `public` → *"This looks like internal content — want me to set it to private?"*
- **Relevant existing space**: User has a Space called "API Docs" and they're publishing API reference → suggest adding it to that Space instead of standalone
- **Docs that should be grouped**: User has 3+ standalone docs on the same topic that could become a Space → *"You have a few docs about X — want me to create a Space for them?"*
- **Duplicate slug**: The doc title would generate a slug that matches an existing doc → confirm whether to update or rename

#### When NOT to ask

- The user explicitly told you what to publish and how — just do it
- There are no folders, no spaces, and the content looks routine — publish as `public` with no folder
- The user has very few docs — there's nothing meaningful to organize yet
- The content type and destination are obvious from the user's request

#### Defaults (when nothing stands out)

- `visibility`: `"public"`
- `folder_id`: omit (no folder)
- Publish as standalone doc (not into a space)

#### Passing decisions to sub-skills

When delegating to a sub-skill, include these in your context so the publish API call uses them:

- **`PUBLISH_VISIBILITY`** — `"public"` or `"private"` (default: `"public"`)
- **`PUBLISH_FOLDER_ID`** — UUID of the target folder, or empty (default: empty)
- If adding to a Space, use the `/ember-publish-space` workflow instead of standalone publish

### Publish Endpoints

- **Markdown / JSON / Explainer / Dataset**: `POST /api/docs` with `{ slug, title, content, visibility, content_type?, folder_id? }`
- **Spaces**: `POST /api/spaces` then `POST /api/spaces/{id}/publish` with `{ documents, nav }`

### Document URLs

- Documents: `https://emberflow.ai/d/<shortId>/<slug>`
- Spaces: `https://emberflow.ai/s/<author_short_id>/<space_slug>`
