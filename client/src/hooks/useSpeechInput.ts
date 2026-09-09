import { useCallback, useEffect, useRef, useState } from 'react';
import { markBrowserSttRuntimeFailure, shouldUseBrowserStt, startBrowserStt, type BrowserSttSession } from '../lib/browserStt';
import {
  getMicConstraints,
  IS_MOBILE,
  maxRecordDurationMs,
  minBlobBytes,
  minRecordMs,
  recorderTimesliceMs,
  unlockMobileAudio,
} from '../lib/mobileAudio';
import { abortActiveSpeechRecognition, releaseMicrophoneStream } from '../lib/speechRecognition';
import {
  isAudioRecordingSupported,
  pickAudioMimeType,
  transcribeAudioBlob,
} from '../lib/transcribe';

const PROCESSING_TIMEOUT_MS = IS_MOBILE ? 22_000 : 28_000;

interface UseSpeechInputOptions {
  lang: string;
  sessionLang?: string;
  onInterim?: (text: string) => void;
  onComplete?: (text: string) => void;
  onError?: (code: string) => void;
}

export function useSpeechInput({ lang, sessionLang = 'AR', onInterim, onComplete, onError }: UseSpeechInputOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const browserSttRef = useRef<BrowserSttSession | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef('audio/webm');
  const startedAtRef = useRef(0);
  const onInterimRef = useRef(onInterim);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const langRef = useRef(lang);
  const sessionLangRef = useRef(sessionLang);

  onInterimRef.current = onInterim;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  langRef.current = lang;
  sessionLangRef.current = sessionLang;

  // Prefer device STT; server transcription when Web Speech API is unavailable
  // (e.g. Firefox) or failed at runtime (e.g. Google speech servers unreachable).
  const isSupported = shouldUseBrowserStt() || isAudioRecordingSupported();
  const startRecorderListeningRef = useRef<(() => Promise<void>) | null>(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearProcessingTimer = useCallback(() => {
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  }, []);

  const forceReleaseMic = useCallback(() => {
    clearProcessingTimer();
    if (recordTimerRef.current) {
      clearTimeout(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    browserSttRef.current?.abort();
    browserSttRef.current = null;
    abortActiveSpeechRecognition();
    releaseMicrophoneStream(true);

    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    releaseStream();
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.onstop = null;
        recorder.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
    setIsProcessing(false);
  }, [clearProcessingTimer, releaseStream]);

  const armProcessingTimeout = useCallback(() => {
    clearProcessingTimer();
    processingTimerRef.current = setTimeout(() => {
      processingTimerRef.current = null;
      forceReleaseMic();
      onErrorRef.current?.('network');
    }, PROCESSING_TIMEOUT_MS);
  }, [clearProcessingTimer, forceReleaseMic]);

  const stopRecording = useCallback(() => {
    if (browserSttRef.current) {
      setIsProcessing(true);
      armProcessingTimeout();
      browserSttRef.current.stop();
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.requestData();
      } catch {
        // Some browsers don't support requestData.
      }
      try {
        recorder.stop();
      } catch {
        releaseStream();
        setIsListening(false);
      }
      return;
    }
    releaseStream();
    setIsListening(false);
  }, [armProcessingTimeout, releaseStream]);

  const startBrowserListening = useCallback(async () => {
    await unlockMobileAudio();
    releaseMicrophoneStream();
    setIsListening(true);

    const session = await startBrowserStt({
      lang: langRef.current,
      sessionLang: sessionLangRef.current,
      manualStop: true,
      maxDurationMs: maxRecordDurationMs(),
      onInterim: (text) => onInterimRef.current?.(text),
      onResult: (text) => {
        if (recordTimerRef.current) {
          clearTimeout(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        clearProcessingTimer();
        browserSttRef.current = null;
        setIsListening(false);
        setIsProcessing(false);
        onCompleteRef.current?.(text);
      },
      onError: (code) => {
        if (recordTimerRef.current) {
          clearTimeout(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        clearProcessingTimer();
        browserSttRef.current = null;
        setIsListening(false);
        setIsProcessing(false);
        if ((code === 'network' || code === 'start-failed') && isAudioRecordingSupported()) {
          // Web Speech API failed at runtime — retry immediately with the
          // recorder + server transcription path so the user can keep talking.
          markBrowserSttRuntimeFailure();
          void startRecorderListeningRef.current?.();
          return;
        }
        if (code === 'transcription-invalid') {
          onErrorRef.current?.('micArabicFailed');
        } else {
          onErrorRef.current?.(code);
        }
      },
    });

    if (!session) {
      setIsListening(false);
      return;
    }

    browserSttRef.current = session;
    recordTimerRef.current = setTimeout(() => {
      if (browserSttRef.current) {
        setIsProcessing(true);
        armProcessingTimeout();
        browserSttRef.current.stop();
      }
    }, maxRecordDurationMs());
  }, [armProcessingTimeout, clearProcessingTimer]);

  const startRecorderListening = useCallback(async () => {
    if (!isAudioRecordingSupported()) {
      onErrorRef.current?.('not-supported');
      return;
    }

    try {
      await unlockMobileAudio();
      releaseMicrophoneStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: getMicConstraints(),
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = pickAudioMimeType();
      mimeTypeRef.current = mimeType || 'audio/webm';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        releaseStream();
        setIsListening(false);
        onErrorRef.current?.('audio-capture');
      };

      recorder.onstop = async () => {
        if (recordTimerRef.current) {
          clearTimeout(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        setIsListening(false);
        releaseStream();
        mediaRecorderRef.current = null;

        const elapsed = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        chunksRef.current = [];

        if (elapsed < minRecordMs() || blob.size < minBlobBytes()) {
          onErrorRef.current?.('no-speech');
          return;
        }

        setIsProcessing(true);
        armProcessingTimeout();
        onInterimRef.current?.('…');

        try {
          const text = await transcribeAudioBlob(blob, langRef.current, sessionLangRef.current);
          if (text) {
            onCompleteRef.current?.(text);
          } else {
            onErrorRef.current?.('no-speech');
          }
        } catch (err) {
          const code = err instanceof Error ? err.message : '';
          const status = (err as { response?: { status?: number; data?: { error?: string } } })?.response?.status;
          const errMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || '';
          if (code === 'transcription-timeout') {
            onErrorRef.current?.('network');
          } else if (status === 422 || status === 400) {
            onErrorRef.current?.(errMsg.toLowerCase().includes('arabic') ? 'micArabicFailed' : 'no-speech');
          } else if (status === 503) {
            onErrorRef.current?.('transcription-unavailable');
          } else {
            onErrorRef.current?.('transcription-failed');
          }
        } finally {
          clearProcessingTimer();
          setIsProcessing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start(recorderTimesliceMs());
      recordTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, maxRecordDurationMs());
      setIsListening(true);
    } catch (err) {
      releaseStream();
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        onErrorRef.current?.('not-allowed');
      } else {
        onErrorRef.current?.('audio-capture');
      }
    }
  }, [armProcessingTimeout, clearProcessingTimer, releaseStream, stopRecording]);

  startRecorderListeningRef.current = startRecorderListening;

  const startListening = useCallback(async () => {
    if (isListening || isProcessing) return;

    if (shouldUseBrowserStt()) {
      await startBrowserListening();
      return;
    }

    await startRecorderListening();
  }, [isListening, isProcessing, startBrowserListening, startRecorderListening]);

  const toggleListening = useCallback(() => {
    if (isProcessing) {
      forceReleaseMic();
      return;
    }
    if (isListening) stopRecording();
    else void startListening();
  }, [forceReleaseMic, isListening, isProcessing, startListening, stopRecording]);

  useEffect(
    () => () => {
      forceReleaseMic();
    },
    [forceReleaseMic],
  );

  return {
    isListening,
    isProcessing,
    isSupported,
    toggleListening,
    stopListening: stopRecording,
    forceReleaseMic,
    startListening,
  };
};
