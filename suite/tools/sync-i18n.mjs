import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skinRoot = path.resolve(__dirname, '..', 'antigravity-claude-skin');
const i18nDir = path.join(skinRoot, 'i18n');
const dictsDir = path.join(i18nDir, 'dicts');
const metaFile = path.join(dictsDir, '.upstream-sync.json');

fs.mkdirSync(dictsDir, { recursive: true });

const UPSTREAM_REPO = 'Silas-02/antigravity-desktop-cn';
const UPSTREAM_BRANCH = 'main';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Antigravity-API-Manager-Sync' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error(`Failed to parse JSON: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Antigravity-API-Manager-Sync' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(dest, buf);
        resolve(buf.length);
      });
    }).on('error', reject);
  });
}

export async function checkAndSyncI18n(force = false) {
  console.log(`[i18n-sync] Checking upstream ${UPSTREAM_REPO}...`);
  let commitInfo;
  try {
    commitInfo = await fetchJson(`https://api.github.com/repos/${UPSTREAM_REPO}/commits/${UPSTREAM_BRANCH}`);
  } catch (err) {
    console.warn(`[i18n-sync] Network check failed: ${err.message}. Skipping remote update.`);
    return { ok: false, error: err.message };
  }

  const latestSha = commitInfo.sha;
  let currentMeta = { lastSha: null, syncedAt: null };
  if (fs.existsSync(metaFile)) {
    try { currentMeta = JSON.parse(fs.readFileSync(metaFile, 'utf8')); } catch {}
  }

  if (!force && currentMeta.lastSha === latestSha) {
    console.log(`[i18n-sync] Already up-to-date with upstream (commit ${latestSha.slice(0, 7)}).`);
    return { ok: true, upToDate: true, sha: latestSha };
  }

  console.log(`[i18n-sync] New commit found (${latestSha.slice(0, 7)}). Fetching tree...`);
  const treeData = await fetchJson(`https://api.github.com/repos/${UPSTREAM_REPO}/git/trees/${latestSha}?recursive=1`);
  const tree = treeData.tree || [];

  const targets = tree.filter(t => t.type === 'blob' && (t.path.startsWith('dicts/') || t.path === 'localization_engine.js'));

  const baseUrl = `https://raw.githubusercontent.com/${UPSTREAM_REPO}/${latestSha}`;
  for (const item of targets) {
    const dest = path.join(i18nDir, item.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const url = `${baseUrl}/${item.path}`;
    const size = await download(url, dest);
    console.log(`[i18n-sync] Downloaded ${item.path} (${(size / 1024).toFixed(1)} KB)`);
  }

  fs.writeFileSync(metaFile, JSON.stringify({
    upstream: UPSTREAM_REPO,
    branch: UPSTREAM_BRANCH,
    lastSha: latestSha,
    commitDate: commitInfo.commit?.committer?.date,
    syncedAt: new Date().toISOString(),
    filesCount: targets.length
  }, null, 2), 'utf8');

  // Trigger rebuild of claude-cn-i18n.js
  const builderPath = path.join(skinRoot, 'tools', 'build-i18n.js');
  if (fs.existsSync(builderPath)) {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    require(builderPath);
  }

  console.log('[i18n-sync] Successfully synchronized & rebuilt i18n bundle!');
  return { ok: true, upToDate: false, sha: latestSha };
}

if (process.argv[1] && process.argv[1].endsWith('sync-i18n.mjs')) {
  checkAndSyncI18n(process.argv.includes('--force')).catch(err => {
    console.error('[i18n-sync] Error:', err);
    process.exit(1);
  });
}
