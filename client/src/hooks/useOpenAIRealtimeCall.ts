import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { postRealtimeCallOffer } from '../lib/realtimeCall';

interface RealtimeMessagePayload {
  id: string;
  role: 'STUDENT' | 'PATIENT';
  content: string;
  stage: string;
  createdAt: string;
}

interface UseOpenAIRealtimeCallOptions {
  sessionId: string;
  /** Stage the transcript turns are persisted under (patient history for now). */
  stage?: string;
  /** Explicitly disable starting; an open call is torn down immediately. */
  disabled?: boolean;
  onStudentMessage?: (message: RealtimeMessagePayload) => void;
  onPatientMessage?: (message: RealtimeMessagePayload) => void;
  onCallReady?: () => void;
  onError?: (code: string) => void;
  /** Invoked at the top of startCall (the user's click) — e.g. to clear stale errors. */
  onStartAttempt?: () => void;
}

/** Same lifecycle contract as useGeminiLiveVoiceCall / LiveVoiceCallControls. */
export type OpenAIRealtimeConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * Microphone lifecycle shown to the user. Mirrors the Gemini hook: the
 * permission request is ALWAYS initiated directly from the Start-call click
 * (a real user gesture), never from an effect.
 */
export type OpenAIRealtimeMicStatus =
  | 'idle'
  | 'requesting-permission'
  | 'mic-active'
  | 'connecting'
  | 'connected'
  | 'failed';

const IS_MOBILE =
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const ICE_GATHER_TIMEOUT_MS = IS_MOBILE ? 3000 : 4000;
/** How long to wait for `session.closed` after sending `session.close`. */
const GRACEFUL_CLOSE_TIMEOUT_MS = 2000;

function isRealtimeSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof RTCPeerConnection !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * Map any startup failure to a stable error code the UI can explain.
 * Mirrors the categories used by the Gemini live-call hook.
 */
function mapStartError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'not-allowed';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'no-microphone';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'mic-in-use';
      case 'SecurityError':
        return 'insecure-context';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'audio-capture';
      default:
        break;
    }
  }
  if (error instanceof Error) {
    if (error.message === 'connection-timeout') return 'network';
  }
  // Fetch errors from the /realtime/call SDP exchange carry a status.
  const status = (error as { status?: number })?.status;
  if (typeof status === 'number') {
    if (status === 404) return 'session-missing';
    if (status === 403) return 'live-voice-session-required';
    if (status === 503) return 'realtime-not-configured';
    if (status === 401) return 'realtime-not-configured';
    if (status >= 400) return 'realtime-call-failed';
  }
  return 'start-failed';
}

export function useOpenAIRealtimeCall({
  sessionId,
  stage = 'history',
  disabled = false,
  onStudentMessage,
  onPatientMessage,
  onCallReady,
  onError,
  onStartAttempt,
}: UseOpenAIRealtimeCallOptions) {
  const [isLiveCall, setIsLiveCall] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMicListening, setIsMicListening] = useState(false);
  const [connectionState, setConnectionState] = useState<OpenAIRealtimeConnectionState>('idle');
  const [micStatus, setMicStatus] = useState<OpenAIRealtimeMicStatus>('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [aiCaption, setAiCaption] = useState('');
  const [isSecure, setIsSecure] = useState(
    typeof window === 'undefined' || window.isSecureContext !== false,
  );

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const meterContextRef = useRef<AudioContext | null>(null);
  const meterRafRef = useRef<number | null>(null);
  const lastMicLevelUpdateRef = useRef(0);
  /** Guards graceful close: set when session.close has been sent. */
  const closingRef = useRef(false);
  const forceCloseTimerRef = useRef<number | null>(null);
  /** Context key the live connection was started for (stage binding). */
  const activeContextRef = useRef<string | null>(null);

  const seenEventsRef = useRef<Set<string>>(new Set());
  const savedStudentItemsRef = useRef<Set<string>>(new Set());
  const savedPatientResponsesRef = useRef<Set<string>>(new Set());
  const turnCounterRef = useRef(0);
  const studentTurnQueueRef = useRef<number[]>([]);
  const patientTurnQueueRef = useRef<number[]>([]);
  const savedStudentTurnsRef = useRef<Set<number>>(new Set());
  const studentTurnResolversRef = useRef<Map<number, () => void>>(new Map());
  const patientCaptionRef = useRef('');
  const stageRef = useRef(stage);
  const onStudentRef = useRef(onStudentMessage);
  const onPatientRef = useRef(onPatientMessage);
  const onCallReadyRef = useRef(onCallReady);
  const onErrorRef = useRef(onError);
  const onStartAttemptRef = useRef(onStartAttempt);
  const disabledRef = useRef(disabled);
  const mutedRef = useRef(false);
  const isLiveCallRef = useRef(false);

  stageRef.current = stage;
  onStudentRef.current = onStudentMessage;
  onPatientRef.current = onPatientMessage;
  onCallReadyRef.current = onCallReady;
  onErrorRef.current = onError;
  onStartAttemptRef.current = onStartAttempt;
  disabledRef.current = disabled;
  isLiveCallRef.current = isLiveCall;

  const teardown = useCallback(() => {
    if (forceCloseTimerRef.current !== null) {
      window.clearTimeout(forceCloseTimerRef.current);
      forceCloseTimerRef.current = null;
    }
    if (meterRafRef.current !== null) {
      cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = null;
    }
    meterContextRef.current?.close().catch(() => undefined);
    meterContextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.onmessage = null;
      try {
        dcRef.current.close();
      } catch {
        // Channel may already be closed.
      }
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      try {
        pcRef.current.close();
      } catch {
        // Peer connection may already be closed.
      }
      pcRef.current = null;
    }
    closingRef.current = false;
    seenEventsRef.current.clear();
    savedStudentItemsRef.current.clear();
    savedPatientResponsesRef.current.clear();
    turnCounterRef.current = 0;
    studentTurnQueueRef.current = [];
    patientTurnQueueRef.current = [];
    savedStudentTurnsRef.current.clear();
    studentTurnResolversRef.current.clear();
    patientCaptionRef.current = '';
    mutedRef.current = false;
    activeContextRef.current = null;
    lastMicLevelUpdateRef.current = 0;
    setIsMuted(false);
    setMicLevel(0);
    setAiCaption('');
    setConnectionState('idle');
    setMicStatus('idle');
    setIsLiveCall(false);
    setIsBusy(false);
    setIsMicListening(false);
  }, []);

  /**
   * End the call. The first press sends `session.close` and waits (briefly)
   * for the final transcript events to drain; a second press tears down
   * immediately. If the data channel is not open the teardown is immediate.
   */
  const stopCall = useCallback(() => {
    if (!pcRef.current && !dcRef.current) {
      teardown();
      return;
    }
    if (closingRef.current) {
      teardown();
      return;
    }
    closingRef.current = true;
    const dc = dcRef.current;
    if (dc?.readyState === 'open') {
      try {
        dc.send(JSON.stringify({ type: 'session.close' }));
      } catch {
        teardown();
        return;
      }
      forceCloseTimerRef.current = window.setTimeout(() => teardown(), GRACEFUL_CLOSE_TIMEOUT_MS);
    } else {
      teardown();
    }
  }, [teardown]);

  const waitForStudentTurn = useCallback((turn: number) => {
    if (savedStudentTurnsRef.current.has(turn)) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      studentTurnResolversRef.current.set(turn, resolve);
    });
  }, []);

  const markStudentSaved = useCallback((turn: number) => {
    savedStudentTurnsRef.current.add(turn);
    const resolve = studentTurnResolversRef.current.get(turn);
    if (resolve) {
      studentTurnResolversRef.current.delete(turn);
      resolve();
    }
  }, []);

  const persistMessage = useCallback(
    async (role: 'STUDENT' | 'PATIENT', content: string, orderIndex: number) => {
      const text = content.trim();
      if (!text) return null;
      const res = await api.post<{ message: RealtimeMessagePayload }>(
        `/sessions/${sessionId}/realtime/message`,
        { role, content: text, stage: stageRef.current, orderIndex },
      );
      return res.data.message;
    },
    [sessionId],
  );

  /**
   * Data-channel server events (GA Realtime protocol). Audio itself rides on
   * the WebRTC media tracks — only transcripts and lifecycle arrive here.
   */
  const handleServerEvent = useCallback(
    async (event: Record<string, unknown>) => {
      const type = String(event.type || '');
      const eventId = event.event_id ? String(event.event_id) : '';
      if (eventId) {
        if (seenEventsRef.current.has(eventId)) return;
        seenEventsRef.current.add(eventId);
      }

      if (type === 'error') {
        // Non-fatal protocol error — report but keep the connection alive.
        console.error('[realtime] server error event:', event.error ?? event);
        onErrorRef.current?.('transcription-failed');
        return;
      }

      if (type === 'response.failed') {
        setIsSpeaking(false);
        setIsBusy(false);
        onErrorRef.current?.('transcription-failed');
        return;
      }

      if (type === 'session.closed') {
        // Final event after session.close — safe to destroy everything now.
        teardown();
        return;
      }

      if (
        type === 'input_audio_buffer.speech_started' ||
        type === 'response.created' ||
        type === 'response.output_audio.started'
      ) {
        setIsBusy(true);
      }

      if (type === 'input_audio_buffer.speech_stopped') {
        const turn = ++turnCounterRef.current;
        studentTurnQueueRef.current.push(turn);
        patientTurnQueueRef.current.push(turn);
      }

      if (type === 'response.created' || type === 'response.output_audio.started') {
        setIsSpeaking(true);
      }

      if (type === 'response.done' || type === 'response.output_audio.done') {
        setIsSpeaking(false);
        setIsBusy(false);
      }

      if (type === 'response.output_audio_transcript.delta') {
        const delta = String(event.delta || '');
        if (delta) {
          patientCaptionRef.current += delta;
          // Live caption of what the patient is currently saying.
          setAiCaption(patientCaptionRef.current);
        }
      }

      if (type === 'conversation.item.input_audio_transcription.completed') {
        const transcript = String(event.transcript || '').trim();
        const itemId = String(event.item_id || transcript);
        if (!transcript || savedStudentItemsRef.current.has(itemId)) return;
        savedStudentItemsRef.current.add(itemId);

        const turn = studentTurnQueueRef.current.shift();
        if (!turn) return;

        try {
          const message = await persistMessage('STUDENT', transcript, turn * 2);
          markStudentSaved(turn);
          if (message) onStudentRef.current?.(message);
        } catch {
          markStudentSaved(turn);
          onErrorRef.current?.('transcription-failed');
        }
        return;
      }

      if (type === 'response.output_audio_transcript.done') {
        const transcript = String(event.transcript || '').trim();
        const responseId = String(event.response_id || event.item_id || '');
        if (transcript) {
          patientCaptionRef.current = transcript;
          setAiCaption(transcript);
        }
        if (!transcript || !responseId || savedPatientResponsesRef.current.has(responseId)) return;
        savedPatientResponsesRef.current.add(responseId);

        const turn = patientTurnQueueRef.current.shift();
        if (!turn) return;

        try {
          // Keep the transcripts in the order they were spoken: never store
          // the patient response before the student question it answers.
          await waitForStudentTurn(turn);
          const message = await persistMessage('PATIENT', transcript, turn * 2 + 1);
          if (message) onPatientRef.current?.(message);
        } catch {
          onErrorRef.current?.('network');
        }
      }
    },
    [persistMessage, markStudentSaved, waitForStudentTurn, teardown],
  );

  /** Live mic level meter for the audio activity visualization. */
  const startMicMetering = useCallback((stream: MediaStream) => {
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    try {
      const context = new AudioCtx();
      meterContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const buffer = new Uint8Array(analyser.fftSize);
      const tick = () => {
        meterRafRef.current = requestAnimationFrame(tick);
        const now = performance.now();
        if (now - lastMicLevelUpdateRef.current < 90) return;
        lastMicLevelUpdateRef.current = now;
        analyser.getByteTimeDomainData(buffer);
        let squareSum = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const deviation = (buffer[i] - 128) / 128;
          squareSum += deviation * deviation;
        }
        const rms = Math.sqrt(squareSum / buffer.length);
        // Internal muted state wins so the bars never move while muted.
        setMicLevel(mutedRef.current ? 0 : Math.min(1, rms * 6));
      };
      meterRafRef.current = requestAnimationFrame(tick);
    } catch {
      // Metering is cosmetic — a blocked context must not break the call.
    }
  }, []);

  function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        pc.removeEventListener('icegatheringstatechange', onStateChange);
        resolve();
      };
      const onStateChange = () => {
        if (pc.iceGatheringState === 'complete') done();
      };
      pc.addEventListener('icegatheringstatechange', onStateChange);
      setTimeout(done, ICE_GATHER_TIMEOUT_MS);
    });
  }

  const startCall = useCallback(async () => {
    // Permission is only ever requested from this function, which is invoked
    // directly by the Start-call button (a real user interaction).
    onStartAttemptRef.current?.();
    if (disabledRef.current) return;
    if (!isRealtimeSupported()) {
      setMicStatus('failed');
      onErrorRef.current?.('not-supported');
      return;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      // Browsers disable getUserMedia entirely on insecure origins.
      setIsSecure(false);
      setMicStatus('failed');
      onErrorRef.current?.('insecure-context');
      return;
    }
    if (pcRef.current || dcRef.current) {
      // A previous connection is still draining — destroy it synchronously
      // so the new call starts from a clean slate (mic, tracks, ICE).
      teardown();
    }

    setIsBusy(true);
    setConnectionState('connecting');
    try {
      setMicStatus('requesting-permission');
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (constraintError) {
        // Some devices reject the processing constraints — retry with the
        // bare minimum so no supported microphone is turned away.
        const name = constraintError instanceof DOMException ? constraintError.name : '';
        if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw constraintError;
        }
      }
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || audioTracks[0].readyState !== 'live') {
        stream.getTracks().forEach((track) => track.stop());
        throw new DOMException('No live microphone track', 'NotFoundError');
      }
      streamRef.current = stream;
      setMicStatus('mic-active');

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote (patient) audio playback via an out-of-DOM element.
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audioRef.current = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? null;
        void audio.play().catch(() => undefined);
      };

      // Local microphone on the media transport.
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Data channel for protocol events — registered BEFORE the offer.
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.addEventListener('message', (messageEvent) => {
        try {
          const payload = JSON.parse(String(messageEvent.data)) as Record<string, unknown>;
          void handleServerEvent(payload).catch(() => {
            onErrorRef.current?.('transcription-failed');
          });
        } catch {
          // Ignore malformed events.
        }
      });

      setMicStatus('connecting');
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const localSdp = pc.localDescription?.sdp?.trim() ?? '';
      if (localSdp.length < 100 || !localSdp.includes('m=audio')) {
        throw new DOMException('Incomplete SDP offer', 'InvalidStateError');
      }

      const answerSdp = await postRealtimeCallOffer(sessionId, localSdp);
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // Track the transport state so the UI reflects real connectivity.
      pc.onconnectionstatechange = () => {
        const state = pcRef.current?.connectionState;
        if (state === 'connected') {
          setConnectionState('connected');
        } else if (state === 'failed' || state === 'closed') {
          // A failed transport ends the call; durations "closed" also fires
          // during normal teardown, but the handler is detached by then.
          if (isLiveCallRef.current) {
            onErrorRef.current?.('network');
          }
          teardown();
        } else if (state === 'disconnected') {
          // Transient (e.g. brief network blip) — it can recover to
          // 'connected'; only 'failed'/'closed' destroy the call.
          setConnectionState('connecting');
        }
      };

      activeContextRef.current = stageRef.current;
      if (disabledRef.current) {
        stopCall();
        return;
      }
      setIsLiveCall(true);
      setIsMicListening(true);
      setIsBusy(false);
      setConnectionState('connected');
      setMicStatus('connected');
      startMicMetering(stream);
      onCallReadyRef.current?.();
    } catch (error) {
      teardown();
      setConnectionState('error');
      setMicStatus('failed');
      onErrorRef.current?.(mapStartError(error));
      if (import.meta.env.DEV) {
        console.error('[openai-realtime] call start failed:', error);
      }
    }
  }, [handleServerEvent, sessionId, startMicMetering, stopCall, teardown]);

  const toggleLiveCall = useCallback(() => {
    if (isLiveCall || isBusy) stopCall();
    else void startCall();
  }, [isBusy, isLiveCall, startCall, stopCall]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setIsMuted(next);
    const track = streamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = !next;
    if (next) setMicLevel(0);
  }, []);

  // The connection is bound to exactly one stage; when the stage changes the
  // previous connection must terminate so the next call starts fresh.
  useEffect(() => {
    if (activeContextRef.current && activeContextRef.current !== stage) {
      stopCall();
    }
  }, [stage, stopCall]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsSecure(window.isSecureContext !== false);
    }
  }, []);

  // A disabled live call (session locked / no context) must never stay open.
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
    micStatus,
    micLevel,
    isMuted,
    aiCaption,
    isSupported: isRealtimeSupported(),
    isSecure,
    toggleLiveCall,
    toggleMute,
    stopCall,
  };
}
