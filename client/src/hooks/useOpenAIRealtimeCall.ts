import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../lib/api';
import { postRealtimeCallOffer } from '../lib/realtimeCall';

interface RealtimeMessagePayload {
  id: string;
  role: string;
  content: string;
  stage: string;
  createdAt: string;
}

interface UseOpenAIRealtimeCallOptions {
  sessionId: string;
  stage?: string;
  sessionLanguage?: string;
  onStudentMessage?: (message: RealtimeMessagePayload) => void;
  onPatientMessage?: (message: RealtimeMessagePayload) => void;
  onCallReady?: () => void;
  onError?: (code: string) => void;
}

const IS_MOBILE =
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

function isRealtimeSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof RTCPeerConnection !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestMicAccess(): Promise<MediaStream> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err) {
      lastError = err;
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') throw err;
      if (attempt < 2) await wait(300 * (attempt + 1));
    }
  }
  throw lastError;
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener('icegatheringstatechange', done);
      resolve();
    };
    pc.addEventListener('icegatheringstatechange', done);
    setTimeout(done, IS_MOBILE ? 3000 : 2000);
  });
}

function readLocalSdp(pc: RTCPeerConnection): string {
  return pc.localDescription?.sdp?.trim() ?? '';
}

export function useOpenAIRealtimeCall({
  sessionId,
  stage = 'history',
  sessionLanguage = 'AR',
  onStudentMessage,
  onPatientMessage,
  onCallReady,
  onError,
}: UseOpenAIRealtimeCallOptions) {
  const [isLiveCall, setIsLiveCall] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seenEventsRef = useRef<Set<string>>(new Set());
  const savedStudentItemsRef = useRef<Set<string>>(new Set());
  const savedPatientResponsesRef = useRef<Set<string>>(new Set());
  const turnCounterRef = useRef(0);
  const studentTurnQueueRef = useRef<number[]>([]);
  const patientTurnQueueRef = useRef<number[]>([]);
  const savedStudentTurnsRef = useRef<Set<number>>(new Set());
  const studentTurnResolversRef = useRef<Map<number, () => void>>(new Map());
  const assistantSpeakingRef = useRef(false);
  const stageRef = useRef(stage);
  const onStudentRef = useRef(onStudentMessage);
  const onPatientRef = useRef(onPatientMessage);
  const onCallReadyRef = useRef(onCallReady);
  const onErrorRef = useRef(onError);

  stageRef.current = stage;
  onStudentRef.current = onStudentMessage;
  onPatientRef.current = onPatientMessage;
  onCallReadyRef.current = onCallReady;
  onErrorRef.current = onError;

  const releaseMedia = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
  }, []);

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
      const res = await api.post<{ message: RealtimeMessagePayload }>(
        `/sessions/${sessionId}/realtime/message`,
        { role, content, stage: stageRef.current, orderIndex },
      );
      return res.data.message;
    },
    [sessionId],
  );

  const handleServerEvent = useCallback(
    async (event: Record<string, unknown>) => {
      const type = String(event.type || '');
      const eventId = event.event_id ? String(event.event_id) : '';
      if (eventId) {
        if (seenEventsRef.current.has(eventId)) return;
        seenEventsRef.current.add(eventId);
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
        assistantSpeakingRef.current = true;
        setIsSpeaking(true);
      }

      if (type === 'response.done' || type === 'response.output_audio.done') {
        assistantSpeakingRef.current = false;
        setIsSpeaking(false);
        setIsBusy(false);
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
          onStudentRef.current?.(message);
        } catch {
          markStudentSaved(turn);
          onErrorRef.current?.('transcription-failed');
        }
        return;
      }

      if (type === 'response.output_audio_transcript.done') {
        const transcript = String(event.transcript || '').trim();
        const responseId = String(event.response_id || event.item_id || '');
        if (!transcript || !responseId || savedPatientResponsesRef.current.has(responseId)) return;
        savedPatientResponsesRef.current.add(responseId);

        const turn = patientTurnQueueRef.current.shift();
        if (!turn) return;

        try {
          await waitForStudentTurn(turn);
          const message = await persistMessage('PATIENT', transcript, turn * 2 + 1);
          onPatientRef.current?.(message);
        } catch {
          onErrorRef.current?.('network');
        }
      }
    },
    [markStudentSaved, persistMessage, waitForStudentTurn],
  );

  const stopCall = useCallback(() => {
    dcRef.current?.close();
    pcRef.current?.close();
    dcRef.current = null;
    pcRef.current = null;
    seenEventsRef.current.clear();
    savedStudentItemsRef.current.clear();
    savedPatientResponsesRef.current.clear();
    turnCounterRef.current = 0;
    studentTurnQueueRef.current = [];
    patientTurnQueueRef.current = [];
    savedStudentTurnsRef.current.clear();
    studentTurnResolversRef.current.clear();
    assistantSpeakingRef.current = false;
    setIsSpeaking(false);
    releaseMedia();
    setIsLiveCall(false);
    setIsBusy(false);
  }, [releaseMedia]);

  const startCall = useCallback(async () => {
    if (!isRealtimeSupported()) {
      onErrorRef.current?.('not-supported');
      return;
    }

    setIsBusy(true);
    seenEventsRef.current.clear();
    savedStudentItemsRef.current.clear();
    savedPatientResponsesRef.current.clear();
    turnCounterRef.current = 0;
    studentTurnQueueRef.current = [];
    patientTurnQueueRef.current = [];
    savedStudentTurnsRef.current.clear();
    studentTurnResolversRef.current.clear();

    try {
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audioRef.current = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? null;
        void audio.play().catch(() => undefined);
      };

      const stream = await requestMicAccess();
      streamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;
      dc.addEventListener('message', (messageEvent) => {
        try {
          const payload = JSON.parse(String(messageEvent.data)) as Record<string, unknown>;
          void handleServerEvent(payload);
        } catch {
          // Ignore malformed events.
        }
      });

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      await waitForIceGathering(pc);

      const localSdp = readLocalSdp(pc);
      if (localSdp.length < 100 || !localSdp.includes('m=audio')) {
        throw new DOMException('Incomplete SDP offer', 'InvalidStateError');
      }

      const answerSdp = await postRealtimeCallOffer(sessionId, localSdp);

      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      setIsLiveCall(true);
      setIsBusy(false);
      onCallReadyRef.current?.();
    } catch (err) {
      stopCall();
      const name = err instanceof DOMException ? err.name : '';
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onErrorRef.current?.('not-allowed');
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        onErrorRef.current?.('audio-capture');
      } else if (status === 503) onErrorRef.current?.('transcription-unavailable');
      else if (status === 403 || status === 401) onErrorRef.current?.('not-allowed');
      else onErrorRef.current?.('start-failed');
    }
  }, [handleServerEvent, sessionId, stopCall]);

  const toggleLiveCall = useCallback(() => {
    if (isLiveCall) stopCall();
    else void startCall();
  }, [isLiveCall, startCall, stopCall]);

  useEffect(() => () => stopCall(), [stopCall]);

  return {
    isLiveCall,
    isBusy,
    isSupported: isRealtimeSupported(),
    isMicListening: isLiveCall,
    isSpeaking,
    toggleLiveCall,
    stopCall,
  };
}
