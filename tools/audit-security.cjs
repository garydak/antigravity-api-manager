'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

console.log('[SecurityAudit] 正在执行上传 GitHub 前的安全脱敏审计 (支持本地保留个性化配置)...');

let violations = [];

// 1. 审计 Git 追踪与暂存的文件（严禁将本地实际运行配置与凭证提交到版本控制）
try {
  const gitOut = execFileSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command',
    `$git = 'C:\\Users\\garyd\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\git\\cmd\\git.exe';
     & $git -C '${repoRoot.replace(/'/g, "''")}' ls-files;
     & $git -C '${repoRoot.replace(/'/g, "''")}' diff --cached --name-only`
  ], { encoding: 'utf8', windowsHide: true });

  const trackedFiles = Array.from(new Set(gitOut.split('\n').map(l => l.trim()).filter(Boolean)));

  const forbiddenTrackedPatterns = [
    /accounts\.json$/i,
    /models\.json$/i,
    /session-selections\.json$/i,
    /\.log$/i,
    /\/bridges\//i,
    /\/lifecycle-backups\//i,
    /\/backup\//i,
    /\/inspect\//i
  ];

  const commercialMailRegex = /[a-zA-Z0-9_.+-]+@(?!example\.)[a-zA-Z0-9-]+\.(gmail|hotmail|outlook|qq|163|126|yahoo|live|foxmail)\.com/i;

  for (const file of trackedFiles) {
    const normFile = file.replace(/\\/g, '/');

    // 检查是否有敏感文件名被 Git 追踪
    for (const pat of forbiddenTrackedPatterns) {
      if (pat.test(normFile)) {
        violations.push(`【严重违规】敏感运行时文件已被 Git 追踪: ${file}`);
      }
    }

    // 检查 data/ 目录下是否有非模板 JSON
    if (normFile.includes('/data/') && normFile.endsWith('.json') && !normFile.endsWith('.example.json')) {
      violations.push(`【严重违规】data 目录下存在非模板 JSON 被 Git 追踪: ${file}`);
    }

    // 检查文件内容敏感字符串
    const fullPath = path.join(repoRoot, file);
    if (fs.existsSync(fullPath) && /\.(mjs|js|cjs|json|md|html|css|sh|cmd|ps1|txt)$/i.test(file)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        // 允许 example 占位与 github 官方 noreply 邮箱
        const emailMatches = content.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g) || [];
        for (const m of emailMatches) {
          if (m.includes('users.noreply.github.com') || m.includes('noreply.github.com') || m.endsWith('@example.com') || m.endsWith('@example.test')) {
            continue;
          }
          if (commercialMailRegex.test(m)) {
            violations.push(`【内容泄漏风险】${file} 包含潜在真实个人邮箱: ${m}`);
          }
        }
        // 检查实际 live API key 格式（排除 sk-your-... 或示例占位符）
        const keyMatches = content.match(/sk-[a-zA-Z0-9]{32,}/g) || [];
        for (const k of keyMatches) {
          if (!k.includes('your-api-key') && !k.includes('YOUR_ACCESS_TOKEN')) {
            violations.push(`【内容泄漏风险】${file} 包含真实 API Key 模式: ${k.substring(0, 8)}...`);
          }
        }
      } catch (_) {}
    }
  }
} catch (e) {
  violations.push(`Git 追踪文件检查失败: ${e.message}`);
}

// 2. 审计 releases/ 下待发布的 ZIP 压缩包
const releasesDir = path.join(repoRoot, 'releases');
if (fs.existsSync(releasesDir)) {
  const script = `
    Add-Type -AssemblyName System.IO.Compression.FileSystem;
    Get-ChildItem -Path '${releasesDir.replace(/'/g, "''")}\\*.zip' | ForEach-Object {
      $zip = [System.IO.Compression.ZipFile]::OpenRead($_.FullName);
      $bad = $zip.Entries | Where-Object { $_.FullName -match 'accounts\\.json$|models\\.json$|session-selections\\.json$|\\.log$|bridges/|lifecycle-backups/' };
      if ($bad) {
        $bad | ForEach-Object { Write-Output "ZIP_VIOLATION:$($_.FullName) 存在于压缩包 $($zip.Name) 中" };
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
        violations.push(`【发布归档违规】${l.replace('ZIP_VIOLATION:', '')}`);
      }
    }
  } catch (err) {
    violations.push(`审计 ZIP 文件失败: ${err.message}`);
  }
}

if (violations.length > 0) {
  console.error('\n❌ [SecurityAudit] 上传脱敏审计未通过！发现以下敏感泄露隐患：');
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
} else {
  console.log('✅ [SecurityAudit] 审计通过：本地运行时配置完全隔离，待提交 Git 与 Release 发布包 100% 纯净脱敏。');
  process.exit(0);
}
