/**
 * 自动化测试脚本：验证 Gemini ↔ OpenAI/Claude 协议转换与 Native Proxy
 */

import assert from 'node:assert';
import { convertGeminiSchemaToJsonSchema, geminiToOpenAI, geminiToClaude, createGeminiChunkFormatter } from '../core/gemini-adapter.mjs';

console.log('🧪 开始运行 Native Proxy & Gemini Adapter 单元测试...\n');

// 1. 测试 Schema 类型转换 (Gemini 大写 -> JSON Schema 小写)
{
    const geminiSchema = {
        type: 'OBJECT',
        description: '执行系统命令的参数',
        properties: {
            CommandLine: {
                type: 'STRING',
                description: 'PowerShell 命令字符串'
            },
            WaitMs: {
                type: 'INTEGER',
                description: '等待毫秒数'
            },
            Tags: {
                type: 'ARRAY',
                items: { type: 'STRING' }
            }
        },
        required: ['CommandLine']
    };

    const jsonSchema = convertGeminiSchemaToJsonSchema(geminiSchema);
    assert.strictEqual(jsonSchema.type, 'object');
    assert.strictEqual(jsonSchema.properties.CommandLine.type, 'string');
    assert.strictEqual(jsonSchema.properties.WaitMs.type, 'integer');
    assert.strictEqual(jsonSchema.properties.Tags.type, 'array');
    assert.strictEqual(jsonSchema.properties.Tags.items.type, 'string');
    assert.deepStrictEqual(jsonSchema.required, ['CommandLine']);
    console.log('✅ 测试 1 通过：Gemini Schema 递归转换为 JSON Schema 成功');
}

// 2. 测试 Gemini 请求 ➔ OpenAI 格式转换（带工具声明与上下文）
{
    const geminiReq = {
        systemInstruction: {
            parts: [{ text: '你是一个智能代码与系统运维助手。' }]
        },
        contents: [
            {
                role: 'user',
                parts: [{ text: '帮我检查 9222 端口是否在监听' }]
            },
            {
                role: 'model',
                parts: [
                    { text: '我正在运行 PowerShell 命令进行检查...' },
                    {
                        functionCall: {
                            name: 'run_command',
                            args: { CommandLine: 'Get-NetTCPConnection -LocalPort 9222' }
                        }
                    }
                ]
            },
            {
                role: 'user',
                parts: [
                    {
                        functionResponse: {
                            name: 'run_command',
                            response: { output: '127.0.0.1:9222 Listen' }
                        }
                    }
                ]
            }
        ],
        tools: [
            {
                functionDeclarations: [
                    {
                        name: 'run_command',
                        description: '运行本地终端命令',
                        parameters: {
                            type: 'OBJECT',
                            properties: {
                                CommandLine: { type: 'STRING' }
                            },
                            required: ['CommandLine']
                        }
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2048
        }
    };

    const targetModel = { modelId: 'gpt-4o', maxTokens: 4096 };
    const openAiPayload = geminiToOpenAI(geminiReq, targetModel);

    assert.strictEqual(openAiPayload.model, 'gpt-4o');
    assert.strictEqual(openAiPayload.temperature, 0.5);
    assert.strictEqual(openAiPayload.max_tokens, 2048);
    assert.strictEqual(openAiPayload.stream, true);

    // 检查 system 消息
    assert.strictEqual(openAiPayload.messages[0].role, 'system');
    assert.strictEqual(openAiPayload.messages[0].content, '你是一个智能代码与系统运维助手。');

    // 检查 user 提问
    assert.strictEqual(openAiPayload.messages[1].role, 'user');
    assert.strictEqual(openAiPayload.messages[1].content, '帮我检查 9222 端口是否在监听');

    // 检查 assistant 调工具
    assert.strictEqual(openAiPayload.messages[2].role, 'assistant');
    assert.strictEqual(openAiPayload.messages[2].tool_calls.length, 1);
    assert.strictEqual(openAiPayload.messages[2].tool_calls[0].function.name, 'run_command');

    // 检查 tool 结果回传
    assert.strictEqual(openAiPayload.messages[3].role, 'tool');
    assert.strictEqual(openAiPayload.messages[3].tool_call_id, 'run_command');

    // 检查工具定义转换
    assert.strictEqual(openAiPayload.tools.length, 1);
    assert.strictEqual(openAiPayload.tools[0].type, 'function');
    assert.strictEqual(openAiPayload.tools[0].function.name, 'run_command');
    assert.strictEqual(openAiPayload.tools[0].function.parameters.type, 'object');

    console.log('✅ 测试 2 通过：Gemini ➔ OpenAI 请求体（多轮会话 + 原生工具）转换成功');
}

// 3. 测试 Gemini 请求 ➔ Claude Messages 格式转换
{
    const geminiReq = {
        systemInstruction: { parts: [{ text: 'System Instruction' }] },
        contents: [{ role: 'user', parts: [{ text: 'Hello Claude' }] }],
        tools: [{
            functionDeclarations: [{
                name: 'browser_action',
                description: 'Control browser',
                parameters: { type: 'OBJECT', properties: { action: { type: 'STRING' } } }
            }]
        }]
    };

    const targetModel = { modelId: 'claude-3-5-sonnet-20241022' };
    const claudePayload = geminiToClaude(geminiReq, targetModel);

    assert.strictEqual(claudePayload.model, 'claude-3-5-sonnet-20241022');
    assert.strictEqual(claudePayload.system, 'System Instruction');
    assert.strictEqual(claudePayload.messages[0].role, 'user');
    assert.strictEqual(claudePayload.tools[0].name, 'browser_action');
    assert.strictEqual(claudePayload.tools[0].input_schema.type, 'object');

    console.log('✅ 测试 3 通过：Gemini ➔ Claude Messages 请求转换成功');
}

// 4. 测试 SSE Chunk 格式化器输出
{
    const formatter = createGeminiChunkFormatter();
    const textChunk = formatter.formatTextChunk('你好世界');
    assert.ok(textChunk.startsWith('data: '));
    const parsedText = JSON.parse(textChunk.slice(6));
    assert.strictEqual(parsedText.candidates[0].content.parts[0].text, '你好世界');

    const fnChunk = formatter.formatFunctionCallChunk('run_command', { CommandLine: 'node -v' });
    const parsedFn = JSON.parse(fnChunk.slice(6));
    assert.strictEqual(parsedFn.candidates[0].content.parts[0].functionCall.name, 'run_command');
    assert.strictEqual(parsedFn.candidates[0].content.parts[0].functionCall.args.CommandLine, 'node -v');

    console.log('✅ 测试 4 通过：Gemini SSE Chunk (文本与 Function Call) 序列化成功');
}

console.log('\n🎉 所有核心测试全部通过！协议转换与 Native Proxy 核心逻辑验证无误。');
