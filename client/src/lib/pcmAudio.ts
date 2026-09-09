/** GPT Audio Mini streaming PCM16 is signed little-endian, 24 kHz, mono. */
export const OPENROUTER_PCM16_SAMPLE_RATE = 24_000;
export const OPENROUTER_PCM16_CHANNELS = 1;
export const OPENROUTER_PCM16_BITS_PER_SAMPLE = 16;

/** Wrap raw PCM16 samples in a canonical RIFF/WAV container for HTMLAudioElement. */
export function wrapPcm16AsWav(
  pcmBytes: Uint8Array,
  sampleRate = OPENROUTER_PCM16_SAMPLE_RATE,
  channels = OPENROUTER_PCM16_CHANNELS,
): Uint8Array {
  const headerSize = 44;
  const bytesPerSample = OPENROUTER_PCM16_BITS_PER_SAMPLE / 8;
  const wav = new Uint8Array(headerSize + pcmBytes.length);
  const view = new DataView(wav.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, OPENROUTER_PCM16_BITS_PER_SAMPLE, true);
  writeAscii(36, 'data');
  view.setUint32(40, pcmBytes.length, true);
  wav.set(pcmBytes, headerSize);
  return wav;
}
