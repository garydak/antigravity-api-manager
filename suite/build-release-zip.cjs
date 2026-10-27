const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = 'D:/software/antigravity-api-manager-main';
const releaseDir = path.join(root, 'releases');
fs.mkdirSync(releaseDir, { recursive: true });

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version || '2.4.4';

const macZip = path.join(releaseDir, `antigravity-api-manager-v${version}-mac.zip`);
const winZip = path.join(releaseDir, `antigravity-api-manager-v${version}-win.zip`);

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
  '双击一键安装.cmd',
  '双击一键卸载.cmd',
  '重启Antigravity.cmd',
  'README.md',
  'LICENSE'
];

for (const dir of includeDirs) {
  const src = path.join(root, dir);
  const dest = path.join(stageDir, dir);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dest, {
      recursive: true,
      filter: (srcPath) => {
        const base = path.basename(srcPath);
        if (['node_modules', '.git', 'backup', 'inspect', 'tools-test', 'temp_stage_dist'].includes(base)) return false;
        if (base.endsWith('.log') || base.endsWith('.tmp') || base.endsWith('.bak')) return false;
        return true;
      }
    });
  }
}

for (const file of includeFiles) {
  const src = path.join(root, file);
  const dest = path.join(stageDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

console.log(`Staging prepared. Creating v${version} zip archives...`);

// 1. Create macOS zip (preserving unix file permissions if possible, standard zip)
execFileSync('powershell.exe', [
  '-NoProfile',
  '-Command',
  `Compress-Archive -Path '${stageDir}/*' -DestinationPath '${macZip}' -Force`
]);
console.log('Created:', macZip, (fs.statSync(macZip).size / (1024 * 1024)).toFixed(2), 'MB');

// 2. Create Windows zip
execFileSync('powershell.exe', [
  '-NoProfile',
  '-Command',
  `Compress-Archive -Path '${stageDir}/*' -DestinationPath '${winZip}' -Force`
]);
console.log('Created:', winZip, (fs.statSync(winZip).size / (1024 * 1024)).toFixed(2), 'MB');

// Cleanup stage
fs.rmSync(stageDir, { recursive: true, force: true });
console.log('Release packages successfully generated.');
