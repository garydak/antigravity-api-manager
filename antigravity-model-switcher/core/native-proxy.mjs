/**
 * Antigravity Native Proxy Server (Gemini ➔ OpenAI/Claude 反向代理服务 - 动态双模版)
 * ----------------------------------------------------------------------------------
 * 拦截 language_server.exe 的请求：
 * - 方案一 (官方模型模式 / activeMode === 'official')：透明透传至 Google 官方端点
 * - 方案二 (中转模型模式 / activeMode === 'custom')：无缝转换为 OpenAI/Claude 协议，将 Antigravity 全套原生工具 (browser, 终端, Diff, MCP) 转给中转站
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { loadModelStore, getActiveCustomModel } from './model-store.mjs';
import { geminiToOpenAI, geminiToClaude, createGeminiChunkFormatter } from './gemini-adapter.mjs';

const GOOGLE_API_HOST = 'generativelanguage.googleapis.com';

/**
 * 方案一：将请求原样透明透传至 Google 官方服务器
 */
async function forwardToGoogle(req, res, bodyBuffer) {
    const googleUrl = `https://${GOOGLE_API_HOST}${req.url}`;
    try {
        const forwardHeaders = { ...req.headers, host: GOOGLE_API_HOST };
        delete forwardHeaders['content-length'];
        
        const fetchRes = await fetch(googleUrl, {
            method: req.method,
            headers: forwardHeaders,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : bodyBuffer
        });

        const headers = {};
        fetchRes.headers.forEach((val, key) => {
            headers[key] = val;
        });

        res.writeHead(fetchRes.status, headers);
        if (fetchRes.body) {
            const reader = fetchRes.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
        }
        res.end();
    } catch (err) {
        console.error('[NativeProxy] Forward to Google failed:', err.message);
        if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { code: 502, message: `Proxy to Google error: ${err.message}` } }));
        }
    }
}

/**
 * 方案二：处理中转模型生成请求并驱动原生工具
 */
async function handleCustomGenerate(req, res, geminiBody, targetModel) {
    const formatter = createGeminiChunkFormatter();
    const protocol = String(targetModel.resolvedProtocol || targetModel.protocol || 'openai').toLowerCase();

    // 设置标准的 Gemini SSE 响应头
    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked'
    });

    try {
        if (protocol === 'anthropic') {
            await streamClaudeChat(res, geminiBody, targetModel, formatter);
        } else {
            await streamOpenAIChat(res, geminiBody, targetModel, formatter);
        }
    } catch (err) {
        console.error('[NativeProxy] Error in custom model generation:', err);
        res.write(formatter.formatTextChunk(`\n[NativeProxy Error: ${err.message}]`));
        res.write(formatter.formatFinishChunk('ERROR'));
        res.end();
    }
}

/**
 * 调用 OpenAI 兼容中转站并转为 Gemini SSE 流
 */
async function streamOpenAIChat(res, geminiBody, targetModel, formatter) {
    const payload = geminiToOpenAI(geminiBody, targetModel);
    let baseUrl = targetModel.baseUrl || 'https://api.openai.com/v1';
    baseUrl = baseUrl.replace(/\/+$/, '');
    const url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${targetModel.apiKey}`,
        'Accept': 'text/event-stream'
    };

    const fetchRes = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    if (!fetchRes.ok) {
        const errText = await fetchRes.text();
        throw new Error(`Upstream returned ${fetchRes.status}: ${errText.slice(0, 300)}`);
    }

    const reader = fetchRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    // 缓存累积流式返回的 tool_calls
    const toolCallsMap = new Map();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            if (trimmed === 'data: [DONE]') continue;

            try {
                const data = JSON.parse(trimmed.slice(5).trim());
                const choice = data.choices?.[0];
                if (!choice) continue;

                // 1. 处理思考内容 (Reasoning / Thinking) - 输出原生 thought: true
                const reasoning = choice.delta?.reasoning_content || choice.delta?.reasoning;
                if (reasoning) {
                    res.write(formatter.formatThoughtChunk(reasoning));
                }

                // 2. 处理正文文本内容
                const content = choice.delta?.content;
                if (content) {
                    res.write(formatter.formatTextChunk(content));
                }

                // 3. 处理工具调用累积
                if (Array.isArray(choice.delta?.tool_calls)) {
                    for (const tc of choice.delta.tool_calls) {
                        const idx = tc.index ?? 0;
                        if (!toolCallsMap.has(idx)) {
                            toolCallsMap.set(idx, {
                                name: tc.function?.name || '',
                                args: tc.function?.arguments || ''
                            });
                        } else {
                            const cur = toolCallsMap.get(idx);
                            if (tc.function?.name) cur.name += tc.function.name;
                            if (tc.function?.arguments) cur.args += tc.function.arguments;
                        }
                    }
                }
            } catch {
                // 忽略非 JSON 行
            }
        }
    }

    // 流结束，若有工具调用，发射 Gemini 原生 functionCall
    if (toolCallsMap.size > 0) {
        for (const [, call] of toolCallsMap.entries()) {
            res.write(formatter.formatFunctionCallChunk(call.name, call.args));
        }
    } else {
        res.write(formatter.formatFinishChunk('STOP'));
    }

    res.end();
}

/**
 * 调用 Claude Messages 原生协议并转为 Gemini SSE 流
 */
async function streamClaudeChat(res, geminiBody, targetModel, formatter) {
    const payload = geminiToClaude(geminiBody, targetModel);
    let baseUrl = targetModel.baseUrl || 'https://api.anthropic.com/v1';
    baseUrl = baseUrl.replace(/\/+$/, '');
    const url = baseUrl.endsWith('/messages') ? baseUrl : `${baseUrl}/messages`;

    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': targetModel.apiKey,
        'anthropic-version': '2023-06-01',
        'Accept': 'text/event-stream'
    };

    const fetchRes = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
    });

    if (!fetchRes.ok) {
        const errText = await fetchRes.text();
        throw new Error(`Upstream returned ${fetchRes.status}: ${errText.slice(0, 300)}`);
    }

    const reader = fetchRes.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    const toolBlocksMap = new Map();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            try {
                const eventData = JSON.parse(trimmed.slice(5).trim());
                const type = eventData.type;
                const idx = eventData.index ?? 0;

                if (type === 'content_block_start' && eventData.content_block?.type === 'tool_use') {
                    toolBlocksMap.set(idx, {
                        name: eventData.content_block.name,
                        input: ''
                    });
                } else if (type === 'content_block_delta') {
                    if (eventData.delta?.type === 'thinking_delta') {
                        res.write(formatter.formatThoughtChunk(eventData.delta.thinking));
                    } else if (eventData.delta?.type === 'text_delta') {
                        res.write(formatter.formatTextChunk(eventData.delta.text));
                    } else if (eventData.delta?.type === 'input_json_delta') {
                        const cur = toolBlocksMap.get(idx);
                        if (cur) {
                            cur.input += eventData.delta.partial_json;
                        }
                    }
                } else if (type === 'content_block_stop') {
                    const finishedTool = toolBlocksMap.get(idx);
                    if (finishedTool && finishedTool.name) {
                        res.write(formatter.formatFunctionCallChunk(finishedTool.name, finishedTool.input));
                    }
                }
            } catch {
                // 忽略非 JSON 行
            }
        }
    }

    res.write(formatter.formatFinishChunk('STOP'));
    res.end();
}

/**
 * 核心请求分发器 (双模动态切换入口)
 */
export async function handleNativeProxyRequest(req, res) {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
        const bodyBuffer = Buffer.concat(chunks);
        const urlObj = new URL(req.url, 'http://127.0.0.1');
        const pathname = urlObj.pathname;

        // 判断是否为大模型生成请求
        const isGenerateRequest = pathname.includes(':streamGenerateContent') || 
                                  pathname.includes(':generateContent') ||
                                  pathname.includes('/streamGenerateContent') ||
                                  pathname.includes('/generateContent');

        // 读取当前模型配置状态
        const store = loadModelStore();
        const isCustomActive = store.activeMode === 'custom';
        const targetModel = isCustomActive ? getActiveCustomModel() : null;

        // 方案一：当前处于官方模型模式 (activeMode === 'official')，或非生成请求，透明透传回 Google 官方
        if (!isGenerateRequest || !isCustomActive || !targetModel || !targetModel.apiKey) {
            console.log(`[NativeProxy] [方案一] 官方模型直通 -> ${req.method} ${pathname}`);
            await forwardToGoogle(req, res, bodyBuffer);
            return;
        }

        // 方案二：当前处于中转模型模式 (activeMode === 'custom')，截获请求并转换为中转站协议以驱动原生工具
        try {
            const geminiBody = JSON.parse(bodyBuffer.toString('utf-8'));
            console.log(`[NativeProxy] [方案二] 中转原生工具代理 -> 转发给 [${targetModel.name || targetModel.modelId}] (${targetModel.protocol})`);
            await handleCustomGenerate(req, res, geminiBody, targetModel);
        } catch (err) {
            console.error('[NativeProxy] Failed to parse request body, falling back to official:', err);
            await forwardToGoogle(req, res, bodyBuffer);
        }
    });
}

/**
 * 启动独立的 Native Proxy 监听服务
 */
export function startNativeProxyServer(port = 19825) {
    const server = http.createServer((req, res) => {
        handleNativeProxyRequest(req, res);
    });

    server.listen(port, '127.0.0.1', () => {
        console.log(`[NativeProxy] Gemini-to-Relay Proxy listening on http://127.0.0.1:${port}`);
    });

    return server;
}
