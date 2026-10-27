import { execFileSync, spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const requireCjs = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WIN_CRED_PS1 = path.join(__dirname, "win-cred.ps1");
const DAEMON_JS = path.join(__dirname, "daemon.mjs");
const LOG_FILE = path.join(__dirname, "..", "data", "switch.log");

function log(msg) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`, "utf8");
  } catch {}
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDaemonAlive() {
  try {
    const nodeBin = (process.env.AGY_NODE_BIN && fs.existsSync(process.env.AGY_NODE_BIN))
      ? process.env.AGY_NODE_BIN
      : process.execPath;
    const child = spawn(nodeBin, [DAEMON_JS], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
  } catch {}
}

function writeCredentialAndStorage(email, payloadBase64) {
  // 1. Write to Windows Credential Manager (gemini:antigravity)
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        WIN_CRED_PS1,
        "-Action",
        "write",
        "-Target",
        "gemini:antigravity",
        "-UserName",
        "antigravity",
        "-PayloadBase64",
        payloadBase64,
      ],
      { windowsHide: true, encoding: "utf8", timeout: 8000 }
    );
  } catch (err) {
    log(`CredWrite error: ${err.message}`);
  }

  // 2. Update %APPDATA%\Antigravity\app_storage.json
  try {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    const storagePath = path.join(appData, "Antigravity", "app_storage.json");
    let data = {};
    if (fs.existsSync(storagePath)) {
      data = JSON.parse(fs.readFileSync(storagePath, "utf8"));
    }
    data["jetski.onboarding.lastLoginUsername"] = email;
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    fs.writeFileSync(storagePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    log(`app_storage update error: ${err.message}`);
  }

  // 3. Also sync ~/.gemini/antigravity-cli/antigravity-oauth-token if folder exists
  try {
    const cliDir = path.join(os.homedir(), ".gemini", "antigravity-cli");
    if (fs.existsSync(cliDir)) {
      const rawJson = Buffer.from(payloadBase64, "base64").toString("utf8");
      fs.writeFileSync(path.join(cliDir, "antigravity-oauth-token"), rawJson, "utf8");
    }
  } catch {}
}

function killLanguageServerOnly() {
  try {
    const out = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='language_server.exe'\" | Select-Object -ExpandProperty ProcessId",
      ],
      { windowsHide: true, encoding: "utf8", timeout: 6000 }
    );
    const pids = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s));

    log(`Found language_server.exe PIDs: ${pids.join(", ") || "none"}`);
    for (const pid of pids) {
      try {
        execFileSync("taskkill.exe", ["/F", "/PID", pid], {
          windowsHide: true,
          stdio: "ignore",
          timeout: 5000,
        });
        log(`Killed language_server.exe PID ${pid}`);
      } catch (e) {
        log(`taskkill PID ${pid} warning: ${e.message}`);
      }
    }
    return pids.length > 0;
  } catch (err) {
    log(`killLanguageServerOnly error: ${err.message}`);
    return false;
  }
}

async function reinjectAfterSwitch() {
  try {
    const installCorePath = path.join(__dirname, "..", "..", "antigravity-claude-skin", "tools", "install-core.js");
    if (!fs.existsSync(installCorePath)) return;
    const installCore = requireCjs(installCorePath);
    // Electron waits RESTART_COOLDOWN_MS (2000ms) before spawning the new language_server
    // and navigating the window to the new HTTPS port via onPortChanged.
    await sleep(2200);
    const deadline = Date.now() + 18000;
    while (Date.now() < deadline) {
      try {
        const res = await installCore.injectLiveViaCdp({ onlyIfMissing: true });
        if (res && res.injected > 0) {
          log(`Re-injected suite into new language_server session (injected=${res.injected})`);
          await sleep(1500);
          await installCore.injectLiveViaCdp({ onlyIfMissing: true }).catch(() => {});
          return;
        }
      } catch {}
      await sleep(700);
    }
    await installCore.injectLiveViaCdp({ onlyIfMissing: true }).catch(() => {});
  } catch (err) {
    log(`reinjectAfterSwitch warning: ${err.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  let email = "";
  let payloadBase64 = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--email" && args[i + 1]) email = args[++i];
    else if (args[i] === "--payload-b64" && args[i + 1]) payloadBase64 = args[++i];
  }

  if (!email || !payloadBase64) {
    log("Missing --email or --payload-b64");
    process.exit(1);
  }

  log(`Starting seamless hot-switch to ${email}...`);
  ensureDaemonAlive();
  await sleep(180);

  // Step 1: Pre-write credentials before killing language_server
  writeCredentialAndStorage(email, payloadBase64);

  // Step 2: Kill only language_server.exe so Electron supervisor respawns it
  const killed = killLanguageServerOnly();

  // Step 3: Re-assert credentials after language_server death (in case it flushed old token on exit)
  if (killed) {
    await sleep(220);
    writeCredentialAndStorage(email, payloadBase64);
    await sleep(320);
    writeCredentialAndStorage(email, payloadBase64);
  }

  ensureDaemonAlive();
  log(`Hot-switch credentials applied for ${email}; waiting for window reload to re-inject suite...`);
  await reinjectAfterSwitch();
  log(`Hot-switch to ${email} completed.`);
  process.exit(0);
}

main().catch((err) => {
  log(`Fatal error in hot-switch-worker: ${err.stack || err.message}`);
  process.exit(1);
});
