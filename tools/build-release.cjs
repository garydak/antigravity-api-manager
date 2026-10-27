'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const releasesDir = path.join(repoRoot, 'releases');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const version = pkg.version;

fs.mkdirSync(releasesDir, { recursive: true });

const winZip = path.join(releasesDir, `antigravity-api-manager-v${version}-win.zip`);
const macZip = path.join(releasesDir, `antigravity-api-manager-v${version}-mac.zip`);

console.log(`[ReleaseBuilder] Building archives for v${version}...`);

// Use git archive if in a git repo to create clean packages
try {
  if (fs.existsSync(winZip)) fs.unlinkSync(winZip);
  if (fs.existsSync(macZip)) fs.unlinkSync(macZip);

  // We can use git archive or powershell Compress-Archive
  const script = `
    $zipWin = '${winZip.replace(/'/g, "''")}';
    $zipMac = '${macZip.replace(/'/g, "''")}';
    $files = Get-ChildItem -Path '${repoRoot.replace(/'/g, "''")}' -Exclude '.git', 'releases', 'node_modules', '*.tmp', '*.log';
    Compress-Archive -Path $files.FullName -DestinationPath $zipWin -Force;
    Copy-Item -Path $zipWin -Destination $zipMac -Force;
  `;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    timeout: 30000,
    windowsHide: true
  });

  console.log(`[ReleaseBuilder] Successfully created:`);
  console.log(` - ${winZip} (${fs.statSync(winZip).size} bytes)`);
  console.log(` - ${macZip} (${fs.statSync(macZip).size} bytes)`);
} catch (e) {
  console.error('[ReleaseBuilder] Error:', e.message);
  process.exit(1);
}
