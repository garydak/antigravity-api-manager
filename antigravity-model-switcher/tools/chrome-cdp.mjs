/**
 * Google Chrome DevTools Protocol (CDP) 驱动模块
 * -------------------------------------------------------------------
 * 为中转模型提供直接连接与控制真实 Google Chrome 浏览器的能力。
 * 支持页面导航、点击、输入、滚动、JavaScript 求值与截屏。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DEFAULT_CDP_PORTS = [9333, 9222, 9223];
let activeSession = null;
let activeChromeProcess = null;

/**
 * 探测本地已安装的 Chrome 或 Chromium 浏览器路径
 */
export function findChromePath() {
    const platform = process.platform;
    const candidates = [];

    if (platform === 'win32') {
        const progFiles = process.env.ProgramFiles || 'C:\\Program Files';
        const progFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
        const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');

        candidates.push(
            path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
            path.join(progFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
            path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
            path.join(progFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
            path.join(progFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
        );
    } else if (platform === 'darwin') {
        candidates.push(
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium'
        );
    } else {
        candidates.push(
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
        );
    }

    for (const p of candidates) {
        if (p && fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}

/**
 * 检测指定端口是否已有可用的 Chrome CDP 调试服务
 */
export async function probeCdpPort(port) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
            signal: AbortSignal.timeout(1000)
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.webSocketDebuggerUrl) {
            return { port, version: data };
        }
    } catch {}
    return null;
}

/**
 * 启动一个带 CDP 远程调试端口的 Chrome 专属进程
 */
export async function launchChromeProcess(port = 9333) {
    const chromePath = findChromePath();
    if (!chromePath) {
        throw new Error('未在当前系统中找到 Google Chrome 浏览器，请先安装 Chrome。');
    }

    const profileDir = path.join(os.homedir(), '.gemini', 'antigravity', 'chrome-profile');
    fs.mkdirSync(profileDir, { recursive: true });

    const args = [
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
    ];

    const child = spawn(chromePath, args, {
        detached: true,
        stdio: 'ignore'
    });
    child.unref();
    activeChromeProcess = child;

    // 等待 Chrome 启动并就绪（最多等待 10 秒）
    const startTime = Date.now();
    while (Date.now() - startTime < 10000) {
        await new Promise(r => setTimeout(r, 600));
        const probe = await probeCdpPort(port);
        if (probe) {
            return probe;
        }
    }
    throw new Error(`启动 Chrome 超时，未能连接到端口 ${port}`);
}

/**
 * 确保 Chrome 实例已就绪并返回 CDP 目标端口
 */
export async function ensureChromeReady() {
    for (const port of DEFAULT_CDP_PORTS) {
        const probe = await probeCdpPort(port);
        if (probe) {
            return probe;
        }
    }
    // 未发现现成调试端口，启动一个专属端口 9333 的 Chrome 实例
    return await launchChromeProcess(9333);
}

/**
 * 建立与 Chrome 标签页的 CDP WebSocket 连接
 */
export async function getOrCreateChromeSession() {
    if (activeSession && activeSession.isOpen()) {
        return activeSession;
    }

    const { port } = await ensureChromeReady();
    const targetsRes = await fetch(`http://127.0.0.1:${port}/json`);
    let targets = await targetsRes.json();

    let pageTarget = Array.isArray(targets) ? targets.find(t => t.type === 'page' && !t.url.startsWith('devtools://')) : null;

    if (!pageTarget) {
        const newTabRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
        pageTarget = await newTabRes.json();
    }

    if (!pageTarget?.webSocketDebuggerUrl) {
        throw new Error('未获取到 Chrome 标签页的 WebSocket 调试地址');
    }

    const socket = new WebSocket(pageTarget.webSocketDebuggerUrl);

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            socket.close();
            reject(new Error('连接 Chrome CDP WebSocket 超时'));
        }, 8000);

        socket.addEventListener('open', () => {
            clearTimeout(timer);
            resolve();
        }, { once: true });

        socket.addEventListener('error', (err) => {
            clearTimeout(timer);
            reject(new Error(`连接 Chrome CDP 失败: ${err?.message || '未知错误'}`));
        }, { once: true });
    });

    let sequence = 0;
    const pending = new Map();
    const eventListeners = new Set();

    socket.addEventListener('message', (event) => {
        try {
            const msg = JSON.parse(String(event.data));
            if (msg.method) {
                for (const listener of eventListeners) {
                    listener(msg);
                }
            }
            if (!msg.id || !pending.has(msg.id)) return;
            const { resolve, reject, timer } = pending.get(msg.id);
            pending.delete(msg.id);
            clearTimeout(timer);
            if (msg.error) {
                reject(new Error(msg.error.message || 'CDP 命令错误'));
            } else {
                resolve(msg.result);
            }
        } catch {}
    });

    const call = (method, params = {}, timeoutMs = 20000) => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`CDP 命令超时: ${method}`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
    });

    // 启用基础能力
    await call('Page.enable');
    await call('Runtime.enable');
    await call('DOM.enable').catch(() => {});

    activeSession = {
        call,
        isOpen() {
            return socket.readyState === WebSocket.OPEN;
        },
        onEvent(listener) {
            eventListeners.add(listener);
            return () => eventListeners.delete(listener);
        },
        async evaluate(expression, timeoutMs = 15000) {
            const res = await call('Runtime.evaluate', {
                expression,
                awaitPromise: true,
                returnByValue: true
            }, timeoutMs);
            if (res.exceptionDetails) {
                throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text || '执行失败');
            }
            return res.result?.value;
        },
        close() {
            try {
                socket.close();
            } catch {}
            activeSession = null;
        }
    };

    socket.addEventListener('close', () => {
        activeSession = null;
    });

    return activeSession;
}

/**
 * 控制 Chrome 执行高级浏览器操作
 */
export async function executeChromeAction(args = {}) {
    const session = await getOrCreateChromeSession();
    const action = String(args.action || 'open').toLowerCase();

    // 1. 打开指定网页 / 导航 (open / navigate)
    if (action === 'open' || action === 'navigate' || action === 'goto') {
        const rawUrl = String(args.url || args.targetUrl || args.href || 'about:blank').trim();
        const targetUrl = /^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('about:') ? rawUrl : `https://${rawUrl}`;

        // 导航至目标网址
        await session.call('Page.navigate', { url: targetUrl });

        // 等待页面加载完成或最多 8 秒
        await new Promise((resolve) => {
            let done = false;
            const timer = setTimeout(() => { if (!done) { done = true; resolve(); } }, 8000);
            const unsubscribe = session.onEvent((event) => {
                if (event.method === 'Page.loadEventFired' || event.method === 'Page.domContentEventFired') {
                    if (!done) {
                        done = true;
                        clearTimeout(timer);
                        unsubscribe();
                        setTimeout(resolve, 500); // 留 500ms 渲染缓冲
                    }
                }
            });
        });

        // 提取页面标题、当前真实 URL 与正文纯文本
        const pageData = await session.evaluate(`
            (() => {
                const title = document.title || '';
                const url = location.href;
                const text = (document.body ? document.body.innerText : '')
                    .replace(/\\s+/g, ' ')
                    .trim()
                    .slice(0, 8000);
                return { title, url, text };
            })()
        `).catch(() => ({ title: '', url: targetUrl, text: '' }));

        return {
            ok: true,
            summary: `已在 Chrome 中打开: ${pageData.title || targetUrl}`,
            output: `Chrome 浏览器已导航至: ${pageData.url}\n页面标题: ${pageData.title}\n\n页面正文摘要:\n${pageData.text}`,
            extra: { url: pageData.url, title: pageData.title }
        };
    }

    // 2. 点击页面指定元素 (click)
    if (action === 'click') {
        const selector = String(args.selector || args.target || '').trim();
        if (!selector) {
            throw new Error('click 操作需要提供 selector 参数 (CSS选择器)');
        }
        const clickResult = await session.evaluate(`
            (() => {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return { success: false, error: '未找到匹配的元素: ' + ${JSON.stringify(selector)} };
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.click();
                return {
                    success: true,
                    tagName: el.tagName,
                    text: (el.innerText || el.value || '').trim().slice(0, 100)
                };
            })()
        `);
        if (!clickResult.success) {
            return {
                ok: false,
                summary: `点击失败: 找不到元素 ${selector}`,
                output: clickResult.error
            };
        }
        return {
            ok: true,
            summary: `已点击元素: ${selector}`,
            output: `已成功在 Chrome 中点击元素 "${selector}" (标签: <${clickResult.tagName.toLowerCase()}>, 文本: "${clickResult.text}")`
        };
    }

    // 3. 在输入框填充内容 (type / input)
    if (action === 'type' || action === 'input' || action === 'fill') {
        const selector = String(args.selector || '').trim();
        const text = String(args.text || args.value || '');
        if (!selector) {
            throw new Error('type 操作需要提供 selector 参数');
        }
        const inputResult = await session.evaluate(`
            (() => {
                const el = document.querySelector(${JSON.stringify(selector)});
                if (!el) return { success: false, error: '未找到输入框元素: ' + ${JSON.stringify(selector)} };
                el.focus();
                el.value = ${JSON.stringify(text)};
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true };
            })()
        `);
        if (!inputResult.success) {
            return { ok: false, summary: `输入失败: 找不到元素 ${selector}`, output: inputResult.error };
        }
        return {
            ok: true,
            summary: `已在 ${selector} 中输入内容`,
            output: `已成功在 "${selector}" 中输入文本: "${text}"`
        };
    }

    // 4. 网页截屏 (screenshot)
    if (action === 'screenshot' || action === 'capture') {
        const screenshotRes = await session.call('Page.captureScreenshot', { format: 'png', quality: 90 });
        const base64Data = screenshotRes.data;
        const tempDir = path.join(os.homedir(), '.gemini', 'antigravity', 'screenshots');
        fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, `chrome_shot_${Date.now()}.png`);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        return {
            ok: true,
            summary: '已截取 Chrome 网页画面',
            output: `屏幕截图已保存至: ${filePath}`,
            extra: { filePath, base64: `data:image/png;base64,${base64Data.slice(0, 100)}...` }
        };
    }

    // 5. 滚动页面 (scroll)
    if (action === 'scroll') {
        const direction = String(args.direction || 'down').toLowerCase();
        const amount = Number(args.amount) || 500;
        const delta = direction === 'up' ? -amount : amount;
        await session.evaluate(`window.scrollBy({ top: ${delta}, behavior: 'smooth' })`);
        return {
            ok: true,
            summary: `已向${direction === 'up' ? '上' : '下'}滚动 ${amount} 像素`,
            output: `已在 Chrome 页面中完成滚动 (方向: ${direction}, 像素: ${amount})`
        };
    }

    // 6. 执行自定义 JavaScript (evaluate)
    if (action === 'evaluate' || action === 'eval' || action === 'js') {
        const script = String(args.script || args.expression || '').trim();
        if (!script) throw new Error('evaluate 需要提供 script 参数');
        const evalVal = await session.evaluate(script);
        return {
            ok: true,
            summary: '已执行页面 JavaScript',
            output: typeof evalVal === 'object' ? JSON.stringify(evalVal, null, 2) : String(evalVal)
        };
    }

    // 7. 读取当前页面状态与内容 (content)
    if (action === 'content' || action === 'get_content') {
        const contentData = await session.evaluate(`
            (() => {
                return {
                    title: document.title,
                    url: location.href,
                    text: (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').trim().slice(0, 10000)
                };
            })()
        `);
        return {
            ok: true,
            summary: `读取到页面: ${contentData.title || contentData.url}`,
            output: `当前 Chrome 页面: ${contentData.url}\n标题: ${contentData.title}\n\n内容:\n${contentData.text}`
        };
    }

    throw new Error(`不支持的浏览器操作类型: ${action}`);
}
