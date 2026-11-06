import { useCallback, useEffect, useRef, useState } from 'react';
import { postVoiceTurn, type VoiceTurnResponse } from '../lib/voiceTurn';

const MAX_RECORDING_MS = 60_000;
const OPENROUTER_AUDIO_TURN_TIMEOUT_MS = 130_000;
const WAV_SAMPLE_RATE = 24_000;

export interface OpenRouterPatientAudioControls {
  isRecording: boolean;
  isProcessing: boolean;
  isSupported: boolean;
  isSecure: boolean;
  studentTranscript: string;
  patientTranscript: string;
  audioUrl: string;
  error: string;
  startRecording: () => void;
  stopRecording: () => void;
}

interface UseOpenRouterPatientAudioOptions {
  sessionId: string;
  sessionLang: string;
  language: string;
  disabled?: boolean;
  onTurnComplete: (response: VoiceTurnResponse) => void;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const outputSampleCount = Math.floor((samples.length * WAV_SAMPLE_RATE) / sampleRate);
  const dataLength = outputSampleCount * bytesPerSample;
  const wav = new ArrayBuffer(44 + dataLength);
  const view = new DataView(wav);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };
  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, WAV_SAMPLE_RATE, true);
  view.setUint32(28, WAV_SAMPLE_RATE * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, dataLength, true);
  for (let index = 0; index < outputSampleCount; index += 1) {
    const position = (index * sampleRate) / WAV_SAMPLE_RATE;
    const left = Math.floor(position);
    const fraction = position - left;
    const first = samples[left] ?? 0;
    const second = samples[Math.min(left + 1, samples.length - 1)] ?? first;
    const sample = Math.max(-1, Math.min(1, first + (second - first) * fraction));
    view.setInt16(44 + index * bytesPerSample, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([wav], { type: 'audio/wav' });
}

function decodeAudioBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getErrorCode(error: unknown): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const code = (error as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  if (typeof code === 'string') return code;
  if (status === 404) return 'session-missing';
  if (status === 403) return 'live-voice-session-required';
  if (status === 503) return 'openrouter-audio-unavailable';
  if (status && status >= 400) return 'openrouter-audio-failed';
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') return 'not-allowed';
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'no-microphone';
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return 'mic-in-use';
  }
  return 'openrouter-audio-failed';
}

export function useOpenRouterPatientAudio({
  sessionId,
  sessionLang,
  language,
  disabled = false,
  onTurnComplete,
}: UseOpenRouterPatientAudioOptions): OpenRouterPatientAudioControls {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [studentTranscript, setStudentTranscript] = useState('');
  const [patientTranscript, setPatientTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const [isSecure, setIsSecure] = useState(
    typeof window === 'undefined' || window.isSecureContext !== false,
  );
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const samplesRef = useRef<Float32Array[]>([]);
  const sampleCountRef = useRef(0);
  const recordingRef = useRef(false);
  const processingRef = useRef(false);
  const disabledRef = useRef(disabled);
  const sessionIdRef = useRef(sessionId);
  const sessionLangRef = useRef(sessionLang);
  const languageRef = useRef(language);
  const onTurnCompleteRef = useRef(onTurnComplete);
  const timeoutRef = useRef<number | null>(null);
  const sampleRateRef = useRef(48_000);
  const stopRecordingRef = useRef<() => void>(() => {});
  const audioUrlRef = useRef('');

  disabledRef.current = disabled;
  sessionIdRef.current = sessionId;
  sessionLangRef.current = sessionLang;
  languageRef.current = language;
  onTurnCompleteRef.current = onTurnComplete;

  const releaseCapture = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (processorRef.current) processorRef.current.onaudioprocess = null;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const context = contextRef.current;
    contextRef.current = null;
    if (context && context.state !== 'closed') void context.close();
  }, []);

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setIsRecording(false);
    releaseCapture();

    const chunks = samplesRef.current;
    samplesRef.current = [];
    const sampleCount = sampleCountRef.current;
    sampleCountRef.current = 0;
    const contextSampleRate = sampleRateRef.current;
    if (sampleCount < contextSampleRate * 0.25) {
      setError('recording-too-short');
      return;
    }

    const samples = new Float32Array(sampleCount);
    let offset = 0;
    for (const chunk of chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    const blob = encodeWav(samples, contextSampleRate);
    processingRef.current = true;
    setIsProcessing(true);
    setError('');
    void postVoiceTurn(
      sessionIdRef.current,
      blob,
      languageRef.current,
      sessionLangRef.current,
      { endpoint: 'chat', stage: 'history' },
      {
        durationMs: Math.round((sampleCount / contextSampleRate) * 1000),
        speechDurationMs: Math.round((sampleCount / contextSampleRate) * 1000),
      },
      OPENROUTER_AUDIO_TURN_TIMEOUT_MS,
    )
      .then((response) => {
        if (!response.audioBase64) throw new Error('missing-audio-response');
        const audioBytes = decodeAudioBase64(response.audioBase64);
        const audioBuffer = new ArrayBuffer(audioBytes.byteLength);
        new Uint8Array(audioBuffer).set(audioBytes);
        const nextUrl = URL.createObjectURL(
          new Blob([audioBuffer], { type: 'audio/wav' }),
        );
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = nextUrl;
        setAudioUrl(nextUrl);
        setStudentTranscript(response.transcript);
        setPatientTranscript(response.replyMessage.content);
        onTurnCompleteRef.current(response);
      })
      .catch((requestError: unknown) => {
        const code = getErrorCode(requestError);
        setError(code);
      })
      .finally(() => {
        processingRef.current = false;
        setIsProcessing(false);
      });
  }, [releaseCapture]);
  stopRecordingRef.current = stopRecording;

  const startRecording = useCallback(async () => {
    if (disabledRef.current || recordingRef.current || processingRef.current) return;
    setError('');
    setStudentTranscript('');
    setPatientTranscript('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('not-supported');
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError('insecure-context');
      return;
    }

    try {
      const AudioContextConstructor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) {
        setError('not-supported');
        return;
      }
      const activeContext = new AudioContextConstructor();
      contextRef.current = activeContext;
      void activeContext.resume();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      if (disabledRef.current) {
        releaseCapture();
        return;
      }
      if (activeContext.state === 'suspended') await activeContext.resume();
      if (activeContext.state !== 'running') throw new Error('audio-context-not-running');

      sampleRateRef.current = activeContext.sampleRate;
      sampleCountRef.current = 0;
      const source = activeContext.createMediaStreamSource(stream);
      const processor = activeContext.createScriptProcessor(4096, 1, 1);
      const gain = activeContext.createGain();
      gain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        if (!recordingRef.current) return;
        const samples = new Float32Array(event.inputBuffer.getChannelData(0));
        samplesRef.current.push(samples);
        sampleCountRef.current += samples.length;
        if (sampleCountRef.current >= activeContext.sampleRate * 60) {
          stopRecordingRef.current();
        }
      };
      source.connect(processor);
      processor.connect(gain);
      gain.connect(activeContext.destination);
      sourceRef.current = source;
      processorRef.current = processor;
      gainRef.current = gain;
      samplesRef.current = [];
      recordingRef.current = true;
      setIsRecording(true);
      timeoutRef.current = window.setTimeout(() => stopRecordingRef.current(), MAX_RECORDING_MS);
    } catch (captureError) {
      releaseCapture();
      setError(getErrorCode(captureError));
    }
  }, [releaseCapture]);

  useEffect(() => {
    if (typeof window !== 'undefined') setIsSecure(window.isSecureContext !== false);
  }, []);

  useEffect(() => {
    if (disabled && recordingRef.current) {
      recordingRef.current = false;
      samplesRef.current = [];
      sampleCountRef.current = 0;
      setIsRecording(false);
      releaseCapture();
    }
  }, [disabled, releaseCapture]);

  useEffect(
    () => () => {
      recordingRef.current = false;
      releaseCapture();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    },
    [releaseCapture],
  );

  return {
    isRecording,
    isProcessing,
    isSupported: typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
    isSecure,
    studentTranscript,
    patientTranscript,
    audioUrl,
    error,
    startRecording,
    stopRecording,
  };
}
