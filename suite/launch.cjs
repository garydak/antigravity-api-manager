'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const paths = require('../antigravity-claude-skin/tools/agy-paths.cjs');
const proxy = require('../antigravity-claude-skin/tools/native-proxy.cjs');
const runtime = path.resolve(__dirname, '..');
const scriptFile = path.join(runtime, 'data', 'launch-antigravity.vbs');
const shortcutBackup = path.join(runtime, 'data', 'desktop-shortcut.before.lnk');
const logFile = path.join(runtime, 'data', 'launcher.log');

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}\n`;
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, line);
  } catch (_) {}
}

async function waitAndInjectLive(maxWaitMs = 25000) {
  log('Starting waitAndInjectLive...');
  const installCore = require('../antigravity-claude-skin/tools/install-core.js');
  const startTime = Date.now();
  let attempts = 0;
  while (Date.now() - startTime < maxWaitMs) {
    attempts++;
    await new Promise(r => setTimeout(r, 600));
    try {
      log(`Attempt ${attempts}: probing CDP...`);
      const res = await installCore.injectLiveViaCdp();
      log(`Attempt ${attempts} result:`, res);
      if (res && (res.injected > 0 || res.recovered > 0 || res.active > 0)) {
        log('Injection SUCCESS!');
        return true;
      }
    } catch (err) {
      log(`Attempt ${attempts} error:`, err.message);
    }
  }
  log('waitAndInjectLive TIMEOUT after', attempts, 'attempts');
  return false;
}

function launch(options = {}) {
  log('launch() called');
  const resources = options.resourcesDir || paths.resolveResourcesDir({ refresh: true });
  try {
    const installCore = require('../antigravity-claude-skin/tools/install-core.js');
    installCore.installNativeAppHook({ resourcesDir: resources });
  } catch (err) {
    log('Lazy auto-heal hook error:', err.message);
  }
  const exe = path.join(path.dirname(resources), 'Antigravity.exe');
  if (!fs.existsSync(exe)) {
    log('Antigravity.exe not found at:', exe);
    throw Error('Antigravity executable is unavailable');
  }
  const env = { ...process.env, ...proxy.getProxyEnvironment() };
  
  const servers = [];
  for (const [protocol, key] of [['http', 'HTTP_PROXY'], ['https', 'HTTPS_PROXY']]) {
    if (!env[key]) continue;
    try {
      const server = new URL(env[key]);
      if (!server.username && !server.password) servers.push(protocol + '=' + server.protocol.replace('socks5h:', 'socks5:') + '//' + server.host);
    } catch (_) {}
  }
  const args = [
    '--proxy-bypass-list=' + proxy.loopbackBypass(),
    '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1'
  ];
  if (servers.length) args.push('--proxy-server=' + servers.join(';'));
  
  log('Spawning exe:', exe, 'with args:', args);
  const child = spawn(exe, args, {
    cwd: path.dirname(exe), env, detached: true, stdio: 'ignore', windowsHide: false
  });
  child.on('error', error => { log('Child process error:', error.message); process.exitCode = 1; });
  child.unref();

  log('Spawned PID:', child.pid);
  return { pid: child.pid };
}

function installDesktopLauncher(resources) {
  if (process.platform !== 'win32') return { skipped: true };
  const exe = path.join(path.dirname(resources), 'Antigravity.exe');
  if (!fs.existsSync(exe)) return { skipped: true };
  const quote = value => '"' + value.replaceAll('"', '""') + '"';
  const command = '"' + paths.resolveNodeBin() + '" "' + __filename + '"';
  const vbs = '\' AGY_SUITE_LAUNCHER\nCreateObject("WScript.Shell").Run ' + quote(command) + ', 0, False\n';
  fs.mkdirSync(path.dirname(scriptFile), { recursive: true });
  const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(vbs, 'utf16le')]);
  if (!fs.existsSync(scriptFile) || !fs.readFileSync(scriptFile).equals(bytes)) fs.writeFileSync(scriptFile, bytes);
  
  const script = [
    "$ErrorActionPreference='SilentlyContinue';",
    "$paths = @(",
    "  Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Antigravity.lnk',",
    "  Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'Antigravity.lnk',",
    "  Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\\Antigravity.lnk'",
    ");",
    "$sh = New-Object -ComObject WScript.Shell;",
    "$target = Join-Path $env:WINDIR 'System32\\wscript.exe';",
    "$args = '//B //Nologo \"' + $env:AGY_LAUNCH_SCRIPT + '\"';",
    "foreach ($file in $paths) {",
    "  if (Test-Path -LiteralPath $file) {",
    "    $link = $sh.CreateShortcut($file);",
    "    $owned = $link.Arguments.Contains($env:AGY_LAUNCH_SCRIPT);",
    "    if (!$owned -and (Split-Path -Leaf $link.TargetPath) -ieq 'Antigravity.exe') {",
    "      Copy-Item -LiteralPath $file -Destination ($file + '.before.lnk') -Force;",
    "    }",
    "    $link.TargetPath = $target;",
    "    $link.Arguments = $args;",
    "    $link.WorkingDirectory = Split-Path -Parent $env:AGY_APP_EXE;",
    "    $link.IconLocation = $env:AGY_APP_EXE + ',0';",
    "    $link.Save();",
    "  }",
    "};",
    "'{\"changed\":true}'"
  ].join(' ');

  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: { ...process.env, AGY_LAUNCH_SCRIPT: scriptFile, AGY_SHORTCUT_BACKUP: shortcutBackup, AGY_APP_EXE: exe },
    windowsHide: true, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
  
  let result = { changed: true };
  try { result = JSON.parse(output); } catch (_) {}
  return result;
}

function restoreDesktopLauncher() {
  if (process.platform !== 'win32') return;
  const script = [
    "$ErrorActionPreference='SilentlyContinue';",
    "$paths = @(",
    "  Join-Path ([Environment]::GetFolderPath('DesktopDirectory')) 'Antigravity.lnk',",
    "  Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\\Antigravity.lnk'",
    ");",
    "foreach ($file in $paths) {",
    "  $bak = $file + '.before.lnk';",
    "  if (Test-Path -LiteralPath $bak) {",
    "    Copy-Item -LiteralPath $bak -Destination $file -Force;",
    "    Remove-Item -LiteralPath $bak -Force;",
    "  }",
    "}"
  ].join(' ');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 5000 });
}

if (require.main === module) {
  log('Launcher process started. argv:', process.argv);
  try {
    launch();
    waitAndInjectLive().then((ok) => {
      log('waitAndInjectLive finished, ok=', ok);
      process.exit(0);
    }).catch((err) => {
      log('waitAndInjectLive caught fatal:', err.message);
      process.exit(0);
    });
  } catch (error) {
    log('Fatal launch error:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { launch, installDesktopLauncher, restoreDesktopLauncher, waitAndInjectLive };
