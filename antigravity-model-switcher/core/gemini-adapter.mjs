/**
 * Antigravity Native Proxy - Gemini ↔ OpenAI / Claude 双向协议转换引擎
 * ---------------------------------------------------------------------
 * 实现 Google Gemini API (language_server.exe 所用协议) 与第三方中转站 (OpenAI / Claude) 的全双工无缝互转。
 * 包含：
 * 1. Schema 递归转换 (Gemini 大写 Type ↔ JSON Schema 小写 Type)
 * 2. 消息流双向映射 (contents/parts/systemInstruction ↔ messages)
 * 3. 工具调用双向映射 (tools.functionDeclarations ↔ OpenAI/Claude Tools & Function Calling)
 * 4. 流式 SSE 实时互转 (OpenAI / Claude 流式响应 ➔ Gemini SSE 格式)
 */

/**
 * 递归将 Gemini Schema (OBJECT, STRING, INTEGER...) 转换为标准 JSON Schema
 */
export function convertGeminiSchemaToJsonSchema(schema) {
    if (!schema || typeof schema !== 'object') return schema;

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
    }

    if (schema.description) res.description = schema.description;
    if (Array.isArray(schema.required)) res.required = schema.required;
    if (Array.isArray(schema.enum)) res.enum = schema.enum;

    if (schema.properties && typeof schema.properties === 'object') {
        res.properties = {};
        for (const [key, val] of Object.entries(schema.properties)) {
            res.properties[key] = convertGeminiSchemaToJsonSchema(val);
        }
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

            // 检查是否包含 functionCall (模型输出的工具调用)
            const functionCalls = parts.filter(p => p.functionCall);
            // 检查是否包含 functionResponse (用户/系统回传的工具执行结果)
            const functionResponses = parts.filter(p => p.functionResponse);
            // 提取纯文本
            const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');

            if (functionResponses.length > 0) {
                // Gemini 将工具返回放在 role: user 且包含 functionResponse
                for (const fr of functionResponses) {
                    const resp = fr.functionResponse;
                    messages.push({
                        role: 'tool',
                        tool_call_id: resp.name || 'call_default',
                        content: typeof resp.response === 'string'
                            ? resp.response
                            : JSON.stringify(resp.response ?? {})
                    });
                }
            } else if (functionCalls.length > 0) {
                // 模型此前发起的工具调用
                const toolCalls = functionCalls.map((fc, idx) => ({
                    id: fc.functionCall.name || `call_${idx}`,
                    type: 'function',
                    function: {
                        name: fc.functionCall.name,
                        arguments: typeof fc.functionCall.args === 'string'
                            ? fc.functionCall.args
                            : JSON.stringify(fc.functionCall.args ?? {})
                    }
                }));

                messages.push({
                    role: 'assistant',
                    content: textParts || null,
                    tool_calls: toolCalls
                });
            } else {
                // 普通用户或模型消息
                messages.push({
                    role,
                    content: textParts
                });
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
                            parameters: convertGeminiSchemaToJsonSchema(fn.parameters) || { type: 'object', properties: {} }
                        }
                    });
                }
            }
        }
        if (toolsList.length > 0) {
            openAiTools = toolsList;
        }
    }

    // 4. 生成配置参数
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

    const messages = [];
    if (Array.isArray(geminiBody.contents)) {
        for (const content of geminiBody.contents) {
            const role = content.role === 'model' ? 'assistant' : 'user';
            const parts = content.parts || [];

            const functionCalls = parts.filter(p => p.functionCall);
            const functionResponses = parts.filter(p => p.functionResponse);
            const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');

            if (functionResponses.length > 0) {
                const toolResults = functionResponses.map(fr => ({
                    type: 'tool_result',
                    tool_use_id: fr.functionResponse.name || 'tool_call',
                    content: typeof fr.functionResponse.response === 'string'
                        ? fr.functionResponse.response
                        : JSON.stringify(fr.functionResponse.response ?? {})
                }));
                messages.push({ role: 'user', content: toolResults });
            } else if (functionCalls.length > 0) {
                const contents = [];
                if (textParts) contents.push({ type: 'text', text: textParts });
                for (const fc of functionCalls) {
                    contents.push({
                        type: 'tool_use',
                        id: fc.functionCall.name || 'call_0',
                        name: fc.functionCall.name,
                        input: fc.functionCall.args || {}
                    });
                }
                messages.push({ role: 'assistant', content: contents });
            } else {
                messages.push({ role, content: textParts });
            }
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
                        input_schema: convertGeminiSchemaToJsonSchema(fn.parameters) || { type: 'object', properties: {} }
                    });
                }
            }
        }
    }

    const genConfig = geminiBody.generationConfig || {};
    const claudePayload = {
        model: targetModel.modelId || 'claude-3-5-sonnet-20241022',
        messages,
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

        formatFunctionCallChunk(name, args) {
            const data = {
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    functionCall: {
                                        name,
                                        args: typeof args === 'string' ? JSON.parse(args || '{}') : (args || {})
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
