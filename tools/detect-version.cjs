'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');

/**
 * 探测本地已安装的 Antigravity 真实版本号
 */
function getAntigravityVersion() {
  const paths = require('../antigravity-claude-skin/tools/agy-paths.cjs');
  let resourcesDir = null;
  try {
    resourcesDir = paths.resolveResourcesDir({ refresh: true });
  } catch (_) {}

  if (!resourcesDir || !fs.existsSync(resourcesDir)) {
    return '2.28.2'; // 默认保底版本
  }

  // 1. 尝试从 resources/app/package.json 读取
  const appPkg = path.join(resourcesDir, 'app', 'package.json');
  if (fs.existsSync(appPkg)) {
    try {
      const data = JSON.parse(fs.readFileSync(appPkg, 'utf8'));
      if (data.version) return data.version;
    } catch (_) {}
  }

  // 2. Windows 平台：探测 Antigravity.exe 的 FileVersion
  if (process.platform === 'win32') {
    const exe = path.join(path.dirname(resourcesDir), 'Antigravity.exe');
    if (fs.existsSync(exe)) {
      try {
        const script = `(Get-Item -LiteralPath '${exe.replace(/'/g, "''")}').VersionInfo.FileVersion`;
        const ver = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 4000
        }).trim();
        if (ver) return ver;
      } catch (_) {}
    }
  }

  // 3. macOS 平台：探测 Info.plist
  if (process.platform === 'darwin') {
    const infoPlist = path.resolve(resourcesDir, '..', 'Info.plist');
    if (fs.existsSync(infoPlist)) {
      try {
        const ver = execFileSync('/usr/bin/defaults', ['read', infoPlist, 'CFBundleShortVersionString'], {
          encoding: 'utf8',
          timeout: 4000
        }).trim();
        if (ver) return ver;
      } catch (_) {}
    }
  }

  return '2.28.2';
}

function syncVersionInfo() {
  const rawVer = getAntigravityVersion();
  const match = rawVer.match(/^(\d+\.\d+)/);
  const majorMinor = match ? match[1] : '2.28';
  console.log(`[VersionDetector] 检测到本地 Antigravity 版本: ${rawVer} (适配分支: v2.22 ~ v${majorMinor}+)`);

  // 1. 同步 package.json
  const pkgPath = path.join(repoRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.description = `Antigravity API Manager: 第三方 API / 中转模型高效调度与多账号管理套件 (支持 Antigravity ${majorMinor}+ 最新版)`;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log(`[VersionDetector] package.json 描述已更新`);
  }

  // 2. 同步 README.md 中的版本声明
  const readmePath = path.join(repoRoot, 'README.md');
  if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, 'utf8');

    // 替换 badge
    readme = readme.replace(/Antigravity%20v[\d.]+%20~%20v[\d.]+%2B/g, `Antigravity%20v2.22%20~%20v${majorMinor}%2B`);
    // 替换正文适配范围
    readme = readme.replace(/适配 Antigravity v[\d.]+(?:\s*~\s*v[\d.]+\+)?(?:\s*最新版)?/g, `适配 Antigravity v2.22 ~ v${majorMinor}+ 最新版`);
    readme = readme.replace(/支持 Antigravity [\d.]+\+/g, `支持 Antigravity ${majorMinor}+`);
    readme = readme.replace(/最新版\s+最新版/g, '最新版');

    fs.writeFileSync(readmePath, readme, 'utf8');
    console.log(`[VersionDetector] README.md 版本标签与正文已同步更新`);
  }

  return { rawVer, majorMinor };
}

if (require.main === module) {
  syncVersionInfo();
}

module.exports = { getAntigravityVersion, syncVersionInfo };
