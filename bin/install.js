#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const readline = require('readline');
const os = require('os');

const SKILL_NAME = 'ember-publish';
const SKILL_SRC = path.join(__dirname, '..', 'skills', SKILL_NAME, 'SKILL.md');
const EMBERFLOW_URL = 'https://supportive-forgiveness-production.up.railway.app';
const TOKEN_PATH = path.join(os.homedir(), '.emberflow', 'token.json');

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const orange = (s) => `\x1b[38;5;208m${s}\x1b[0m`;

const targets = [
  { dir: '.claude/skills', label: 'Claude Code (project)' },
  { dir: '.cursor/skills', label: 'Cursor (project)' },
];

const globalTargets = [
  { dir: path.join(os.homedir(), '.claude', 'skills'), label: 'Claude Code (global)' },
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

// ── Skill installer ──

function install(destDir, label) {
  const skillDir = path.join(destDir, SKILL_NAME);
  const destFile = path.join(skillDir, 'SKILL.md');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.copyFileSync(SKILL_SRC, destFile);
  console.log(`  ${green('✓')} Installed to ${path.relative(process.cwd(), skillDir) || skillDir} ${dim(`(${label})`)}`);
  return true;
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

  // Request device code
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

  // Try to open the URL automatically
  try {
    const { exec } = require('child_process');
    const cmd = process.platform === 'darwin' ? 'open' :
                process.platform === 'win32' ? 'start' : 'xdg-open';
    exec(`${cmd} "${verification_url}"`);
  } catch {}

  process.stdout.write(`  ${dim('Waiting for approval...')}`);

  // Poll for approval
  const maxAttempts = 60; // 3 minutes at 3s intervals
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);

    try {
      const status = await request('GET', `${EMBERFLOW_URL}/api/device-code/${code}`);

      if (status.data.status === 'approved' && status.data.session_token) {
        fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
        fs.writeFileSync(TOKEN_PATH, JSON.stringify({ token: status.data.session_token }, null, 2));
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

    // Spinner
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
    let installed = 0;

    if (isGlobal) {
      for (const t of globalTargets) {
        install(t.dir, t.label);
        installed++;
      }
    } else {
      const cwd = process.cwd();
      const detected = [];

      for (const t of targets) {
        const parent = path.dirname(path.join(cwd, t.dir));
        if (fs.existsSync(path.join(cwd, t.dir)) || fs.existsSync(parent)) {
          detected.push(t);
        }
      }

      if (detected.length === 0) {
        detected.push(targets[0]);
      }

      for (const t of detected) {
        install(path.join(cwd, t.dir), t.label);
        installed++;
      }
    }

    if (installed > 0) {
      console.log();
      console.log(`  Use: ${cyan('/ember-publish')} ${dim('[topic]')}`);
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
