const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = 'D:/software/antigravity-api-manager-main';
const releaseDir = path.join(root, 'releases');
fs.mkdirSync(releaseDir, { recursive: true });

const macZip = path.join(releaseDir, 'antigravity-api-manager-v2.3.0-mac.zip');
const winZip = path.join(releaseDir, 'antigravity-api-manager-v2.3.0-win.zip');

if (fs.existsSync(macZip)) fs.unlinkSync(macZip);
if (fs.existsSync(winZip)) fs.unlinkSync(winZip);

// Create a temporary staging directory to ensure only clean files are included
const stageDir = path.join(root, 'temp_stage_dist');
if (fs.existsSync(stageDir)) fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(stageDir, { recursive: true });

const includeDirs = [
  'antigravity-account-switcher',
  'antigravity-claude-skin',
  'antigravity-model-switcher',
  'assets',
  'suite'
];

const includeFiles = [
  'package.json',
  'install.sh',
  'uninstall.sh',
  'install-all.ps1',
  'uninstall-all.ps1',
  'install-online.ps1',
  'live-reload.ps1',
  '启动Antigravity.cmd',
  '双击一键安装.cmd',
  '双击一键卸载.cmd',
  'README.md',
  'LICENSE',
  '.gitignore'
];

function copyFiltered(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    const base = path.basename(src);
    if (['.git', 'node_modules', 'backup', 'inspect', 'i18n-repo', 'lifecycle-backups', 'bridges'].includes(base)) return;
    fs.mkdirSync(dst, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyFiltered(path.join(src, child), path.join(dst, child));
    }
  } else {
    const base = path.basename(src);
    if (base.endsWith('.log') || base.endsWith('.bak') || base.endsWith('.tmp')) return;
    // CRITICAL: NEVER include live credential files
    if (base === 'accounts.json' || base === 'models.json' || base === 'suite-settings.json' || base === 'install-manifest.json') return;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

for (const dir of includeDirs) {
  const src = path.join(root, dir);
  if (fs.existsSync(src)) copyFiltered(src, path.join(stageDir, dir));
}

for (const f of includeFiles) {
  const src = path.join(root, f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(stageDir, f));
}

console.log('Staging prepared. Creating zip archives...');

// Compress using PowerShell Compress-Archive
execFileSync('powershell.exe', [
  '-NoProfile', '-Command',
  `Compress-Archive -Path "${stageDir}/*" -DestinationPath "${macZip}" -CompressionLevel Optimal -Force`
], { stdio: 'inherit' });

execFileSync('powershell.exe', [
  '-NoProfile', '-Command',
  `Compress-Archive -Path "${stageDir}/*" -DestinationPath "${winZip}" -CompressionLevel Optimal -Force`
], { stdio: 'inherit' });

// Clean up staging
fs.rmSync(stageDir, { recursive: true, force: true });

console.log('Created:', macZip, (fs.statSync(macZip).size / 1024 / 1024).toFixed(2), 'MB');
console.log('Created:', winZip, (fs.statSync(winZip).size / 1024 / 1024).toFixed(2), 'MB');
