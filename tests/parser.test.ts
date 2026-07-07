import { describe, expect, it } from 'vitest';
import {
  extractPromptsFromJsonl,
  normalizePrompt,
  redactSecrets
} from '../desktop/main/services/parser';

describe('parser', () => {
  it('extracts user and human prompts while ignoring assistant and tool records', () => {
    const jsonl = [
      JSON.stringify({ role: 'user', content: 'review current diff for missing tests' }),
      JSON.stringify({ type: 'human', text: '帮我修复失败测试' }),
      JSON.stringify({ role: 'assistant', content: 'assistant answer' }),
      JSON.stringify({ type: 'tool_result', content: 'tool output' })
    ].join('\n');

    const result = extractPromptsFromJsonl(jsonl, {
      sourceTool: 'codex',
      sourceFile: 'fixture.jsonl'
    });

    expect(result.prompts.map((prompt) => prompt.rawText)).toEqual([
      'review current diff for missing tests',
      '帮我修复失败测试'
    ]);
    expect(result.warningCount).toBe(0);
  });

  it('extracts user prompts from Codex response item payloads', () => {
    const jsonl = [
      JSON.stringify({
        type: 'response_item',
        timestamp: '2026-07-07T00:00:00.000Z',
        payload: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'scan Codex sessions and import useful prompts'
            }
          ]
        }
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'assistant answer' }]
        }
      }),
      JSON.stringify({
        type: 'response_item',
        payload: {
          type: 'function_call_output',
          output: 'tool output'
        }
      })
    ].join('\n');

    const result = extractPromptsFromJsonl(jsonl, {
      sourceTool: 'codex',
      sourceFile: 'codex-session.jsonl'
    });

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toMatchObject({
      rawText: 'scan Codex sessions and import useful prompts',
      timestamp: '2026-07-07T00:00:00.000Z',
      turnIndex: 0
    });
  });

  it('redacts secrets before persistence', () => {
    const redacted = redactSecrets('API_KEY=sk-test123456 TOKEN=ghp_abcdef123456');

    expect(redacted).toContain('[REDACTED_SECRET]');
    expect(redacted).not.toContain('sk-test123456');
    expect(redacted).not.toContain('ghp_abcdef123456');
  });

  it('normalizes paths urls issues commits and code blocks', () => {
    const text = [
      'review src/app/Billing.tsx for https://example.com issue #128',
      'commit abcdef1234567890',
      '```ts',
      'const value = 1;',
      '```'
    ].join('\n');
    const normalized = normalizePrompt(text);

    expect(normalized).toContain('{{file_path}}');
    expect(normalized).toContain('{{url}}');
    expect(normalized).toContain('{{issue_id}}');
    expect(normalized).toContain('{{commit_hash}}');
    expect(normalized).toContain('{{code_block}}');
  });
});
