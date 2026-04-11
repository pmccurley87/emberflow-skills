---
name: ember-publish-dataset
description: Publish one or more CSV files to Emberflow as an interactive dataset viewer with multi-table tabs, search, sort, filter, pagination, and CSV export
argument-hint: [CSV file path(s) and a title]
---

# Emberflow Dataset Publisher

Publish tabular CSV data to Emberflow at **https://emberflow.ai** as an interactive dataset viewer with:
- Multi-table tabs (one per CSV file)
- Cross-column search with highlighted matches
- Click-to-sort on any column (asc/desc)
- Column show/hide filter
- Paginated rows (100 per page)
- CSV export of filtered data

## Step 1: Prepare your CSV files

Each CSV file becomes one tab in the viewer. The first row is treated as column headers. Example:

```
Region,Q1,Q2,Total
North America,142000,158000,300000
Europe,98000,112000,210000
```

## Step 2: Authenticate (if needed)

Session tokens are stored at `~/.emberflow/token.json`. Check if a valid session exists:

```bash
cat ~/.emberflow/token.json 2>/dev/null
```

If no session exists or the token is expired, authenticate using the device flow:

```bash
EMBERFLOW_URL="https://emberflow.ai"

# Step 1: Request a device code
RESP=$(curl -s -X POST "$EMBERFLOW_URL/api/device-code")
CODE=$(echo "$RESP" | jq -r .code)
URL=$(echo "$RESP" | jq -r .verification_url)
echo "Open in browser: $URL"
```

Tell the user to open the URL and sign in. Then poll until approved:

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
  if [ "$S" = "expired" ]; then echo "Code expired. Try again."; break; fi
  sleep 3
done
```

## Step 3: Build and publish the dataset

Parse each CSV and build the dataset JSON, then POST with `content_type: "dataset"`.

### Data format

```json
{
  "tables": [
    {
      "name": "Sales by Region",
      "columns": ["Region", "Q1", "Q2", "Total"],
      "rows": [
        ["North America", 142000, 158000, 300000],
        ["Europe", 98000, 112000, 210000]
      ]
    }
  ]
}
```

- `columns`: array of header strings
- `rows`: array of arrays — numeric values as numbers, strings as strings
- Multiple tables → multiple tabs in the viewer

### Publish with curl

```bash
EMBERFLOW_URL="https://emberflow.ai"
TITLE="My Dataset"
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//')
TOKEN=$(jq -r .token ~/.emberflow/token.json)

# Build dataset JSON from one CSV file (requires python3 or similar)
CONTENT=$(python3 -c "
import csv, json, sys
with open('data.csv') as f:
    rows = list(csv.reader(f))
cols = rows[0]
data = []
for r in rows[1:]:
    row = []
    for v in r:
        try: row.append(float(v) if '.' in v else int(v))
        except: row.append(v)
    data.append(row)
print(json.dumps({'tables': [{'name': 'Data', 'columns': cols, 'rows': data}]}))
")

curl -s -X POST "$EMBERFLOW_URL/api/docs" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "$(jq -n --arg slug "$SLUG" --arg title "$TITLE" --arg content "$CONTENT" \
    --arg visibility "${PUBLISH_VISIBILITY:-public}" --arg folder_id "${PUBLISH_FOLDER_ID:-}" \
    '{slug: $slug, title: $title, content: $content, content_type: "dataset", visibility: $visibility}
     + (if $folder_id != "" then {folder_id: $folder_id} else {} end)')"
```

The response JSON includes a `url` field. The dataset is viewable at:
- `https://emberflow.ai/d/<shortId>/<slug>`

To **update** an existing dataset, publish again with the same slug — the API upserts for the same author.

### Other operations

```bash
# List all your documents
curl -s -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/docs"

# Delete a dataset
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$EMBERFLOW_URL/api/docs/SLUG_HERE"
```
