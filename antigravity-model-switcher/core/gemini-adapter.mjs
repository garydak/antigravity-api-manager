/**
 * Antigravity Native Proxy - Gemini ↔ OpenAI / Claude 双向协议转换引擎 (增强版)
 * ---------------------------------------------------------------------
 * 实现 Google Gemini API (language_server.exe 所用协议) 与第三方中转站 (OpenAI / Claude) 的全双工无缝互转。
 * 核心特性：
 * 1. Schema 递归深度转换 (Gemini 大写 Type ↔ JSON Schema 小写 Type)
 * 2. 上下文与多模态双向映射 (contents/parts/inlineData ↔ messages/images)
 * 3. 严格的 Tool Call ID 双向绑定与队列匹配 (杜绝第三方中转站 400 Invalid tool_call_id)
 * 4. Claude 消息规范自动合并 (相邻同角色消息合拢，避免 Consecutive roles 错误)
 * 5. 思考链 (Reasoning/Thinking) 与原生 Gemini thought: true 流式渲染
 * 6. 参数 JSON 语法自动容错与自愈 (智能修复 Windows 反斜杠路径与换行转义)
 */

/**
 * 修复模型在 JSON 字符串中误写的 Windows 单反斜杠路径或未转义换行符
 */
export function repairJsonString(rawStr = '') {
    let out = '';
    let inString = false;
    for (let i = 0; i < rawStr.length; i++) {
        const ch = rawStr[i];
        if (!inString) {
            if (ch === '"') inString = true;
            out += ch;
            continue;
        }
        if (ch === '"') {
            inString = false;
            out += ch;
            continue;
        }
        if (ch === '\\') {
            const next = rawStr[i + 1];
            if (next === '"' || next === '\\' || next === '/') {
                out += ch + next;
                i++;
                continue;
            }
            if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(rawStr.slice(i + 2, i + 6))) {
                out += rawStr.slice(i, i + 6);
                i += 5;
                continue;
            }
            if (next === 'n' || next === 'r' || next === 't' || next === 'b' || next === 'f') {
                out += ch + next;
                i++;
                continue;
            }
            out += '\\\\';
            continue;
        }
        if (ch === '\n') {
            out += '\\n';
            continue;
        }
        if (ch === '\r') {
            out += '\\r';
            continue;
        }
        if (ch === '\t') {
            out += '\\t';
            continue;
        }
        out += ch;
    }
    return out;
}

/**
 * 安全解析 JSON，带容错修复
 */
export function safeParseJson(input) {
    if (!input) return {};
    if (typeof input === 'object') return input;
    const str = String(input).trim();
    if (!str) return {};

    try {
        return JSON.parse(str);
    } catch {
        try {
            return JSON.parse(repairJsonString(str));
        } catch {
            return { _raw: str };
        }
    }
}

/**
 * 递归将 Gemini Schema (OBJECT, STRING, INTEGER...) 转换为标准 JSON Schema
 */
export function convertGeminiSchemaToJsonSchema(schema) {
    if (!schema || typeof schema !== 'object') return { type: 'object', properties: {} };

    const res = {};
    if (schema.type) {
        const t = String(schema.type).toUpperCase();
        switch (t) {
            case 'OBJECT': res.type = 'object'; break;
            case 'STRING': res.type = 'string'; break;
            case 'INTEGER': res.type = 'integer'; break;
            case 'NUMBER': res.type = 'number'; break;
            case 'BOOLEAN': res.type = 'boolean'; break;
            case 'ARRAY': res.type = 'array'; break;
            default: res.type = schema.type.toLowerCase(); break;
        }
    } else {
        // 缺省 type 时根据 properties 判定
        if (schema.properties) {
            res.type = 'object';
        }
    }

    if (schema.description) res.description = schema.description;
    if (Array.isArray(schema.required) && schema.required.length > 0) res.required = schema.required;
    if (Array.isArray(schema.enum)) res.enum = schema.enum;

    if (schema.properties && typeof schema.properties === 'object') {
        res.properties = {};
        for (const [key, val] of Object.entries(schema.properties)) {
            res.properties[key] = convertGeminiSchemaToJsonSchema(val);
        }
    } else if (res.type === 'object' && !res.properties) {
        res.properties = {};
    }

    if (schema.items) {
        res.items = convertGeminiSchemaToJsonSchema(schema.items);
    }

    return res;
}

/**
 * 将 Gemini API 请求体转换为 OpenAI Chat Completions 请求体
 */
export function geminiToOpenAI(geminiBody, targetModel = {}) {
    const messages = [];
    // 维护每个工具名称对应的 callId 队列，保证 tool_call_id 前后严格一一对应
    const toolCallQueues = new Map();

    // 1. 处理系统提示词 (systemInstruction)
    if (geminiBody.systemInstruction?.parts) {
        const sysText = geminiBody.systemInstruction.parts
            .filter(p => p.text)
            .map(p => p.text)
            .join('\n');
        if (sysText) {
            messages.push({ role: 'system', content: sysText });
        }
    }

    // 2. 处理上下文历史 (contents)
    if (Array.isArray(geminiBody.contents)) {
        for (const content of geminiBody.contents) {
            const role = content.role === 'model' ? 'assistant' : 'user';
            const parts = content.parts || [];

            const functionCalls = parts.filter(p => p.functionCall);
            const functionResponses = parts.filter(p => p.functionResponse);
            const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');
            const inlineDataParts = parts.filter(p => p.inlineData || p.inline_data).map(p => p.inlineData || p.inline_data);

            if (functionResponses.length > 0) {
                // Gemini 工具返回封装在 role: user 的 functionResponse 中
                for (const fr of functionResponses) {
                    const resp = fr.functionResponse;
                    const fnName = resp.name || 'tool_call';
                    const queue = toolCallQueues.get(fnName) || [];
                    const matchedCallId = queue.shift() || `call_${fnName}_${Date.now().toString(36)}`;
                    toolCallQueues.set(fnName, queue);

                    messages.push({
                        role: 'tool',
                        tool_call_id: matchedCallId,
                        content: typeof resp.response === 'string'
                            ? resp.response
                            : JSON.stringify(resp.response ?? {})
                    });
                }
            } else if (functionCalls.length > 0) {
                // 历史中模型发起的工具调用
                const toolCalls = functionCalls.map((fc, idx) => {
                    const fnName = fc.functionCall.name || 'tool_call';
                    const callId = `call_${fnName}_${Date.now().toString(36)}_${idx}`;
                    const queue = toolCallQueues.get(fnName) || [];
                    queue.push(callId);
                    toolCallQueues.set(fnName, queue);

                    return {
                        id: callId,
                        type: 'function',
                        function: {
                            name: fnName,
                            arguments: typeof fc.functionCall.args === 'string'
                                ? fc.functionCall.args
                                : JSON.stringify(fc.functionCall.args ?? {})
                        }
                    };
                });

                messages.push({
                    role: 'assistant',
                    content: textParts || null,
                    tool_calls: toolCalls
                });
            } else {
                // 普通用户或模型消息（支持文字 + 图片多模态）
                if (inlineDataParts.length > 0 && role === 'user') {
                    const multiParts = [];
                    if (textParts) {
                        multiParts.push({ type: 'text', text: textParts });
                    }
                    for (const img of inlineDataParts) {
                        const mime = img.mimeType || img.mime_type || 'image/png';
                        const data = img.data || '';
                        multiParts.push({
                            type: 'image_url',
                            image_url: {
                                url: `data:${mime};base64,${data}`
                            }
                        });
                    }
                    messages.push({ role, content: multiParts });
                } else {
                    messages.push({ role, content: textParts });
                }
            }
        }
    }

    // 3. 处理工具声明 (tools.functionDeclarations)
    let openAiTools = undefined;
    if (Array.isArray(geminiBody.tools)) {
        const toolsList = [];
        for (const toolGroup of geminiBody.tools) {
            if (Array.isArray(toolGroup.functionDeclarations)) {
                for (const fn of toolGroup.functionDeclarations) {
                    toolsList.push({
                        type: 'function',
                        function: {
                            name: fn.name,
                            description: fn.description || '',
                            parameters: convertGeminiSchemaToJsonSchema(fn.parameters)
                        }
                    });
                }
            }
        }
        if (toolsList.length > 0) {
            openAiTools = toolsList;
        }
    }

    // 4. 生成参数配置
    const genConfig = geminiBody.generationConfig || {};
    const openAiPayload = {
        model: targetModel.modelId || 'gpt-4o',
        messages,
        temperature: genConfig.temperature ?? 0.7,
        max_tokens: genConfig.maxOutputTokens || targetModel.maxTokens || 4096,
        stream: true
    };

    if (openAiTools) {
        openAiPayload.tools = openAiTools;
    }

    if (genConfig.topP !== undefined) openAiPayload.top_p = genConfig.topP;
    if (Array.isArray(genConfig.stopSequences) && genConfig.stopSequences.length > 0) {
        openAiPayload.stop = genConfig.stopSequences;
    }

    return openAiPayload;
}

/**
 * 将 Gemini API 请求体转换为 Anthropic Claude Messages 请求体
 */
export function geminiToClaude(geminiBody, targetModel = {}) {
    let systemPrompt = '';
    if (geminiBody.systemInstruction?.parts) {
        systemPrompt = geminiBody.systemInstruction.parts
            .filter(p => p.text)
            .map(p => p.text)
            .join('\n');
    }

    const rawMessages = [];
    const toolCallQueues = new Map();

    if (Array.isArray(geminiBody.contents)) {
        for (const content of geminiBody.contents) {
            const role = content.role === 'model' ? 'assistant' : 'user';
            const parts = content.parts || [];

            const functionCalls = parts.filter(p => p.functionCall);
            const functionResponses = parts.filter(p => p.functionResponse);
            const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');
            const inlineDataParts = parts.filter(p => p.inlineData || p.inline_data).map(p => p.inlineData || p.inline_data);

            if (functionResponses.length > 0) {
                const toolResults = functionResponses.map(fr => {
                    const fnName = fr.functionResponse.name || 'tool_call';
                    const queue = toolCallQueues.get(fnName) || [];
                    const matchedCallId = queue.shift() || `toolu_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
                    toolCallQueues.set(fnName, queue);

                    return {
                        type: 'tool_result',
                        tool_use_id: matchedCallId,
                        content: typeof fr.functionResponse.response === 'string'
                            ? fr.functionResponse.response
                            : JSON.stringify(fr.functionResponse.response ?? {})
                    };
                });
                rawMessages.push({ role: 'user', content: toolResults });
            } else if (functionCalls.length > 0) {
                const contents = [];
                if (textParts) contents.push({ type: 'text', text: textParts });
                for (let idx = 0; idx < functionCalls.length; idx++) {
                    const fc = functionCalls[idx];
                    const fnName = fc.functionCall.name || 'tool_call';
                    const toolUseId = `toolu_${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
                    const queue = toolCallQueues.get(fnName) || [];
                    queue.push(toolUseId);
                    toolCallQueues.set(fnName, queue);

                    contents.push({
                        type: 'tool_use',
                        id: toolUseId,
                        name: fnName,
                        input: safeParseJson(fc.functionCall.args)
                    });
                }
                rawMessages.push({ role: 'assistant', content: contents });
            } else {
                const contents = [];
                if (textParts) contents.push({ type: 'text', text: textParts });
                for (const img of inlineDataParts) {
                    const mime = img.mimeType || img.mime_type || 'image/png';
                    const data = img.data || '';
                    contents.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mime,
                            data
                        }
                    });
                }
                if (contents.length === 1 && contents[0].type === 'text') {
                    rawMessages.push({ role, content: contents[0].text });
                } else if (contents.length > 0) {
                    rawMessages.push({ role, content: contents });
                } else {
                    rawMessages.push({ role, content: '' });
                }
            }
        }
    }

    // Claude 严格要求消息的角色交替 (user -> assistant -> user)。将连续的同角色消息安全合并
    const mergedMessages = [];
    for (const msg of rawMessages) {
        if (mergedMessages.length === 0) {
            mergedMessages.push(msg);
            continue;
        }
        const prev = mergedMessages[mergedMessages.length - 1];
        if (prev.role === msg.role) {
            // 合并 content
            const prevContent = Array.isArray(prev.content)
                ? prev.content
                : [{ type: 'text', text: String(prev.content || '') }];
            const curContent = Array.isArray(msg.content)
                ? msg.content
                : [{ type: 'text', text: String(msg.content || '') }];
            prev.content = [...prevContent, ...curContent];
        } else {
            mergedMessages.push(msg);
        }
    }

    const claudeTools = [];
    if (Array.isArray(geminiBody.tools)) {
        for (const toolGroup of geminiBody.tools) {
            if (Array.isArray(toolGroup.functionDeclarations)) {
                for (const fn of toolGroup.functionDeclarations) {
                    claudeTools.push({
                        name: fn.name,
                        description: fn.description || '',
                        input_schema: convertGeminiSchemaToJsonSchema(fn.parameters)
                    });
                }
            }
        }
    }

    const genConfig = geminiBody.generationConfig || {};
    const claudePayload = {
        model: targetModel.modelId || 'claude-3-5-sonnet-20241022',
        messages: mergedMessages,
        max_tokens: genConfig.maxOutputTokens || targetModel.maxTokens || 4096,
        temperature: genConfig.temperature ?? 0.7,
        stream: true
    };

    if (systemPrompt) claudePayload.system = systemPrompt;
    if (claudeTools.length > 0) claudePayload.tools = claudeTools;

    return claudePayload;
}

/**
 * 创建生成标准 Gemini SSE Chunk 的辅助器
 */
export function createGeminiChunkFormatter() {
    return {
        // 输出思考过程（Antigravity 会将其优雅地收纳在折叠卡片中）
        formatThoughtChunk(text) {
            const data = {
                candidates: [
                    {
                        content: {
                            parts: [{ text, thought: true }],
                            role: 'model'
                        },
                        finishReason: null,
                        index: 0
                    }
                ]
            };
            return `data: ${JSON.stringify(data)}\n\n`;
        },

        // 输出普通文本
        formatTextChunk(text) {
            const data = {
                candidates: [
                    {
                        content: {
                            parts: [{ text }],
                            role: 'model'
                        },
                        finishReason: null,
                        index: 0
                    }
                ]
            };
            return `data: ${JSON.stringify(data)}\n\n`;
        },

        // 输出工具调用
        formatFunctionCallChunk(name, args) {
            const data = {
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    functionCall: {
                                        name,
                                        args: safeParseJson(args)
                                    }
                                }
                            ],
                            role: 'model'
                        },
                        finishReason: 'STOP',
                        index: 0
                    }
                ]
            };
            return `data: ${JSON.stringify(data)}\n\n`;
        },

        // 输出完成与 Token 统计
        formatFinishChunk(reason = 'STOP', usage = null) {
            const data = {
                candidates: [
                    {
                        content: { parts: [], role: 'model' },
                        finishReason: reason,
                        index: 0
                    }
                ]
            };
            if (usage) {
                data.usageMetadata = {
                    promptTokenCount: usage.prompt_tokens || 0,
                    candidatesTokenCount: usage.completion_tokens || 0,
                    totalTokenCount: usage.total_tokens || 0
                };
            }
            return `data: ${JSON.stringify(data)}\n\n`;
        }
    };
}
