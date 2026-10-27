/**
 * Suite Watchdog (event-driven renderer self-heal via browserWebSocketUrl)
 *
 * Why: Antigravity's Electron binary has OnlyLoadAppFromAsar enabled, so
 * resources/app/index.js is ignored. Whenever a renderer window reloads
 * (Ctrl+R) or navigates to a new language_server port after an account
 * hot-switch, all injected modules (Chinese i18n, relay model switcher,
 * suite control center) are wiped from the page.
 *
 * By connecting to the browser-level CDP endpoint (browserWebSocketUrl) and
 * attaching with flatten:true, this session stays permanently open (never
 * conflicts with page-level WebSockets opened by injectLiveViaCdp) and
 * receives instant Page/Runtime navigation events with 0% idle CPU polling.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKIN_TOOLS = path.join(__dirname, "..", "..", "antigravity-claude-skin", "tools");

let socket = null;
let connecting = false;
let injecting = false;
let pendingTimers = [];
let seq = 1;
const attachedTargets = new Set();
let log = () => {};

function core() {
  return require(path.join(SKIN_TOOLS, "install-core.js"));
}

async function injectIfMissing() {
  if (injecting) return;
  injecting = true;
  try {
    const res = await core().injectLiveViaCdp({ onlyIfMissing: true });
    if (res?.injected) log(`[Watchdog] Re-injected suite into ${res.injected} window(s)`);
  } catch {
    // App may be mid-navigation; next scheduled burst timer will retry.
  } finally {
    injecting = false;
  }
}

function scheduleInjectBurst() {
  for (const t of pendingTimers) clearTimeout(t);
  pendingTimers = [350, 1000, 2200, 4500, 8000].map((ms) => setTimeout(injectIfMissing, ms));
}

function isAppPageTarget(info) {
  return info && info.type === "page" && /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(info.url || "");
}

function attachPageTarget(ws, targetId) {
  if (!ws || ws.readyState !== 1 || attachedTargets.has(targetId)) return;
  attachedTargets.add(targetId);
  ws.send(
    JSON.stringify({
      id: seq++,
      method: "Target.attachToTarget",
      params: { targetId, flatten: true },
    })
  );
}

async function connect() {
  if (socket || connecting) return;
  connecting = true;
  try {
    const { discoverCdp } = require(path.join(SKIN_TOOLS, "cdp-discovery.cjs"));
    const ep = await discoverCdp();
    if (!ep?.browserWebSocketUrl) return;

    const ws = new WebSocket(ep.browserWebSocketUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        reject(new Error("timeout"));
      }, 4000);
      ws.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      ws.addEventListener("error", () => { clearTimeout(timer); reject(new Error("error")); }, { once: true });
    });

    socket = ws;
    attachedTargets.clear();

    ws.addEventListener("message", (event) => {
      let msg;
      try { msg = JSON.parse(String(event.data)); } catch { return; }

      if (msg.method === "Target.attachedToTarget" && msg.params?.sessionId) {
        const sid = msg.params.sessionId;
        ws.send(JSON.stringify({ id: seq++, sessionId: sid, method: "Page.enable", params: {} }));
        ws.send(JSON.stringify({ id: seq++, sessionId: sid, method: "Runtime.enable", params: {} }));
        scheduleInjectBurst();
        return;
      }

      if (msg.method === "Target.detachedFromTarget" && msg.params?.targetId) {
        attachedTargets.delete(msg.params.targetId);
        return;
      }

      if (msg.method === "Target.targetCreated" || msg.method === "Target.targetInfoChanged") {
        const info = msg.params?.targetInfo;
        if (isAppPageTarget(info)) {
          attachPageTarget(ws, info.targetId);
          scheduleInjectBurst();
        }
        return;
      }

      if (
        msg.method === "Page.loadEventFired" ||
        msg.method === "Page.domContentEventFired" ||
        msg.method === "Runtime.executionContextsCleared" ||
        (msg.method === "Page.frameNavigated" && !msg.params?.frame?.parentId)
      ) {
        scheduleInjectBurst();
      }
    });

    ws.addEventListener("close", () => {
      if (socket === ws) {
        socket = null;
        attachedTargets.clear();
      }
    });
    ws.addEventListener("error", () => {
      if (socket === ws) {
        socket = null;
        attachedTargets.clear();
      }
    });

    ws.send(JSON.stringify({ id: seq++, method: "Target.setDiscoverTargets", params: { discover: true } }));
    for (const t of ep.targets || []) {
      if (isAppPageTarget(t)) attachPageTarget(ws, t.id);
    }

    log(`[Watchdog] Attached to browser CDP on port ${ep.port}`);
    scheduleInjectBurst();
  } catch {
    // Antigravity not running / not ready yet; retry on next tick.
  } finally {
    connecting = false;
  }
}

export function startSuiteWatchdog(logger) {
  if (globalThis.__AGY_SUITE_WATCHDOG__) return;
  globalThis.__AGY_SUITE_WATCHDOG__ = true;
  if (typeof logger === "function") log = logger;
  connect();
  const timer = setInterval(() => {
    if (!socket) connect();
  }, 5000);
  timer.unref?.();
}
