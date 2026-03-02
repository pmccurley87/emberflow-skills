---
name: ember-publish-json
description: Publish JSON data to Emberflow as an interactive explorer with expand/collapse, search, and multi-payload tabs
argument-hint: [JSON file path, API response, or description of data to publish]
---

# Emberflow JSON Publisher

Publish JSON data to Emberflow and view it in an interactive explorer at **https://emberflow.ai** with collapsible tree nodes, property search, copy values/paths, and multi-payload tabs.

## Step 1: Prepare the JSON

Collect the JSON data to publish. This can be:
- A JSON file on disk
- An API response
- Multiple JSON payloads to compare side-by-side

### Multi-Payload Format

To publish multiple JSON payloads as tabs, wrap them in this format:

```json
{
  "payloads": [
    { "label": "API Response", "data": { ... } },
    { "label": "Config", "data": { ... } }
  ]
}
```

If you publish a single JSON value (object, array, etc.) without the wrapper, the explorer will display it as a single "Data" tab.

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

Generate a slug from a title and publish with `content_type: "json"`:

```bash
EMBERFLOW_URL="https://emberflow.ai"
TITLE="My JSON Data"
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')
TOKEN=$(jq -r .token ~/.emberflow/token.json)

# For a single JSON file:
JSON_FILE="/path/to/data.json"
CONTENT=$(cat "$JSON_FILE")

# For multiple payloads, wrap them:
# CONTENT=$(jq -n --argjson a "$(cat file1.json)" --argjson b "$(cat file2.json)" \
#   '{payloads: [{label: "Response", data: $a}, {label: "Config", data: $b}]}')

curl -s -X POST "$EMBERFLOW_URL/api/docs" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "$(jq -n --arg slug "$SLUG" --arg title "$TITLE" --arg content "$CONTENT" \
    '{slug: $slug, title: $title, content: $content, content_type: "json", visibility: "public"}')"
```

The response JSON includes the URL. Documents are viewable at:
- `https://emberflow.ai/d/<shortId>/<slug>`

To **update** an existing JSON document, publish again with the same slug — the API upserts for the same author.

### Other Operations

```bash
# List all your documents
curl -s -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/docs"

# Delete a document
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/docs/SLUG_HERE"
```
