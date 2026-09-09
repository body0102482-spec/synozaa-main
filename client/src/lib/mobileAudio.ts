export const IS_MOBILE =
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function getMicConstraints(): MediaTrackConstraints {
  if (!IS_MOBILE) {
    return {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    };
  }
  // Use browser-supported input processing for recorder/STT calls as well.
  // Browsers may ignore unavailable constraints, so this remains safe on
  // Chrome/macOS and mobile devices.
  return {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  };
}

export function minRecordMs(): number {
  return IS_MOBILE ? 450 : 700;
}

export function minBlobBytes(): number {
  return IS_MOBILE ? 280 : 500;
}

export function minLiveCallBlobBytes(): number {
  return IS_MOBILE ? 350 : 900;
}

export function recorderTimesliceMs(): number {
  return IS_MOBILE ? 250 : 150;
}

/** Max mic-button recording length (browser STT + MediaRecorder). */
export function maxRecordDurationMs(): number {
  return 60_000;
}

let audioUnlocked = false;

/** Unlock iOS/Safari audio output on user gesture. */
export async function unlockMobileAudio(): Promise<void> {
  if (!IS_MOBILE || audioUnlocked) return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') await ctx.resume();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      await new Promise((resolve) => setTimeout(resolve, 20));
      await ctx.close();
    }
    const silent = new Audio();
    silent.setAttribute('playsinline', 'true');
    silent.setAttribute('webkit-playsinline', 'true');
    silent.volume = 0.01;
    silent.src =
      'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAAGkAAAAAAAAA0gAAAAATEFN//tQxAAAAAAADSAAAAAExBTUU';
    await silent.play().catch(() => undefined);
  } catch {
    // ignore
  }
  audioUnlocked = true;
}

export function prepareAudioElement(audio: HTMLAudioElement): void {
  audio.setAttribute('playsinline', 'true');
  audio.setAttribute('webkit-playsinline', 'true');
  audio.preload = 'auto';
  audio.volume = 1;
}
