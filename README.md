# Emberflow Skills

Publish beautiful docs from your AI coding tools to [Emberflow](https://www.emberflow.ai) — architecture diagrams, interactive data viewers, JSON explorers, and markdown, hosted instantly.

## Install

```bash
npx emberflow-skills
```

The installer auto-detects which AI coding tools you use and installs skills in the correct format for each.

| Tool | Format | How to use |
|------|--------|------------|
| **Claude Code** | `.claude/skills/` | `/ember-publish [topic]` |
| **Cursor** | `.cursor/rules/*.mdc` | "publish this to Emberflow" |
| **Windsurf** | `.windsurf/rules/*.md` | "publish this to Emberflow" |
| **Codex** | `.codex/*.md` | "publish this to Emberflow" |

If multiple tools are detected, skills are installed for all of them.

### Options

```bash
# Install to current project (default — auto-detects tools)
npx emberflow-skills

# Install globally for Claude Code (available in all projects)
npx emberflow-skills --global
```

### What the installer does

1. Detects tool configs in your project (`.claude/`, `.cursor/`, `.windsurf/`, `.codex/`)
2. Converts skills to each tool's native format (SKILL.md, .mdc rules, markdown agents)
3. Copies reference templates for the explainer skill
4. Done — use the skills in your next conversation

## Skills

### `/ember-publish`

The smart router — automatically picks the right format based on your content. Just describe what you want and it figures out whether to publish a document, JSON explorer, explainer, dataset, or Space.

```
/ember-publish architecture overview for the payments service
```

### `/ember-publish-doc`

Publish a markdown document with interactive emberDiagrams (flowcharts, architecture maps, decision trees) — auto-laid-out with animations, no coordinates needed.

```
/ember-publish-doc the authentication flow for our API
```

### `/ember-publish-json`

Publish JSON data as an interactive explorer with a node-graph visualization. Expand/collapse nodes, pan and zoom, search across keys and values, and switch between multiple payloads.

```
/ember-publish-json the API response from /api/users
```

### `/ember-publish-dataset`

Publish CSV files as an interactive dataset viewer with virtual scroll (handles 10k+ rows), click-to-sort, per-column filters, search with highlighting, and CSV export.

```
/ember-publish-dataset sales data from data/transactions.csv
```

### `/ember-publish-explainer`

Generate interactive visual explainers — the AI chooses the best visualization type (funnel, heatmap, radar chart, waterfall, timeline, architecture diagram, etc.) for the topic. Slide-based with animated transitions.

```
/ember-publish-explainer how our CI/CD pipeline works
```

### `/ember-publish-space`

Publish a directory of markdown files as a multi-page docs site with sidebar navigation, collapsible sections, and SPA page transitions.

```
/ember-publish-space the docs/ directory as API documentation
```

## What you get

- Interactive emberDiagrams with zoom, pan, and fullscreen
- Virtual-scroll dataset tables with sort, filter, and export
- JSON node-graph explorer with drag, collapse, and search
- Slide-based visual explainers with animated charts and timelines
- Multi-page Spaces with sidebar navigation
- Syntax-highlighted code blocks (190+ languages)
- Auto-generated table of contents
- Per-block inline comments and discussions
- Dark/light mode with font selection
- Public or private docs with link sharing

## Manual install

If you prefer not to use npx:

```bash
git clone https://github.com/pmccurley87/emberflow-skills.git

# Claude Code
cp -r emberflow-skills/skills/* .claude/skills/

# Cursor — copy as .mdc rules
# Windsurf — copy to .windsurf/rules/
# Codex — copy to .codex/
```

## Works with

- **Claude Code** — native skill system with `/slash-commands`
- **Cursor** — auto-attached rules via `.cursor/rules/`
- **Windsurf** — rules via `.windsurf/rules/`
- **Codex** — agent instructions via `.codex/`
- **Any MCP-compatible tool** — Emberflow also provides an MCP server
