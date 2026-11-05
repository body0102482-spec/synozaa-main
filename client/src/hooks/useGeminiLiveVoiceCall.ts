import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api';

interface LiveVoiceMessage {
  id: string;
  role: 'STUDENT' | 'PATIENT' | 'EXAMINER';
  content: string;
  stage: string;
  createdAt: string;
}

export type GeminiLiveVoiceRole = 'PATIENT' | 'EXAMINER';
export type GeminiLiveConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

interface GeminiLiveSetupConfig {
  responseModalities: ['AUDIO'];
  systemInstruction: { parts: Array<{ text: string }> };
  inputAudioTranscription: Record<string, never>;
  outputAudioTranscription: Record<string, never>;
  speechConfig?: {
    voiceConfig: { precomputedVoiceConfig: { voiceName: string } };
  };
}

interface GeminiLiveTokenResponse {
  token: string;
  model: string;
  config: GeminiLiveSetupConfig;
}

interface UseGeminiLiveVoiceCallOptions {
  sessionId: string;
  /**
   * Which AI persona this call connects to. The server mints a token whose
   * system instruction is built for this role — patient and examiner
   * instructions are never mixed on a single connection.
   */
  role?: GeminiLiveVoiceRole;
  /** Stage the transcript turns are persisted under (e.g. history / history:examiner / examination:palpation). */
  stage?: string;
  /** Explicit maneuver id when stage is `examination:<maneuverId>`. */
  maneuverId?: string;
  disabled?: boolean;
  onMessage?: (message: LiveVoiceMessage) => void;
  onError?: (code: string) => void;
}


const GEMINI_LIVE_WS =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
const INPUT_SAMPLE_RATE = 16_000;
const OUTPUT_SAMPLE_RATE = 24_000;
const INPUT_BLOCK_SIZE = 4096;

function floatToPcmBase64(samples: Float32Array, sampleRate: number): string {
  const outputLength = Math.floor((samples.length * INPUT_SAMPLE_RATE) / sampleRate);
  const pcm = new Int16Array(outputLength);
  for (let i = 0; i < outputLength; i += 1) {
    const position = (i * sampleRate) / INPUT_SAMPLE_RATE;
    const left = Math.floor(position);
    const fraction = position - left;
    const first = samples[left] ?? 0;
    const second = samples[Math.min(left + 1, samples.length - 1)] ?? first;
    const value = Math.max(-1, Math.min(1, first + (second - first) * fraction));
    pcm[i] = value < 0 ? value * 0x8000 : value * 0x7fff;
  }

  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

function decodePcmBase64(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer);
}

export function useGeminiLiveVoiceCall({
  sessionId,
  role = 'PATIENT',
  stage = 'history',
  maneuverId,
  disabled = false,
  onMessage,
  onError,
}: UseGeminiLiveVoiceCallOptions) {
  const [isLiveCall, setIsLiveCall] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMicListening, setIsMicListening] = useState(false);
  const [connectionState, setConnectionState] = useState<GeminiLiveConnectionState>('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [aiCaption, setAiCaption] = useState('');
  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const playbackNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextPlaybackTimeRef = useRef(0);
  const speakingRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const inputSpeechFramesRef = useRef(0);
  const inputQuietFramesRef = useRef(0);
  const pendingStudentTextRef = useRef('');
  const pendingAiTextRef = useRef('');
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  const disabledRef = useRef(disabled);
  const roleRef = useRef(role);
  const stageRef = useRef(stage);
  const maneuverIdRef = useRef(maneuverId);
  const mutedRef = useRef(false);
  const lastMicLevelUpdateRef = useRef(0);
  const activeContextRef = useRef<string | null>(null);


  onMessageRef.current = onMessage;
  onErrorRef.current = onError;
  disabledRef.current = disabled;
  roleRef.current = role;
  stageRef.current = stage;
  maneuverIdRef.current = maneuverId;

  const stopPlayback = useCallback(() => {
    for (const node of playbackNodesRef.current) {
      try {
        node.stop();
      } catch {
        // A node may already have ended.
      }
    }
    playbackNodesRef.current.clear();
    const context = audioContextRef.current;
    nextPlaybackTimeRef.current = context?.currentTime ?? 0;
    speakingRef.current = false;
    setIsSpeaking(false);
  }, []);

  const releaseAudio = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    muteGainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    muteGainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
  }, []);

  const stopCall = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    activeContextRef.current = null;
    if (socket && socket.readyState < WebSocket.CLOSING) socket.close();
    stopPlayback();
    releaseAudio();
    pendingStudentTextRef.current = '';
    pendingAiTextRef.current = '';
    userSpeakingRef.current = false;
    inputSpeechFramesRef.current = 0;
    inputQuietFramesRef.current = 0;
    mutedRef.current = false;
    lastMicLevelUpdateRef.current = 0;
    setIsMuted(false);
    setMicLevel(0);
    setAiCaption('');
    setConnectionState('idle');
    setIsLiveCall(false);
    setIsBusy(false);
    setIsMicListening(false);
  }, [releaseAudio, stopPlayback]);

  const persistMessage = useCallback(
    async (messageRole: 'STUDENT' | 'PATIENT' | 'EXAMINER', content: string) => {
      const text = content.trim();
      if (!text) return;
      const response = await api.post<{ message: LiveVoiceMessage }>(
        `/sessions/${sessionId}/live-voice/message`,
        { role: messageRole, content: text, stage: stageRef.current },
      );
      onMessageRef.current?.(response.data.message);
    },
    [sessionId],
  );

  const playAudioChunk = useCallback((base64: string) => {
    const context = audioContextRef.current;
    if (!context || context.state === 'closed' || userSpeakingRef.current) return;
    const pcm = decodePcmBase64(base64);
    if (!pcm.length) return;

    const audio = context.createBuffer(1, pcm.length, OUTPUT_SAMPLE_RATE);
    const channel = audio.getChannelData(0);
    for (let i = 0; i < pcm.length; i += 1) {
      channel[i] = pcm[i] < 0 ? pcm[i] / 0x8000 : pcm[i] / 0x7fff;
    }

    const node = context.createBufferSource();
    node.buffer = audio;
    node.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.015, nextPlaybackTimeRef.current);
    nextPlaybackTimeRef.current = startAt + audio.duration;
    playbackNodesRef.current.add(node);
    speakingRef.current = true;
    setIsSpeaking(true);
    node.onended = () => {
      playbackNodesRef.current.delete(node);
      if (playbackNodesRef.current.size === 0) {
        speakingRef.current = false;
        setIsSpeaking(false);
      }
    };
    node.start(startAt);
  }, []);

  const handleServerMessage = useCallback(
    async (message: Record<string, unknown>) => {
      const serverContent = message.serverContent as Record<string, unknown> | undefined;
      if (!serverContent) return;

      if (serverContent.interrupted === true) stopPlayback();

      const inputTranscription = serverContent.inputTranscription as { text?: unknown } | undefined;
      if (typeof inputTranscription?.text === 'string') {
        pendingStudentTextRef.current += inputTranscription.text;
        setIsBusy(true);
      }

      const outputTranscription = serverContent.outputTranscription as { text?: unknown } | undefined;
      if (typeof outputTranscription?.text === 'string') {
        pendingAiTextRef.current += outputTranscription.text;
        // Live caption of what the AI is currently saying.
        setAiCaption(pendingAiTextRef.current);
      }

      const modelTurn = serverContent.modelTurn as { parts?: Array<Record<string, unknown>> } | undefined;
      for (const part of modelTurn?.parts ?? []) {
        const inlineData = part.inlineData as { data?: unknown } | undefined;
        if (typeof inlineData?.data === 'string') playAudioChunk(inlineData.data);
      }

      if (serverContent.turnComplete === true) {
        setIsBusy(false);
        const studentText = pendingStudentTextRef.current;
        const aiText = pendingAiTextRef.current;
        pendingStudentTextRef.current = '';
        pendingAiTextRef.current = '';
        const aiRole = roleRef.current;
        const queuedPersistence = persistenceQueueRef.current
          .catch(() => undefined)
          .then(async () => {
            if (studentText.trim()) await persistMessage('STUDENT', studentText);
            if (aiText.trim()) await persistMessage(aiRole, aiText);
          });

        persistenceQueueRef.current = queuedPersistence;
        try {
          await queuedPersistence;
        } catch {
          onErrorRef.current?.('transcript-save-failed');
        }
      }
    },
    [persistMessage, playAudioChunk, stopPlayback],
  );

  const startAudioCapture = useCallback((socket: WebSocket, context: AudioContext, stream: MediaStream) => {
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(INPUT_BLOCK_SIZE, 1, 1);
    const muteGain = context.createGain();
    muteGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const rawSamples = event.inputBuffer.getChannelData(0);
      const muted = mutedRef.current;
      // When muted, send true silence so nothing is captured or transcribed.
      const samples = muted ? new Float32Array(rawSamples.length) : rawSamples;

      let squareSum = 0;
      for (let i = 0; i < samples.length; i += 1) squareSum += samples[i] * samples[i];
      const rms = Math.sqrt(squareSum / samples.length);

      // Throttled mic-level meter for the audio activity visualization.
      const now = performance.now();
      if (now - lastMicLevelUpdateRef.current > 90) {
        lastMicLevelUpdateRef.current = now;
        setMicLevel(muted ? 0 : Math.min(1, rms * 6));
      }

      if (rms > 0.045) {
        inputSpeechFramesRef.current += 1;
        inputQuietFramesRef.current = 0;
        if (inputSpeechFramesRef.current >= 2) {
          userSpeakingRef.current = true;
          if (speakingRef.current) stopPlayback();
        }
      } else {
        inputSpeechFramesRef.current = 0;
        inputQuietFramesRef.current += 1;
        if (inputQuietFramesRef.current >= 4) userSpeakingRef.current = false;
      }

      socket.send(JSON.stringify({
        realtimeInput: {
          audio: {
            data: floatToPcmBase64(samples, context.sampleRate),
            mimeType: 'audio/pcm;rate=16000',
          },
        },
      }));
    };

    source.connect(processor);
    processor.connect(muteGain);
    muteGain.connect(context.destination);
    sourceRef.current = source;
    processorRef.current = processor;
    muteGainRef.current = muteGain;
  }, [stopPlayback]);

  const startCall = useCallback(async () => {
    if (disabledRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof WebSocket === 'undefined') {
      onErrorRef.current?.('not-supported');
      return;
    }

    setIsBusy(true);
    setConnectionState('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const context = new AudioContext();
      audioContextRef.current = context;
      if (context.state === 'suspended') await context.resume();

      const response = await api.post<GeminiLiveTokenResponse>(
        `/sessions/${sessionId}/live-voice/token`,
        {
          role: roleRef.current,
          stage: stageRef.current,
          ...(stageRef.current.startsWith('examination:') ? { maneuverId: maneuverIdRef.current } : {}),
        },
      );

      const { token, model, config } = response.data;
      const socket = new WebSocket(`${GEMINI_LIVE_WS}?access_token=${encodeURIComponent(token)}`);
      socketRef.current = socket;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('connection-timeout'));
        }, 20_000);
        const finish = (error?: Error) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          if (error) reject(error);
          else resolve();
        };

        socket.onopen = () => {
          socket.send(JSON.stringify({
            setup: {
              model: `models/${model}`,
              ...config,
            },
          }));
        };
        socket.onmessage = (event) => {
          let message: Record<string, unknown>;
          try {
            message = JSON.parse(String(event.data)) as Record<string, unknown>;
          } catch {
            if (!settled) finish(new Error('invalid-provider-response'));
            else {
              stopCall();
              onErrorRef.current?.('start-failed');
            }
            return;
          }
          if (message.setupComplete) finish();
          if (message.error) finish(new Error('provider-setup-failed'));
          void handleServerMessage(message).catch(() => {
            stopCall();
            onErrorRef.current?.('start-failed');
          });
        };
        socket.onerror = () => finish(new Error('connection-failed'));
        socket.onclose = () => {
          if (!settled) finish(new Error('connection-closed'));
          else if (socketRef.current === socket) {
            stopCall();
            onErrorRef.current?.('network');
          }
        };
      });

      if (disabledRef.current) {
        stopCall();
        return;
      }
      startAudioCapture(socket, context, stream);
      activeContextRef.current = `${roleRef.current}:${stageRef.current}`;
      setConnectionState('connected');
      setIsLiveCall(true);
      setIsMicListening(true);
      setIsBusy(false);
    } catch (error) {
      setConnectionState('error');
      stopCall();
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onErrorRef.current?.('not-allowed');
      } else if (name === 'NotFoundError' || name === 'NotReadableError') {
        onErrorRef.current?.('audio-capture');
      } else if (error instanceof Error && error.message === 'connection-timeout') {
        onErrorRef.current?.('network');
      } else {
        onErrorRef.current?.('start-failed');
      }
    }
  }, [handleServerMessage, sessionId, startAudioCapture, stopCall]);

  const toggleLiveCall = useCallback(() => {
    if (isLiveCall || isBusy) stopCall();
    else void startCall();
  }, [isBusy, isLiveCall, startCall, stopCall]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setIsMuted(next);
    if (next) {
      userSpeakingRef.current = false;
      setMicLevel(0);
    }
  }, []);

  // A live connection is bound to exactly one role+stage. When the stage or
  // role changes (e.g. switching patient → examiner panel, or maneuver
  // transitions), terminate the previous connection — the student starts a
  // fresh call (free, no extra credits) for the new context.
  useEffect(() => {
    const key = `${role}:${stage}`;
    if (activeContextRef.current && activeContextRef.current !== key) {
      stopCall();
    }
  }, [role, stage, stopCall]);

  useEffect(() => {
    if (disabled) stopCall();
  }, [disabled, stopCall]);

  useEffect(() => () => stopCall(), [stopCall]);

  return {
    isLiveCall,
    isBusy,
    isSpeaking,
    isMicListening,
    connectionState,
    micLevel,
    isMuted,
    aiCaption,
    role,
    stage,
    isSupported: typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    toggleLiveCall,
    toggleMute,
    stopCall,
  };
}

