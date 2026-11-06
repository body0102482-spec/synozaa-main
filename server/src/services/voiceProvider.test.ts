import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { resolveVoiceProvider } from './voiceProvider.js';

const keys = ['VOICE_PROVIDER', 'OPENROUTER_API_KEY', 'OPENAI_API_KEY'] as const;
const originalEnv = new Map<string, string | undefined>();

beforeEach(() => {
  for (const key of keys) originalEnv.set(key, process.env[key]);
  delete process.env.VOICE_PROVIDER;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;
});

afterEach(() => {
  for (const key of keys) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('OpenRouter audio is selected only when explicitly enabled', () => {
  process.env.VOICE_PROVIDER = 'openrouter_audio';
  process.env.OPENROUTER_API_KEY = 'test-key';
  assert.deepEqual(resolveVoiceProvider(), {
    provider: 'openrouter_audio',
    transport: 'openrouter',
  });
});

test('Gemini remains the fallback when OpenRouter audio is not enabled', () => {
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENAI_API_KEY = 'another-test-key';
  assert.deepEqual(resolveVoiceProvider(), {
    provider: 'live_call',
    transport: 'gemini',
  });
});
