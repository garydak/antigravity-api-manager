'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const releasesDir = path.join(repoRoot, 'releases');
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
const version = pkg.version;

fs.mkdirSync(releasesDir, { recursive: true });

const winZip = path.join(releasesDir, `antigravity-api-manager-v${version}-win.zip`);
const macZip = path.join(releasesDir, `antigravity-api-manager-v${version}-mac.zip`);

console.log(`[ReleaseBuilder] Building sanitized archives for v${version}...`);

// Recursively copy directory while excluding blacklisted paths and sensitive files
function copyDirSanitized(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Root / top-level exclusions
    if (src === repoRoot) {
      if (['.git', 'releases', 'node_modules', '.cache', 'artifacts'].includes(entry.name)) {
        continue;
      }
    }

    // Universal blacklist patterns
    if (entry.name.endsWith('.log') || entry.name.endsWith('.tmp') || entry.name.endsWith('.bak')) {
      continue;
    }
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db' || entry.name.startsWith('.env')) {
      continue;
    }

    // Critical security: Never package sensitive user credentials, private API keys, or session bridges
    if (['accounts.json', 'models.json', 'session-selections.json'].includes(entry.name)) {
      console.warn(`[Security] Strictly excluded sensitive file: ${srcPath}`);
      continue;
    }
    if (['bridges', 'lifecycle-backups', 'backup', 'inspect', 'i18n-repo'].includes(entry.name)) {
      console.warn(`[Security] Strictly excluded runtime directory: ${srcPath}`);
      continue;
    }
    if (srcPath.includes(path.sep + 'data') && entry.name.endsWith('.json') && !entry.name.endsWith('.example.json')) {
      console.warn(`[Security] Strictly excluded non-template data file: ${srcPath}`);
      continue;
    }

    if (entry.isDirectory()) {
      copyDirSanitized(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Deep audit of staging files
function auditStaging(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      auditStaging(fullPath);
    } else if (entry.isFile()) {
      if (['accounts.json', 'models.json', 'session-selections.json'].includes(entry.name)) {
        throw new Error(`Security Violation: Sensitive file found in staging at ${fullPath}`);
      }
      if (fullPath.includes(path.sep + 'data') && entry.name.endsWith('.json') && !entry.name.endsWith('.example.json')) {
        throw new Error(`Security Violation: Non-template JSON found in data directory: ${fullPath}`);
      }
      if (entry.name.endsWith('.log')) {
        throw new Error(`Security Violation: Log file found in staging at ${fullPath}`);
      }
    }
  }
}

try {
  if (fs.existsSync(winZip)) fs.unlinkSync(winZip);
  if (fs.existsSync(macZip)) fs.unlinkSync(macZip);

  const stagingDir = path.join(os.tmpdir(), `aam-staging-v${version}-${Date.now()}`);
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }

  console.log(`[ReleaseBuilder] Creating clean staging directory at: ${stagingDir}`);
  copyDirSanitized(repoRoot, stagingDir);
  auditStaging(stagingDir);
  console.log(`[ReleaseBuilder] Staging audit passed: No credentials, API keys, or log files present.`);

  const script = `
    $zipWin = '${winZip.replace(/'/g, "''")}';
    $zipMac = '${macZip.replace(/'/g, "''")}';
    $staging = '${stagingDir.replace(/'/g, "''")}';
    $items = Get-ChildItem -Path $staging;
    Compress-Archive -Path $items.FullName -DestinationPath $zipWin -Force;
    Copy-Item -Path $zipWin -Destination $zipMac -Force;
  `;

  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    timeout: 60000,
    windowsHide: true
  });

  // Cleanup staging directory
  fs.rmSync(stagingDir, { recursive: true, force: true });

  // Post-archive audit verification
  const auditScript = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem;
    $zip = [System.IO.Compression.ZipFile]::OpenRead('${winZip.replace(/'/g, "''")}');
    $bad = $zip.Entries | Where-Object { $_.FullName -match 'accounts\\.json$|models\\.json$|session-selections\\.json$|\\.log$|bridges/' };
    if ($bad) {
      $bad | ForEach-Object { Write-Error "Archive contains blacklisted entry: $($_.FullName)" };
      exit 1;
    }
    $zip.Dispose();
  `;
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', auditScript], {
    timeout: 15000,
    windowsHide: true
  });

  console.log(`[ReleaseBuilder] Archive security audit verified 100% clean.`);
  console.log(`[ReleaseBuilder] Successfully created:`);
  console.log(` - ${winZip} (${fs.statSync(winZip).size} bytes)`);
  console.log(` - ${macZip} (${fs.statSync(macZip).size} bytes)`);
} catch (e) {
  console.error('[ReleaseBuilder] Error:', e.message);
  process.exit(1);
}
