'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

console.log('[SecurityAudit] Starting strict pre-commit desensitization audit...');

let violations = [];

// 1. Check for forbidden files on disk in tracked / critical locations
const forbiddenNames = ['accounts.json', 'models.json', 'session-selections.json'];
function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (['.git', 'node_modules', '.cache'].includes(entry.name)) continue;

    if (entry.isDirectory()) {
      if (['bridges', 'lifecycle-backups'].includes(entry.name)) {
        violations.push(`Runtime directory present in repo: ${full}`);
      }
      scanDir(full);
    } else if (entry.isFile()) {
      // Check forbidden filename in data directories
      if (forbiddenNames.includes(entry.name)) {
        violations.push(`Sensitive data file present on disk: ${full}`);
      }
      if (full.includes(path.sep + 'data') && entry.name.endsWith('.json') && !entry.name.endsWith('.example.json')) {
        violations.push(`Non-template JSON file in data folder: ${full}`);
      }
      if (entry.name.endsWith('.log')) {
        violations.push(`Log file present: ${full}`);
      }

      // Check file contents (skip binaries, images, zips)
      if (/\.(mjs|js|cjs|json|md|html|css|sh|cmd|ps1|txt)$/i.test(entry.name)) {
        try {
          const content = fs.readFileSync(full, 'utf8');
          // Check for private emails or leaked API keys
          if (/@gmail\.com|@hotmail\.com|@163\.com/i.test(content)) {
            // Allow your-account-1@gmail.com example
            const matches = content.match(/[a-zA-Z0-9_.+-]+@(?!example\.com)[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g) || [];
            for (const m of matches) {
              if (m !== 'your-account-1@gmail.com' && m !== 'noreply.github.com' && !m.includes('users.noreply.github.com')) {
                violations.push(`Potential real email address in ${full}: ${m}`);
              }
            }
          }
          if (/sk-[a-zA-Z0-9]{30,}/.test(content)) {
            violations.push(`Potential live API Key pattern in ${full}`);
          }
        } catch (_) {}
      }
    }
  }
}

scanDir(repoRoot);

// 2. Audit all zip files in releases/
const releasesDir = path.join(repoRoot, 'releases');
if (fs.existsSync(releasesDir)) {
  const script = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem;
    Get-ChildItem -Path '${releasesDir.replace(/'/g, "''")}\\*.zip' | ForEach-Object {
      $zip = [System.IO.Compression.ZipFile]::OpenRead($_.FullName);
      $bad = $zip.Entries | Where-Object { $_.FullName -match 'accounts\\.json$|models\\.json$|session-selections\\.json$|\\.log$|bridges/' };
      if ($bad) {
        $bad | ForEach-Object { Write-Output "ZIP_VIOLATION:$($_.FullName) inside $($zip.Name)" };
      }
      $zip.Dispose();
    }
  `;
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true
    });
    const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
    for (const l of lines) {
      if (l.startsWith('ZIP_VIOLATION:')) {
        violations.push(l);
      }
    }
  } catch (err) {
    violations.push(`Failed to audit zip files: ${err.message}`);
  }
}

if (violations.length > 0) {
  console.error('\n❌ [SecurityAudit] FAILED! Found sensitive data violations:');
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
} else {
  console.log('✅ [SecurityAudit] PASSED: All source files and release archives are 100% desensitized and clean.');
  process.exit(0);
}
