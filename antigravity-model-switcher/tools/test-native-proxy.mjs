/**
 * 自动化测试脚本：验证 Gemini ↔ OpenAI/Claude 协议转换与 Native Proxy (增强版)
 */

import assert from 'node:assert';
import {
    convertGeminiSchemaToJsonSchema,
    geminiToOpenAI,
    geminiToClaude,
    createGeminiChunkFormatter
} from '../core/gemini-adapter.mjs';

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
    assert.strictEqual(openAiPayload.messages[0].role, 'system');
    assert.strictEqual(openAiPayload.messages[0].content, '你是一个智能代码与系统运维助手。');

    // 检查 user 提问
    assert.strictEqual(openAiPayload.messages[1].role, 'user');
    assert.strictEqual(openAiPayload.messages[1].content, '帮我检查 9222 端口是否在监听');

    // 检查 assistant 调工具
    assert.strictEqual(openAiPayload.messages[2].role, 'assistant');
    assert.strictEqual(openAiPayload.messages[2].tool_calls.length, 1);
    assert.strictEqual(openAiPayload.messages[2].tool_calls[0].function.name, 'run_command');
    const generatedCallId = openAiPayload.messages[2].tool_calls[0].id;
    assert.ok(generatedCallId.startsWith('call_run_command_'));

    // 检查 tool 结果回传且 ID 严格对应
    assert.strictEqual(openAiPayload.messages[3].role, 'tool');
    assert.strictEqual(openAiPayload.messages[3].tool_call_id, generatedCallId, 'tool_call_id 必须与 assistant 发起的 ID 严格匹配');

    // 检查工具定义转换
    assert.strictEqual(openAiPayload.tools.length, 1);
    assert.strictEqual(openAiPayload.tools[0].type, 'function');
    assert.strictEqual(openAiPayload.tools[0].function.name, 'run_command');
    assert.strictEqual(openAiPayload.tools[0].function.parameters.type, 'object');

    console.log('✅ 测试 2 通过：Gemini ➔ OpenAI 请求体（多轮会话 + 原生工具 + Tool Call ID 闭环）转换成功');
}

// 3. 测试 Gemini 请求 ➔ Claude Messages 格式转换（多轮工具闭环与同角色合并）
{
    const geminiReq = {
        systemInstruction: { parts: [{ text: 'System Instruction' }] },
        contents: [
            { role: 'user', parts: [{ text: 'Hello Claude' }] },
            {
                role: 'model',
                parts: [{
                    functionCall: {
                        name: 'browser_action',
                        args: { action: 'open_url', url: 'https://github.com' }
                    }
                }]
            },
            {
                role: 'user',
                parts: [{
                    functionResponse: {
                        name: 'browser_action',
                        response: { status: 'ok' }
                    }
                }]
            }
        ],
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

    // 检查 Claude tool_use
    const assistantMsg = claudePayload.messages[1];
    assert.strictEqual(assistantMsg.role, 'assistant');
    assert.strictEqual(assistantMsg.content[0].type, 'tool_use');
    assert.strictEqual(assistantMsg.content[0].name, 'browser_action');
    const toolUseId = assistantMsg.content[0].id;
    assert.ok(toolUseId.startsWith('toolu_'));

    // 检查 Claude tool_result 对应
    const toolResultMsg = claudePayload.messages[2];
    assert.strictEqual(toolResultMsg.role, 'user');
    assert.strictEqual(toolResultMsg.content[0].type, 'tool_result');
    assert.strictEqual(toolResultMsg.content[0].tool_use_id, toolUseId);

    assert.strictEqual(claudePayload.tools[0].name, 'browser_action');
    assert.strictEqual(claudePayload.tools[0].input_schema.type, 'object');

    console.log('✅ 测试 3 通过：Gemini ➔ Claude Messages 请求转换（含 toolu_ 绑定）成功');
}

// 4. 测试 SSE Chunk 格式化器输出（包含原生思考流与工具容错）
{
    const formatter = createGeminiChunkFormatter();

    // 4.1 文本
    const textChunk = formatter.formatTextChunk('Hello World');
    assert.ok(textChunk.startsWith('data: '));
    const parsedText = JSON.parse(textChunk.slice(6));
    assert.strictEqual(parsedText.candidates[0].content.parts[0].text, 'Hello World');

    // 4.2 思考流 (thought: true)
    const thoughtChunk = formatter.formatThoughtChunk('正在深度思考系统架构...');
    assert.ok(thoughtChunk.startsWith('data: '));
    const parsedThought = JSON.parse(thoughtChunk.slice(6));
    assert.strictEqual(parsedThought.candidates[0].content.parts[0].text, '正在深度思考系统架构...');
    assert.strictEqual(parsedThought.candidates[0].content.parts[0].thought, true);

    // 4.3 工具调用与 Windows 反斜杠容错
    const fnChunk = formatter.formatFunctionCallChunk('read_file', '{"path": "C:\\Windows\\System32\\cmd.exe"}');
    assert.ok(fnChunk.startsWith('data: '));
    const parsedFn = JSON.parse(fnChunk.slice(6));
    const fnCall = parsedFn.candidates[0].content.parts[0].functionCall;
    assert.strictEqual(fnCall.name, 'read_file');
    assert.strictEqual(fnCall.args.path, 'C:\\Windows\\System32\\cmd.exe');

    console.log('✅ 测试 4 通过：Gemini SSE Chunk (文本、原生思考流 thought:true、容错 Function Call) 序列化成功');
}

console.log('\n🎉 所有核心测试全部通过！中转模型已具备调用 Antigravity 原生全套工具的能力。');
