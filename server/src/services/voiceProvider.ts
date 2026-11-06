import { isOpenRouterAudioEnabled } from './openRouterAudioService.js';

export type VoiceProvider = 'openrouter_audio' | 'live_call';
export type VoiceTransport = 'openrouter' | 'gemini';

export interface VoiceProviderInfo {
  provider: VoiceProvider;
  transport: VoiceTransport;
}

/** Patient History can use turn-based OpenRouter audio; Gemini remains fallback and examiner transport. */
export function resolveVoiceProvider(): VoiceProviderInfo {
  return isOpenRouterAudioEnabled()
    ? { provider: 'openrouter_audio', transport: 'openrouter' }
    : { provider: 'live_call', transport: 'gemini' };
}
