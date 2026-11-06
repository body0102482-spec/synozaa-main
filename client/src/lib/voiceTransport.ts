export type VoiceProvider = 'openrouter_audio' | 'live_call';

export interface VoiceProviderResponse {
  provider?: VoiceProvider | string | null;
  transport?: 'openrouter' | 'gemini' | string | null;
}

export function readVoiceProvider(response?: VoiceProviderResponse | null): VoiceProvider | undefined {
  if (!response) return undefined;
  if (response.provider === 'openrouter_audio' || response.provider === 'live_call') {
    return response.provider;
  }
  if (response.transport === 'openrouter') return 'openrouter_audio';
  if (response.transport === 'gemini') return 'live_call';
  return undefined;
}
