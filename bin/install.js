#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const readline = require('readline');
const os = require('os');

const SKILL_NAMES = ['ember-publish', 'ember-publish-doc', 'ember-publish-dataset', 'ember-publish-explainer', 'ember-publish-json', 'ember-publish-space'];
const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const EMBERFLOW_URL = 'https://www.emberflow.ai';
const TOKEN_PATH = path.join(os.homedir(), '.emberflow', 'token.json');

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const orange = (s) => `\x1b[38;5;208m${s}\x1b[0m`;

// ── Tool definitions ──

const TOOLS = [
  {
    type: 'claude',
    detect: ['.claude'],
    projectDir: '.claude/skills',
    globalDir: path.join(os.homedir(), '.claude', 'skills'),
    label: 'Claude Code',
    usage: '/ember-publish',
  },
  {
    type: 'cursor',
    detect: ['.cursor', '.cursorrules'],
    projectDir: '.cursor/rules',
    label: 'Cursor',
    usage: '"publish this to Emberflow"',
  },
  {
    type: 'windsurf',
    detect: ['.windsurf', '.windsurfrules'],
    projectDir: '.windsurf/rules',
    label: 'Windsurf',
    usage: '"publish this to Emberflow"',
  },
  {
    type: 'codex',
    detect: ['.agents', 'AGENTS.md'],
    projectDir: '.agents/skills',
    globalDir: path.join(os.homedir(), '.agents', 'skills'),
    label: 'Codex',
    usage: '$ember-publish',
  },
];

const args = process.argv.slice(2);
const isGlobal = args.includes('--global') || args.includes('-g');

// ── HTTP helpers ──

function request(method, urlStr, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {},
    };
    let data = null;
    if (body) {
      data = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = mod.request(opts, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(chunks) }); }
        catch { resolve({ status: res.statusCode, data: chunks }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── SKILL.md parsing ──

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return { meta, body: match[2] };
}

// ── File helpers ──

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rewriteTemplatePaths(body, templatesRelPath) {
  // Rewrite "Read templates/" to use the full relative path from project root
  return body.replace(
    /Read templates\//g,
    `Read ${templatesRelPath}/`
  );
}

// ── Installers per tool type ──

function installClaude(name, destDir) {
  const srcDir = path.join(SKILLS_DIR, name);
  const skillDir = path.join(destDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(path.join(srcDir, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

  const templatesDir = path.join(srcDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    copyDirRecursive(templatesDir, path.join(skillDir, 'templates'));
  }
}

function installCursor(name, destDir, cwd) {
  const srcDir = path.join(SKILLS_DIR, name);
  const skillMd = fs.readFileSync(path.join(srcDir, 'SKILL.md'), 'utf8');
  const { meta, body } = parseFrontmatter(skillMd);

  // Copy templates to .cursor/rules/<name>/templates/
  const templatesDir = path.join(srcDir, 'templates');
  const hasTemplates = fs.existsSync(templatesDir);
  if (hasTemplates) {
    copyDirRecursive(templatesDir, path.join(destDir, name, 'templates'));
  }

  // Rewrite template paths relative to project root
  let content = body;
  if (hasTemplates) {
    const relPath = path.relative(cwd, path.join(destDir, name, 'templates'));
    content = rewriteTemplatePaths(content, relPath);
  }

  // Write .mdc file with Cursor frontmatter
  const description = meta.description || name;
  const hint = meta['argument-hint'] ? ` — ${meta['argument-hint']}` : '';
  const mdc = `---
description: ${description}${hint}
globs:
alwaysApply: false
---

${content}`;

  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, `${name}.mdc`), mdc);
}

function installWindsurf(name, destDir, cwd) {
  const srcDir = path.join(SKILLS_DIR, name);
  const skillMd = fs.readFileSync(path.join(srcDir, 'SKILL.md'), 'utf8');
  const { body } = parseFrontmatter(skillMd);

  // Copy templates
  const templatesDir = path.join(srcDir, 'templates');
  const hasTemplates = fs.existsSync(templatesDir);
  if (hasTemplates) {
    copyDirRecursive(templatesDir, path.join(destDir, name, 'templates'));
  }

  // Rewrite template paths
  let content = body;
  if (hasTemplates) {
    const relPath = path.relative(cwd, path.join(destDir, name, 'templates'));
    content = rewriteTemplatePaths(content, relPath);
  }

  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, `${name}.md`), content);
}

function installCodex(name, destDir, cwd) {
  // Codex uses the same SKILL.md format as Claude Code, discovered from .agents/skills/<name>/
  const srcDir = path.join(SKILLS_DIR, name);
  const skillDir = path.join(destDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(path.join(srcDir, 'SKILL.md'), path.join(skillDir, 'SKILL.md'));

  // Copy templates
  const templatesDir = path.join(srcDir, 'templates');
  if (fs.existsSync(templatesDir)) {
    copyDirRecursive(templatesDir, path.join(skillDir, 'templates'));
  }
}

// ── Main install function ──

function install(destDir, tool, cwd) {
  for (const name of SKILL_NAMES) {
    switch (tool.type) {
      case 'claude':
        installClaude(name, destDir);
        break;
      case 'cursor':
        installCursor(name, destDir, cwd);
        break;
      case 'windsurf':
        installWindsurf(name, destDir, cwd);
        break;
      case 'codex':
        installCodex(name, destDir, cwd);
        break;
    }
    const relDest = path.relative(cwd, destDir) || destDir;
    console.log(`  ${green('✓')} ${name} → ${dim(relDest)} ${dim(`(${tool.label})`)}`);
  }
  return true;
}

// ── Detection ──

function detectTools(cwd) {
  const detected = [];
  for (const tool of TOOLS) {
    for (const marker of tool.detect) {
      if (fs.existsSync(path.join(cwd, marker))) {
        detected.push(tool);
        break;
      }
    }
  }
  return detected;
}

// ── Auth flow ──

function hasValidToken() {
  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    return !!token.token;
  } catch {
    return false;
  }
}

async function authenticate() {
  console.log();
  console.log(`  ${orange('🔥')} ${bold('Sign in to Emberflow')}`);
  console.log(`  ${dim('Your published docs will be attributed to your account.')}`);
  console.log();

  let resp;
  try {
    resp = await request('POST', `${EMBERFLOW_URL}/api/device-code`);
  } catch {
    console.log(`  ${dim('Could not reach Emberflow. You can sign in later.')}`);
    return false;
  }

  if (!resp.data || !resp.data.code) {
    console.log(`  ${dim('Could not start device auth. You can sign in later.')}`);
    return false;
  }

  const { code, verification_url } = resp.data;

  console.log(`  Open this URL in your browser:`);
  console.log();
  console.log(`  ${cyan(verification_url)}`);
  console.log();
  console.log(`  Your code: ${bold(code)}`);
  console.log();

  try {
    const { exec } = require('child_process');
    if (process.platform === 'win32') {
      exec(`start "" "${verification_url}"`);
    } else if (process.platform === 'darwin') {
      exec(`open "${verification_url}"`);
    } else {
      exec(`xdg-open "${verification_url}"`);
    }
  } catch {}

  process.stdout.write(`  ${dim('Waiting for approval...')}`);

  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);

    try {
      const status = await request('GET', `${EMBERFLOW_URL}/api/device-code/${code}`);

      if (status.data.status === 'approved' && status.data.session_token) {
        const raw = status.data.session_token.replace(/^(?:__Secure-)?better-auth\.session_token=/, '');
        fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
        fs.writeFileSync(TOKEN_PATH, JSON.stringify({ token: raw }, null, 2));
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        console.log(`  ${green('✓')} Signed in! Token saved to ${dim('~/.emberflow/token.json')}`);
        return true;
      }

      if (status.data.status === 'expired') {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        console.log(`  ${dim('Code expired. You can sign in later by running:')} npx emberflow-skills --auth`);
        return false;
      }
    } catch {
      // Network error, keep polling
    }

    const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`  ${orange(frames[i % frames.length])} ${dim('Waiting for approval...')}`);
  }

  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  console.log(`  ${dim('Timed out. You can sign in later by running:')} npx emberflow-skills --auth`);
  return false;
}

// ── Main ──

async function main() {
  const authOnly = args.includes('--auth');

  console.log();
  console.log(`  ${orange('🔥')} ${bold('Emberflow Skills')}`);
  console.log();

  if (!authOnly) {
    const cwd = process.cwd();
    let installed = 0;

    if (isGlobal) {
      // Global install — Claude Code + Codex (both support global skills)
      for (const tool of TOOLS) {
        if (tool.globalDir) {
          install(tool.globalDir, tool, cwd);
          installed++;
        }
      }
    } else {
      const detected = detectTools(cwd);

      if (detected.length === 0) {
        // Default to Claude Code
        detected.push(TOOLS[0]);
        console.log(`  ${dim('No tool config detected — defaulting to Claude Code')}`);
        console.log();
      } else {
        console.log(`  ${dim(`Detected: ${detected.map(t => t.label).join(', ')}`)}`);
        console.log();
      }

      for (const tool of detected) {
        const destDir = path.join(cwd, tool.projectDir);
        install(destDir, tool, cwd);
        installed++;
        console.log();
      }
    }

    if (installed > 0) {
      const tools = isGlobal ? TOOLS.filter(t => t.globalDir) : (detectTools(cwd).length > 0 ? detectTools(cwd) : [TOOLS[0]]);

      for (const tool of tools) {
        if (tool.type === 'claude') {
          console.log(`  ${bold('Claude Code:')} ${cyan('/ember-publish')} ${dim('[topic]')}  — auto-picks format`);
          console.log(`       ${cyan('/ember-publish-doc')}  ${cyan('/ember-publish-json')}  ${cyan('/ember-publish-explainer')}  ${cyan('/ember-publish-space')}`);
        } else if (tool.type === 'codex') {
          console.log(`  ${bold('Codex:')} ${cyan('$ember-publish')} ${dim('[topic]')}  — invoke skills with $ prefix`);
          console.log(`       ${cyan('$ember-publish-doc')}  ${cyan('$ember-publish-json')}  ${cyan('$ember-publish-explainer')}  ${cyan('$ember-publish-space')}`);
        } else if (tool.type === 'cursor') {
          console.log(`  ${bold('Cursor:')} Type ${cyan('@ember-publish-explainer')} or ask ${cyan('"publish this to Emberflow"')}`);
        } else if (tool.type === 'windsurf') {
          console.log(`  ${bold('Windsurf:')} Ask ${cyan('"publish this to Emberflow"')} or ${cyan('"create an Emberflow explainer"')}`);
        }
      }
    }
  }

  // Auth
  if (hasValidToken() && !authOnly) {
    console.log();
    console.log(`  ${green('✓')} Already signed in ${dim('(~/.emberflow/token.json)')}`);
    console.log();
  } else {
    const answer = authOnly ? 'y' : await ask(`\n  Sign in to link docs to your account? ${dim('[Y/n]')} `);

    if (answer === '' || answer === 'y' || answer === 'yes') {
      await authenticate();
    } else {
      console.log();
      console.log(`  ${dim('Skipped. Docs will be published anonymously.')}`);
      console.log(`  ${dim('Sign in later with:')} npx emberflow-skills --auth`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
