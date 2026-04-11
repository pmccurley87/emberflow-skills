---
name: ember-publish-explainer
description: Generate an interactive visual explainer — AI chooses the best visualization (flowchart, chart, timeline, grid, etc.) for the topic
argument-hint: [topic or concept to explain visually]
---

# Interactive Visual Explainer

Generate a **structured JSON** explainer that the Emberflow platform renders as an interactive, slide-based visual. The layout is always **left prose + right visualization**, with platform-provided navigation (prev/next, progress pips, keyboard arrows).

You choose the best visualization type for each slide. A single explainer can mix different viz types across slides — a timeline on slide 2, a data table on slide 3, a chart on slide 4.

**Visual diversity is critical.** Every explainer should feel bespoke. Don't fall back on "grid of stat cards" or "list of bordered boxes" as the default — those are just one option among many. Think about what shape the data actually has: is it a flow? Use a Sankey or funnel. A ranking? Use a horizontal bar chart or podium layout. A distribution? Use a heatmap or scatter. A before/after? Use a split comparison. A hierarchy? Use a tree or nested rings. A process? Use a swimlane or animated pipeline. Match the visualization to the shape of the information, not the other way around.

## Output

Write a single JSON file to `{topic-slug}-explainer.json` in the current working directory. Then publish it to Emberflow.

---

## A. JSON Schema

The output JSON has this structure:

```json
{
  "css": "/* shared styles for all viz panels */",
  "slides": [
    {
      "label": "Overview",
      "title": "Authentication Flow",
      "prose": "<p>When a user signs in...</p>",
      "viz": "<svg>...nodes, edges, chart markup...</svg>",
      "script": "var nodes = container.querySelectorAll('.d-node');\nnodes.forEach(function(n, i) { setTimeout(function() { n.classList.add('visible'); }, 100 + i * 60); });"
    }
  ]
}
```

### Fields

- **`css`** (string): Shared CSS for all viz panels. Injected once into a `<style>` block. Can reference platform design tokens (`var(--accent)`, `var(--border)`, etc. — see Section C). Keep this concise — only styles needed by your viz HTML.
- **`slides[]`** (array, 4-7 items): Slide objects, each with:
  - `label` (string): Short uppercase tag (e.g., "Overview", "Step 1", "Budget")
  - `title` (string): Heading text. First slide renders as `<h1>`, rest as `<h2>`
  - `prose` (string): HTML for the left panel — paragraphs, lists, inline code. No block-level scripts or styles.
  - `viz` (string): HTML markup for the right panel — SVG elements, DOM elements, tables, etc. This is inserted as `innerHTML` each time the slide activates.
  - `script` (string, optional): JavaScript that runs when the slide activates. Receives `container` as a parameter — the viz panel DOM element. Use `var` (not `const`/`let`) for broad compatibility. The script runs via `new Function('container', script)(vizEl)`.

### What the platform provides

The platform handles everything outside the slide data:
- Topbar, sidebar, document list
- Slide layout (left prose / right viz grid)
- Navigation (prev/next buttons, progress pips, arrow keys, space bar)
- Slide transitions (opacity fade)
- Responsive behavior (stacks on mobile)
- Theme integration (light/dark mode via CSS custom properties)

### What you provide

Only the content:
- Shared CSS for your viz elements (`css` field)
- Per-slide: label, title, prose HTML, viz HTML, optional activation script
- No `<html>`, `<body>`, `<head>`, navigation, or layout wrappers
- No external dependencies (no CDN links, no imports, no web fonts)

### Platform-provided CSS primitives

The platform ships CSS for common patterns so you don't need to define them in your `css` field:

#### Code blocks (`.ex-code`)

Use in the **viz** panel to show syntax-highlighted code with line numbers and per-slide line highlighting:

```html
<pre class="ex-code"><code>
<span class="ex-line">function authenticate(req) {</span>
<span class="ex-line highlight">  const token = req.headers.authorization;</span>
<span class="ex-line highlight">  if (!token) return null;</span>
<span class="ex-line">  return verifyJWT(token);</span>
<span class="ex-line">}</span>
</code></pre>
```

- Each `<span class="ex-line">` gets automatic line numbers via CSS counters
- Add `.highlight` to emphasize specific lines (orange accent background)
- Add `<span class="ex-lang">js</span>` inside the `<pre>` for a language badge

For **prose** panel code, just use standard `<pre><code>...</code></pre>` — the platform styles those too.

#### Click hints (`.ex-click-hint`)

When a viz has interactive/clickable elements, add a hint so the user knows:

```html
<div class="ex-click-hint">Click to explore</div>
```

The platform renders this as a small muted label with a pointer icon, positioned at the top of the viz panel. It auto-fades after 3 seconds. Use it on any slide where clicking items reveals detail content.

#### Architecture diagrams (declarative, auto-laid-out)

For architecture diagrams, flowcharts, and any node-and-edge visualization, use a **declarative JSON object** as the `viz` field instead of an HTML string. The platform auto-computes layout using dagre and renders with animated SVG.

**Set `viz` to a JSON object** (not a string) with this structure:

```json
{
  "direction": "LR",
  "nodesep": 50,
  "ranksep": 80,
  "nodes": [
    {"id": "api", "label": "API Server", "sublabel": "validates slides[]", "icon": "server", "color": "blue"},
    {"id": "db", "label": "PostgreSQL", "sublabel": "content column", "icon": "database", "color": "blue"},
    {"id": "client", "label": "Browser", "sublabel": "JSON.parse(atob())", "icon": "browser", "color": "green"}
  ],
  "edges": [
    {"from": "api", "to": "db", "label": "INSERT", "color": "blue"},
    {"from": "db", "to": "client", "label": "SELECT", "color": "green"}
  ],
  "groups": [
    {"id": "backend", "label": "Server-Side", "nodes": ["api", "db"]},
    {"id": "frontend", "label": "Client-Side", "nodes": ["client"]}
  ]
}
```

**How it works:** The platform runs dagre (a directed graph layout engine) to automatically compute node positions. Each group is laid out as an independent horizontal row, then groups are stacked vertically. Cross-group edges are drawn as smooth bezier curves. Nodes animate in with staggered entrance, edges draw in with stroke animation. You never write SVG coordinates.

**Node properties:**
- `id` (required): Unique identifier
- `label` (required): Main text
- `sublabel` (optional): Smaller muted subtitle below label
- `icon` (optional): One of: `server`, `database`, `browser`, `code`, `play`, `sun`, `grid`, `cloud`, `lock`, `user`, `file`, `api`, `cpu`, `network`, `mail`, `zap`, `box`
- `color` (optional): `orange`, `green`, `blue`, `red`, `purple` — tints the node border and fill

**Edge properties:**
- `from`, `to` (required): Node IDs
- `label` (optional): Text displayed at the edge midpoint
- `color` (optional): Same color options as nodes

**Group properties:**
- `id` (required): Unique identifier
- `label` (required): Region label (displayed above the group)
- `nodes` (required): Array of node IDs in this group

**Layout options:**
- `direction`: `"LR"` (left-to-right, default) or `"TB"` (top-to-bottom) — controls flow within each group
- `nodesep`: Pixel spacing between nodes in the same rank (default 50)
- `ranksep`: Pixel spacing between ranks (default 80)

**Color coding best practices:**
- Blue for data stores and infrastructure
- Green for client-side / success paths
- Orange for the highlighted/active component or entry points
- Purple for middleware / transformation layers
- Red for errors or warnings

**When to use diagrams vs raw SVG:** Use declarative diagrams for any node-and-edge visualization (architecture, flowcharts, data flows, org charts). Use raw SVG/HTML for other viz types (charts, tables, timelines, KPIs) where spatial positioning matters.

No `script` field is needed for diagram slides — the platform handles all animation automatically.

---

## B. Visualization Primitive Catalog

This is a **starting point, not a menu to order from**. The best explainers invent visualizations that fit the content perfectly. Combine, adapt, or create entirely new primitives. If none of these fit — build something original.

### Data Display

- **KPI / stat cards** — Grid of boxes with label, large value, subtitle. Good for overview slides, but don't default to this for everything.
- **Data table** — `<table>` with muted uppercase headers, monospace numbers, color-coded values. Category dots on row labels.
- **Comparison matrix** — Table with checkmark/cross SVG icons per cell. Active column highlighted with accent border.
- **Heatmap grid** — CSS grid where cell background intensity maps to a value. Use color gradients (green→yellow→red or cool→warm). Great for showing density, coverage, or correlation.
- **Scorecard** — Single large metric in a ring or gauge, with trend sparkline below. Different from KPI cards — more visual weight, fewer items.

### Charts

- **Vertical bar chart** — Flex row of bars, height as percentage of max. Color-code by threshold. Animate height on entrance.
- **Horizontal bar chart** — Rows with label left, bar extending right. Good for ranked lists, leaderboards, survey results.
- **Donut / ring chart** — SVG circle with `stroke-dasharray`/`stroke-dashoffset`. Percentage label centered.
- **Funnel diagram** — Stacked horizontal bars decreasing in width, centered. Show conversion rates between stages.
- **Waterfall chart** — Bars that float from the previous bar's end. Show how values build up or break down (budget additions/subtractions, funnel drop-offs).
- **Sparklines / mini line charts** — SVG polylines inside cards or rows. Show trends without axes. Great for time-series context within other layouts.
- **Stacked bar / segmented bar** — Single horizontal bar divided into colored segments. Show composition at a glance (e.g., traffic sources, time allocation).
- **Scatter / bubble plot** — SVG circles positioned by x/y data. Size encodes a third dimension. Good for correlation or distribution.

### Flows & Processes

- **Sankey diagram** — SVG paths flowing from left to right with varying widths. Show how quantities split and merge across stages (budget allocation, user flow, data pipeline).
- **Swimlane diagram** — Horizontal lanes (rows) representing actors/systems. Steps flow left-to-right across lanes showing handoffs. Great for cross-team processes.
- **Animated pipeline** — Horizontal or vertical sequence of stages with animated dots/particles moving through. Show data or request flow in real-time feel.
- **Decision tree** — Binary branching layout. Each node is a question, branches lead to outcomes. Clickable to explore paths.

### Timelines & Sequences

- **Vertical timeline** — Left border line with dot markers. Each event has date, title, description, optional progress bar and status badge.
- **Horizontal timeline** — Flex row of connected nodes along a horizontal line. Good for fewer items (3-6).
- **Progress stepper** — Numbered circles connected by lines. Active step highlighted, completed steps filled.
- **Gantt-style chart** — Rows of horizontal bars on a time axis. Show overlapping phases, dependencies, or parallel workstreams.
- **Spiral timeline** — Events arranged along a spiral path (SVG). Unusual and memorable for cyclical or long-spanning histories.

### Relationships & Structure (Auto-Layout Diagrams)

For any node-and-edge visualization, use a **declarative diagram object** as the `viz` field. The platform auto-positions nodes and routes edges — no manual coordinate math needed.

- **Architecture diagram** — Use `viz: { nodes, edges, groups }` with color-coded nodes, meaningful icons, and labeled groups. See Section A → "Architecture diagrams".
- **Flowchart** — Same declarative format with a single group or no groups. Set `direction: "TB"` for top-to-bottom flow.
- **Org chart / hierarchy** — Use `direction: "TB"` and groups for departments. Color-code by role.
- **Network / data flow** — Multiple groups connected by cross-group edges. Color edges by data type.

### Grids & Categories

- **Periodic table / grid** — CSS grid of cards with colored top bar per category. Hover shows detail.
- **Kanban board** — Columns with card items. Cards can highlight or shift between columns per slide.
- **Tier list** — Labeled rows (S/A/B/C/F) with items placed in each tier. Color-coded by rank. Great for evaluations and comparisons.

### Status & Indicators

- **Risk cards** — Stacked cards with severity SVG icon, title, description, colored severity badge.
- **Stat delta** — Large number with up/down arrow SVG and percentage change.
- **Gauge / meter** — SVG arc filled to a percentage. More visual impact than a number alone.
- **Utilization bars** — Rows with label, horizontal progress bar, percentage.
- **Checklist** — Items with check/cross SVG icons. Grouped by category.

### Comparisons & Layouts

- **Split comparison** — Two panels side-by-side (before/after, option A/option B). Highlight differences with color.
- **Podium / ranking** — Three items in a 2-1-3 podium arrangement (second, first, third). Great for top-3 results.
- **Concentric rings** — Nested circles or rings showing layers (e.g., onion architecture, security perimeters, impact radius).
- **Quadrant chart** — 2×2 grid with labeled axes. Place items as dots or cards in quadrants (e.g., effort/impact, urgency/importance).
- **Radar / spider chart** — SVG polygon on radial axes. Compare multiple dimensions of a single entity or overlay two entities.

### Inventing New Primitives

The catalog above is a starting point. **The best explainers often use visualizations not on this list.** If the topic calls for something new — a custom game board, an animated state machine, a nested ring diagram, a radial burst — build it. The only constraints are the design tokens and the slide-based interaction model.

---

## C. Design Tokens (Platform-Provided)

These CSS custom properties are available in both the `css` field and `viz` HTML. They adapt to the user's light/dark theme:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#ffffff` | `#09090b` | Page background |
| `--bg-secondary` | `#f9fafb` | `#18181b` | Card/panel backgrounds |
| `--text` | `#0f172a` | `#fafafa` | Body text |
| `--text-muted` | `#64748b` | `#a1a1aa` | Secondary text, labels |
| `--border` | `#e2e8f0` | `#27272a` | Borders, dividers |
| `--link` | `#ea580c` | `#fb923c` | Accent color (orange) |
| `--heading` | `#0f172a` | `#fafafa` | Heading text |
| `--code-bg` | `#f1f5f9` | `#18181b` | Code block backgrounds |

Additional tokens you can define in your `css` field for internal use (common choices):

```css
--accent: var(--link);
--accent-lt: var(--link);
--ring: rgba(234, 88, 12, 0.15);
--glow: rgba(234, 88, 12, 0.25);
--green: #22c55e;
--green-dim: rgba(34, 197, 94, 0.12);
--yellow: #eab308;
--yellow-dim: rgba(234, 179, 8, 0.12);
--red: #ef4444;
--red-dim: rgba(239, 68, 68, 0.12);
--blue: #3b82f6;
--blue-dim: rgba(59, 130, 246, 0.12);
```

**Font stack:** Inherited from the platform. Don't set font-family.
**Monospace:** `'JetBrains Mono', 'SF Mono', 'Fira Code', monospace`

**Transitions:**
- State changes: `0.3-0.5s, cubic-bezier(0.4, 0, 0.2, 1)`
- Hover effects: `0.15s`
- Bar/chart animations: `0.6s cubic-bezier(0.4, 0, 0.2, 1)`

**Active state:** `border-color: var(--link)` or `stroke: var(--link)` + glow `filter: drop-shadow(0 0 12px rgba(251, 146, 60, 0.15))`
**Dimmed state:** `opacity: 0.2`
**Staggered entrance:** `setTimeout(function() { el.classList.add('visible'); }, baseDelay + i * 60)`

---

## D. Slide Planning

Before writing any code, plan 4-7 slides:

1. **Slide 1** = Overview. Show the full visualization at a glance — all elements visible, none dimmed. Give the reader context.
2. **Slides 2-6** = Each focuses on one concept or subset. Zoom in, highlight, or switch viz type.
3. **Last slide** (optional) = Summary or call-to-action.

**Vary the viz type across slides.** If slide 1 uses a diagram, slide 2 should use something different (a chart, timeline, table, etc.). Repeating the same viz structure on every slide makes the explainer feel static and monotonous. Each slide transition should feel like a new lens on the topic.

For each slide, define:
- **label**: Short uppercase label
- **title**: Heading text
- **prose**: 1-3 paragraphs of explanation (HTML)
- **viz**: The HTML markup for the right panel
- **script** (optional): JS to animate/activate the viz

---

## E. Script Conventions

The `script` field receives `container` (the viz panel DOM element). Common patterns:

```javascript
// Staggered entrance
var items = container.querySelectorAll('.my-item');
items.forEach(function(el, i) {
  setTimeout(function() { el.classList.add('visible'); }, 100 + i * 60);
});

// Animate bar heights
var bars = container.querySelectorAll('.bar');
bars.forEach(function(bar, i) {
  setTimeout(function() {
    bar.style.height = bar.dataset.height;
  }, 80 + i * 60);
});
```

### Interactive patterns

Viz elements can be **clickable**. Use click handlers to show/hide detail panels, switch between views, or highlight related content within a single slide. This makes dense slides explorable without needing more slides.

**When to use interactivity:** Use it when a slide has a list of items (sections, features, steps, categories) where each has detail content that would clutter the viz if all shown at once. The user clicks an item to drill in, clicks another to switch.

**Visual affordances:** Always signal that elements are clickable:
- Add `cursor: pointer` and a hover border/background change
- Include a `<div class="ex-click-hint">` element — the platform renders this as a small "click to explore" label with a pointer icon (see Platform-provided CSS primitives)
- Give the initially-selected item an `.active` class with accent styling

**Common interactive patterns:**

```javascript
// Clickable list with detail panel
// viz HTML: items with data-detail="..." attribute + a .detail-panel div
var items = container.querySelectorAll('.clickable-item');
var detail = container.querySelector('.detail-panel');
items.forEach(function(item) {
  item.addEventListener('click', function() {
    items.forEach(function(el) { el.classList.remove('active'); });
    item.classList.add('active');
    detail.innerHTML = item.getAttribute('data-detail');
    detail.style.opacity = '0';
    setTimeout(function() { detail.style.opacity = '1'; }, 30);
  });
});
// Activate the first item by default
if (items[0]) items[0].click();

// Tabbed content switcher
// viz HTML: tab buttons with data-tab="id" + panels with data-panel="id"
var tabs = container.querySelectorAll('.tab-btn');
var panels = container.querySelectorAll('.tab-panel');
tabs.forEach(function(tab) {
  tab.addEventListener('click', function() {
    tabs.forEach(function(t) { t.classList.remove('active'); });
    panels.forEach(function(p) { p.style.display = 'none'; });
    tab.classList.add('active');
    var panel = container.querySelector('[data-panel="' + tab.getAttribute('data-tab') + '"]');
    if (panel) panel.style.display = 'block';
  });
});
if (tabs[0]) tabs[0].click();
```

**Key rules for interactivity:**
- Always have a default selection — never show an empty state on load
- Transition content changes (opacity fade or translateY) so they don't feel jarring
- Keep the clickable area generous (full card/row, not just the text)
- All state lives in the DOM within `container` — no external variables needed

Rules:
- Use `var`, not `const`/`let`
- Use `function(){}`, not arrow functions
- Always scope queries to `container` (`container.querySelectorAll(...)`)
- Scripts run each time the slide activates (viz is rebuilt fresh each time)

---

## F. Quality Rules

1. **Zero external dependencies** — no CDN links, no imports, no fonts
2. **No `<canvas>`** — SVG or DOM only
3. **Total JSON < 50KB** — be concise with CSS, HTML, and scripts
4. **4-7 slides** — no more, no fewer
5. **No scrolling in visualization pane** — everything must fit
6. **No emojis** — use inline SVGs with `stroke="currentColor"` for all icons
7. **All state changes animated** — opacity, transform, stroke-dashoffset, height, width
8. **Icons** — inline SVG, 16-24px viewBox, 1.5px stroke, `stroke-linecap="round" stroke-linejoin="round"`
9. **Use `var`** — not `const`/`let` in scripts
10. **Diagrams are declarative** — for any node-and-edge visualization, set `viz` to a JSON object with `nodes`, `edges`, and `groups`. The platform auto-computes layout and renders animated SVG. Never hand-code SVG coordinates for diagrams.
11. **SVG sizing** — for non-diagram SVG viz (custom charts, etc.), always use `viewBox`, never set `width`/`height` attributes. The platform stretches SVGs to fill the viz panel.

---

## G. Publishing

After generating the JSON file, publish it to Emberflow:

```bash
# Read the JSON and publish
CONTENT=$(cat {topic-slug}-explainer.json)
curl -X POST "${EMBERFLOW_URL}/api/docs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${EMBERFLOW_TOKEN}" \
  -d "$(jq -n --arg slug "{topic-slug}-explainer" --arg title "{Title}" \
    --arg content "$CONTENT" \
    --arg visibility "${PUBLISH_VISIBILITY:-public}" --arg folder_id "${PUBLISH_FOLDER_ID:-}" \
    '{slug: $slug, title: $title, content: $content, content_type: "explainer", visibility: $visibility}
     + (if $folder_id != "" then {folder_id: $folder_id} else {} end)')"
```

Or use the Emberflow MCP/CLI to publish with `content_type: 'explainer'`.

---

## H. Reference Templates

Read **one** template before generating to understand the JSON structure, field conventions, and script patterns:

```
Read templates/diverse-viz-explainer.json — RECOMMENDED: showcases 5 different viz types across slides (funnel, heatmap, radar chart, waterfall, gauges). Start here if you're unsure which template to use.

Read templates/architecture-explainer.json — declarative diagram example (nodes + edges, active/dimmed states, staggered entrance).

Read templates/project-overview-explainer.json — mixed-viz example (KPIs, timeline, budget table, donut ring, risk cards — different viz type per slide).

Read templates/dashboard-explainer.json — data viz example (animated bar chart, color-coded values, dataset switching, insight callouts).
```

Use the templates for **structural reference only** — JSON shape, field naming, script scoping, and animation timing. Do NOT copy their visual style. Your explainer should look distinct from every template. Choose visualization types that match your specific content, not the template's content.
