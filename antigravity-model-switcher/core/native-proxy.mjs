/**
 * Antigravity Native Proxy Server (Gemini ➔ OpenAI/Claude 反向代理服务)
 * ------------------------------------------------------------------
 * 拦截 language_server.exe 的请求：
 * - 当为官方模型时：透明透传至 https://generativelanguage.googleapis.com
 * - 当为中转模型时：无缝转换为 OpenAI/Claude 协议调用中转站，并将 Tool Calls 封装为原生 Gemini 格式
 */

import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { loadModelStore, getActiveCustomModel } from './model-store.mjs';
import { geminiToOpenAI, geminiToClaude, createGeminiChunkFormatter } from './gemini-adapter.mjs';

const GOOGLE_API_HOST = 'generativelanguage.googleapis.com';

/**
 * 将请求原样透传至 Google 官方服务器
 */
function forwardToGoogle(req, res, bodyBuffer) {
    const options = {
        hostname: GOOGLE_API_HOST,
        port: 443,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            host: GOOGLE_API_HOST
        }
    };

    // 移除潜在冲突头
    delete options.headers['content-length'];
    if (bodyBuffer && bodyBuffer.length > 0) {
        options.headers['content-length'] = bodyBuffer.length;
    }

    const proxyReq = https.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
        console.error('[NativeProxy] Forward to Google failed:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { code: 502, message: `Proxy to Google error: ${err.message}` } }));
    });

    if (bodyBuffer && bodyBuffer.length > 0) {
        proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
}

/**
 * 处理中转模型生成请求
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

                // 1. 处理思考内容 (Reasoning)
                const reasoning = choice.delta?.reasoning_content || choice.delta?.reasoning;
                if (reasoning) {
                    res.write(formatter.formatTextChunk(reasoning));
                }

                // 2. 处理正文内容
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
    let currentToolName = '';
    let currentToolInput = '';

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

                if (type === 'content_block_start' && eventData.content_block?.type === 'tool_use') {
                    currentToolName = eventData.content_block.name;
                    currentToolInput = '';
                } else if (type === 'content_block_delta') {
                    if (eventData.delta?.type === 'text_delta') {
                        res.write(formatter.formatTextChunk(eventData.delta.text));
                    } else if (eventData.delta?.type === 'input_json_delta') {
                        currentToolInput += eventData.delta.partial_json;
                    }
                } else if (type === 'content_block_stop') {
                    if (currentToolName) {
                        res.write(formatter.formatFunctionCallChunk(currentToolName, currentToolInput));
                        currentToolName = '';
                        currentToolInput = '';
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
 * 核心请求分发器
 */
export async function handleNativeProxyRequest(req, res) {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
        const bodyBuffer = Buffer.concat(chunks);
        const urlObj = new URL(req.url, 'http://127.0.0.1');
        const pathname = urlObj.pathname;

        // 判断是否为生成请求
        const isGenerateRequest = pathname.includes(':streamGenerateContent') || pathname.includes(':generateContent');

        // 读取当前模型配置
        const store = loadModelStore();
        const isCustomActive = store.activeMode === 'custom';
        const targetModel = isCustomActive ? getActiveCustomModel() : null;

        // 若不是模型生成请求，或当前处于官方模型模式，或中转模型配置未就绪，直接透传回 Google 官方
        if (!isGenerateRequest || !isCustomActive || !targetModel || !targetModel.apiKey) {
            forwardToGoogle(req, res, bodyBuffer);
            return;
        }

        // 解析 Gemini 请求体
        try {
            const geminiBody = JSON.parse(bodyBuffer.toString('utf-8'));
            console.log(`[NativeProxy] Intercepted Gemini request -> Forwarding to custom model [${targetModel.name || targetModel.modelId}] (${targetModel.protocol})`);
            await handleCustomGenerate(req, res, geminiBody, targetModel);
        } catch (err) {
            console.error('[NativeProxy] Failed to parse request body:', err);
            forwardToGoogle(req, res, bodyBuffer);
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
