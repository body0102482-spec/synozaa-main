import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import {
  MessageSquare,
  Search,
  FlaskConical,
  ClipboardList,
  Lightbulb,
  UserCircle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Stethoscope,
  Eye,
  Download,
  Shield,
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  GraduationCap,
  Maximize2,
  X,
  Star,
  AlertTriangle,
  HelpCircle,
  XCircle,
  Target,
  Brain,
  Layers,
  Flag,
  ShieldCheck,
  Globe,
  QrCode,
  FileText,
  Sparkles,
  ChevronLeft,
  PhoneCall,
  Mic,
  Send,
} from "lucide-react";
import api from "../lib/api";
import { dispatchEntitlementsChanged } from "../lib/entitlementsEvents";
import { downloadOsceReportPdf } from "../lib/osceReportPdf";
import { ConnectionStatus } from "../components/ConnectionStatus";
import chestInspectionImg from "../assets/exam/chest-inspection.svg?url";
import chestPalpationImg from "../assets/exam/chest-palpation.svg?url";
import chestPercussionImg from "../assets/exam/chest-percussion.svg?url";
import chestAuscultationImg from "../assets/exam/chest-auscultation.svg?url";
// import { VoiceMicButton } from '../components/VoiceMicButton';
import { SimulationChatInput } from '../components/SimulationChatInput';
import { ChatScrollArea } from '../components/ChatScrollArea';
import { LiveCallButton } from '../components/LiveCallButton';
import { LiveCallMicStatus } from '../components/LiveCallMicStatus';
import { SpeechLanguageToggle } from '../components/SpeechLanguageToggle';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { useLiveVoiceCall } from '../hooks/useLivePatientCall';
import { useOpenAIRealtimeCall } from '../hooks/useOpenAIRealtimeCall';
import { stopSpeaking } from '../lib/speech';
import { IS_MOBILE, unlockMobileAudio } from '../lib/mobileAudio';
import type { VoiceTurnResponse } from '../lib/voiceTurn';
import { isVivaClosingMessage } from '../lib/vivaClosing';
import {
  XpBreakdownSection,
  parseRankSnapshot,
  type RankSnapshot,
} from '../components/student/XpBreakdownSection';
import { RankPromotionModal } from '../components/student/RankPromotionModal';
import { getNextMainStageAfter, getSessionStationConfig, getSimulationStages, resolveManeuverLabel } from '../lib/stationConfig';

interface Message {
  id: string;
  role: "STUDENT" | "PATIENT" | "EXAMINER" | "SYSTEM";
  content: string;
  stage: string;
  createdAt: string;
}

interface ExamImage {
  url: string;
  caption?: string;
  captionAr?: string;
  maneuver?: string;
  mediaType?: 'image' | 'video' | 'audio';
}

interface VitalSigns {
  bp?: { value: string; note: string };
  hr?: { value: string; note: string };
  temp?: { value: string; note: string };
  spo2?: { value: string; note: string };
}

interface Session {
  id: string;
  currentStage: string;
  activeManeuver: string | null;
  completedManeuvers: string;
  resolvedStationConfig?: string;
  language: string;
  startedAt: string;
  case: {
    titleEn: string;
    titleAr: string;
    patientName: string;
    patientAge: number;
    patientGender: string;
    patientNationality: string;
    vitalSigns: string;
    physicalExam: string;
    labResults: string;
    examImages: string;
    isFreeTier?: boolean;
    stationConfig?: string;
  };
  messages: Message[];
  result?: Record<string, unknown> | null;
  status?: string;
}

const STAGE_ICONS = {
  history: MessageSquare,
  examination: Search,
  investigations: FlaskConical,
  diagnosis: ClipboardList,
  feedback: Lightbulb,
} as const;

const EXAM_MANEUVERS = [
  { id: "inspection", nameEn: "Inspection" },
  { id: "palpation", nameEn: "Palpation" },
  { id: "percussion", nameEn: "Percussion" },
  { id: "auscultation", nameEn: "Auscultation" },
] as const;

const DEFAULT_MANEUVER_IMAGES: Record<string, string> = {
  inspection: chestInspectionImg,
  palpation: chestPalpationImg,
  percussion: chestPercussionImg,
  auscultation: chestAuscultationImg,
};

type ExamManeuverMeta = {
  id: (typeof EXAM_MANEUVERS)[number]["id"];
  nameEn: string;
};

const STATION_SECONDS = 20 * 60;

function resolveExamImageUrl(maneuverId: string, url: string): string {
  if (url.startsWith('/exam/cases/')) return url;
  if (/\.(png|jpe?g|webp|gif|mp4|webm|mpeg|mp3|ogg|wav)(\?|#|$)/i.test(url)) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return DEFAULT_MANEUVER_IMAGES[maneuverId] || url;
}

const EXAM_MANEUVER_KEYS = ['inspection', 'palpation', 'percussion', 'auscultation'] as const;

/** Parse a case's physicalExam JSON into per-maneuver model-answer findings. */
function parseStructuredFindings(raw?: string): Record<string, string> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const key of EXAM_MANEUVER_KEYS) {
        const value = (parsed as Record<string, unknown>)[key];
        if (typeof value === 'string' && value.trim()) out[key] = value.trim();
      }
      return out;
    }
  } catch {
    // Not JSON — treat the whole text as generic inspection findings.
  }
  return { inspection: raw.trim() };
}

function inferMediaType(item: ExamImage): 'image' | 'video' | 'audio' {
  if (item.mediaType) return item.mediaType;
  const lower = item.url.toLowerCase();
  if (/\.(mp4|webm)(\?|#|$)/.test(lower)) return 'video';
  if (/\.(mpeg|mp3|ogg|wav)(\?|#|$)/.test(lower)) return 'audio';
  return 'image';
}

const maneuverStage = (id: string) => `examination:${id}`;
const HISTORY_EXAMINER_STAGE = "history:examiner";

function getNextManeuver(
  completed: string[],
  maneuvers: readonly { id: string }[] = EXAM_MANEUVERS,
): string | null {
  const next = maneuvers.find((m) => !completed.includes(m.id));
  return next?.id ?? null;
}

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function ChatTypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex justify-start">
      <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
          {label}
        </p>
      </div>
    </div>
  );
}

export default function SimulationPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language.startsWith("ar");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [activeStage, setActiveStage] = useState("history");
  const [activeManeuver, setActiveManeuver] = useState<string | null>(null);
  const [completedManeuvers, setCompletedManeuvers] = useState<string[]>([]);
  // Maneuver just finished and awaiting the student to review the model answer
  // before proceeding to the next step.
  const [solvedManeuver, setSolvedManeuver] = useState<string | null>(null);
  const [showExaminerPanel, setShowExaminerPanel] = useState(false);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<"AUTO" | "AR" | "EN">("AR");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [realtimeFallback, setRealtimeFallback] = useState(false);
  const [voiceProvider, setVoiceProvider] = useState<'openai_realtime' | 'openrouter_audio'>('openai_realtime');
  const [secondsLeft, setSecondsLeft] = useState(STATION_SECONDS);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [rankProgress, setRankProgress] = useState<RankSnapshot | null>(null);
  const [promotionModal, setPromotionModal] = useState<RankSnapshot | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [vivaActive, setVivaActive] = useState(false);
  const [micError, setMicError] = useState('');
  const [exitPrompt, setExitPrompt] = useState<'navigation' | 'refresh' | null>(null);
  const [exiting, setExiting] = useState(false);
  const autoCompleteTriggeredRef = useRef(false);
  const refreshPromptCheckedRef = useRef(false);
  /** When false, mic interim/complete must not refill the chat input (e.g. after Send). */
  const acceptMicInputRef = useRef(true);
  const forceReleaseMicRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});

  const sessionLocked = !!result || completing || secondsLeft <= 0;

  const stationConfig = useMemo(
    () => getSessionStationConfig(session ?? { case: { stationConfig: '{}' } }),
    [session],
  );
  const visibleStages = useMemo(
    () => getSimulationStages(stationConfig),
    [stationConfig],
  );
  const caseManeuvers = useMemo(
    () =>
      EXAM_MANEUVERS.filter((m) => stationConfig.enabledManeuvers.includes(m.id)).map((m) => ({
        ...m,
        nameEn: resolveManeuverLabel(m.id, stationConfig, 'en'),
      })),
    [stationConfig],
  );
  const enableHistoryExaminer = stationConfig.enableHistoryExaminer;

  const voiceCallContext =
    activeStage === 'history' && !showExaminerPanel
      ? 'patient'
      : activeStage === 'history' && showExaminerPanel && enableHistoryExaminer
        ? 'examiner'
        : activeStage === 'examination' || activeStage === 'diagnosis'
          ? 'examiner'
          : null;

  // Always honor the speech-language toggle for mic + live call STT.
  // Previously patient context hardcoded ar-EG/AR, so EN speech was transcribed as Arabic letters.
  const listenLang =
    lang === 'EN'
      ? 'en-US'
      : lang === 'AR'
        ? 'ar-EG'
        : // AUTO: patient stages prefer Arabic; examiner / examination prefer English
          voiceCallContext === 'examiner' ||
            activeStage === 'examination' ||
            activeStage === 'diagnosis' ||
            (activeStage === 'history' && showExaminerPanel)
            ? 'en-US'
            : 'ar-EG';
  const speakLang = listenLang;

  const sendMessage = useCallback(
    async (overrideText?: string): Promise<{ success: boolean; reply?: string }> => {
      const text = (overrideText ?? input).trim();
      if (!text || sending || sessionLocked) return { success: false };
      // Stop mic and ignore late transcripts so voice text cannot reappear after Send.
      acceptMicInputRef.current = false;
      forceReleaseMicRef.current();
      stopListeningRef.current();
      setSending(true);
      setChatError("");
      setInput("");

      const isExamViva = activeStage === "examination" && activeManeuver;
      const endpoint =
        isExamViva || activeStage === "diagnosis" || (showExaminerPanel && enableHistoryExaminer)
          ? "examiner"
          : "chat";
      const stage = isExamViva
        ? maneuverStage(activeManeuver!)
        : activeStage === "history" && showExaminerPanel && enableHistoryExaminer
          ? HISTORY_EXAMINER_STAGE
          : activeStage;

      const studentMsg: Message = {
        id: `tmp-${Date.now()}`,
        role: "STUDENT",
        content: text,
        stage,
        createdAt: new Date().toISOString(),
      };
      setSession((prev) =>
        prev ? { ...prev, messages: [...prev.messages, studentMsg] } : prev,
      );

      try {
        const res = await api.post(`/sessions/${sessionId}/${endpoint}`, {
          message: text,
          stage,
          ...(isExamViva ? { maneuverId: activeManeuver } : {}),
        });
        setSession((prev) => {
          if (!prev) return prev;
          const base = prev.messages.filter((m) => m.id !== studentMsg.id);
          const next = [...base, studentMsg];
          if (!next.some((m) => m.id === res.data.message.id)) {
            next.push(res.data.message);
          }
          return { ...prev, messages: next };
        });
        // The server derives this only from student turns in the active maneuver.
        // Do not render the solved card or model findings until it confirms completion.
        if (isExamViva && res.data.maneuverCompletion?.complete) {
          const completionRes = await api.post(`/sessions/${sessionId}/maneuver/complete`, {
            maneuverId: activeManeuver,
          });
          setCompletedManeuvers(completionRes.data.completedManeuvers as string[]);
          setVivaActive(false);
          setSolvedManeuver(activeManeuver);
        }
        return {
          success: true,
          reply:
            res.data.message.role === 'PATIENT' || res.data.message.role === 'EXAMINER'
              ? res.data.message.content
              : undefined,
        };
      } catch (err) {
        setSession((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.filter((m) => m.id !== studentMsg.id),
              }
            : prev,
        );
        if (!overrideText) setInput(text);
        if (!axios.isAxiosError(err) || !err.response) {
          setChatError(t("chatErrorOffline"));
        } else {
          setChatError(String(err.response.data?.error || t("chatError")));
        }
        return { success: false };
      } finally {
        setSending(false);
      }
    },
    [
      input,
      sending,
      activeStage,
      activeManeuver,
      showExaminerPanel,
      sessionId,
      t,
      sessionLocked,
      enableHistoryExaminer,
    ],
  );

  const getVoiceTurnMeta = useCallback(() => {
    const isExamViva = activeStage === 'examination' && activeManeuver;
    const endpoint =
      isExamViva || activeStage === 'diagnosis' || (showExaminerPanel && enableHistoryExaminer)
        ? 'examiner'
        : 'chat';
    const stage = isExamViva
      ? maneuverStage(activeManeuver!)
      : activeStage === 'history' && showExaminerPanel && enableHistoryExaminer
        ? HISTORY_EXAMINER_STAGE
        : activeStage;
    return {
      endpoint: endpoint as 'chat' | 'examiner',
      stage,
      maneuverId: isExamViva ? activeManeuver! : undefined,
    };
  }, [activeStage, activeManeuver, showExaminerPanel, enableHistoryExaminer]);

  // Mic + live-call STT must follow the same language the student selected (AUTO / AR / EN).
  const micSpeechLang = listenLang;
  const micSessionLang = lang;

  const { isListening, isProcessing, isSupported: isMicSupported, toggleListening, stopListening, forceReleaseMic } = useSpeechInput({
    lang: micSpeechLang,
    sessionLang: micSessionLang,
    onInterim: (text) => {
      if (!acceptMicInputRef.current) return;
      setMicError('');
      if (text.trim()) setInput(text);
    },
    onComplete: (transcript) => {
      if (!acceptMicInputRef.current) return;
      setMicError('');
      setInput(transcript.trim());
    },
    onError: (code) => {
      if (acceptMicInputRef.current) setInput('');
      if (code === 'not-supported') setMicError(t('micNotSupported'));
      else if (code === 'not-allowed') setMicError(t('micPermissionDenied'));
      else if (code === 'no-speech') setMicError(t('micNoSpeech'));
      else if (code === 'micArabicFailed') setMicError(t('micArabicFailed'));
      else if (code === 'network') setMicError(t('micNetworkError'));
      else if (code === 'audio-capture') setMicError(t('micCaptureError'));
      else if (code === 'start-failed') setMicError(t('micStartFailed'));
      else if (code === 'stt-provider-unavailable') setMicError(t('voiceRecognitionUnavailable'));
      else if (code === 'unintelligible-audio') setMicError(t('micTranscriptionFailed'));
      else if (code === 'transcription-failed') setMicError(t('micTranscriptionFailed'));
      else if (code === 'transcription-unavailable') setMicError(t('micTranscriptionUnavailable'));
      else setMicError(t('micError'));
    },
  });

  forceReleaseMicRef.current = forceReleaseMic;
  stopListeningRef.current = stopListening;

  const appendVoiceTurnMessages = useCallback((result: VoiceTurnResponse) => {
    setMicError('');
    setSession((prev) => {
      if (!prev) return prev;
      const studentMsg: Message = {
        ...result.studentMessage,
        role: result.studentMessage.role as Message['role'],
      };
      const replyMsg: Message = {
        ...result.replyMessage,
        role: result.replyMessage.role as Message['role'],
      };
      return {
        ...prev,
        messages: [...prev.messages, studentMsg, replyMsg],
      };
    });
  }, []);

  const handleLiveCallError = useCallback(
    (code: string) => {
      if (code === 'not-supported') setMicError(t('liveCallNotSupported'));
      else if (code === 'not-allowed') setMicError(t('micPermissionDenied'));
      else if (code === 'no-speech') setMicError('');
      else if (code === 'network') setMicError(t('voiceRecognitionUnavailable'));
      else if (code === 'audio-capture') setMicError(t('micCaptureError'));
      else if (code === 'start-failed') setMicError(t('micStartFailed'));
      else if (code === 'stt-provider-unavailable') setMicError(t('voiceRecognitionUnavailable'));
      else if (code === 'unintelligible-audio') setMicError(t('micTranscriptionFailed'));
      else if (code === 'transcription-failed') setMicError(t('micTranscriptionFailed'));
      else if (code === 'transcription-unavailable') setMicError(t('micTranscriptionUnavailable'));
      else if (code === 'transcription-auth-failed') setMicError(t('micTranscriptionAuthFailed'));
      else if (code === 'transcription-quota-exceeded') setMicError(t('micTranscriptionQuotaExceeded'));
      else if (code === 'tts-failed') setMicError(t('ttsPlaybackFailed'));
      else setMicError(t('micError'));
    },
    [t],
  );

  const patientLiveCall = useLiveVoiceCall({
    listenLang,
    speakLang,
    sessionLang: micSessionLang,
    sendMessage,
    speakReplies: false,
    disabled: voiceCallContext !== 'patient' || sessionLocked,
    onError: handleLiveCallError,
  });

  const examinerLiveCall = useLiveVoiceCall({
    listenLang,
    speakLang,
    sessionLang: micSessionLang,
    sendMessage,
    speakReplies: false,
    disabled: voiceCallContext !== 'examiner' || sessionLocked,
    onError: handleLiveCallError,
  });

  const isPatientLiveCall = voiceCallContext === 'patient';
  const activeLiveCall = isPatientLiveCall ? patientLiveCall : examinerLiveCall;

  useEffect(() => {
    if (!voiceCallContext) {
      patientLiveCall.stopCall();
      examinerLiveCall.stopCall();
      stopListening();
    }
  }, [voiceCallContext, patientLiveCall.stopCall, examinerLiveCall.stopCall, stopListening]);

  useEffect(() => {
    // Language toggle must never leave STT running or auto-accept phantom results.
    acceptMicInputRef.current = false;
    setInput('');
    setMicError('');
    if (patientLiveCall.isLiveCall) patientLiveCall.stopCall();
    if (examinerLiveCall.isLiveCall) examinerLiveCall.stopCall();
    stopListening();
    forceReleaseMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenLang]);

  const toggleMic = useCallback(() => {
    setMicError('');
    patientLiveCall.stopCall();
    examinerLiveCall.stopCall();
    stopSpeaking();
    void unlockMobileAudio();
    // Starting a new recording may refill the input; allow mic text again.
    if (!isListening && !isProcessing) {
      acceptMicInputRef.current = true;
      forceReleaseMic();
    }
    toggleListening();
  }, [
    examinerLiveCall,
    forceReleaseMic,
    isListening,
    isProcessing,
    patientLiveCall,
    toggleListening,
  ]);

  const toggleLiveCall = useCallback(() => {
    setMicError('');
    if (activeLiveCall.isLiveCall) {
      activeLiveCall.stopCall();
      return;
    }
    forceReleaseMic();
    stopListening();
    patientLiveCall.stopCall();
    examinerLiveCall.stopCall();
    setInput('');
    window.setTimeout(() => activeLiveCall.toggleLiveCall(), IS_MOBILE ? 400 : 200);
  }, [
    activeLiveCall,
    examinerLiveCall,
    forceReleaseMic,
    patientLiveCall,
    stopListening,
  ]);

  const liveCallInputProps = {
    isLiveCall: activeLiveCall.isLiveCall,
    isLiveCallBusy: activeLiveCall.isBusy,
    isLiveCallMicListening: activeLiveCall.isMicListening,
    isLiveCallSpeaking: activeLiveCall.isSpeaking,
    isLiveCallSupported: activeLiveCall.isSupported,
    onToggleLiveCall: voiceCallContext ? toggleLiveCall : undefined,
    liveCallLabel: isPatientLiveCall && voiceProvider === 'openrouter_audio'
      ? 'Experimental OpenRouter audio'
      : t('liveCall'),
    endLiveCallLabel: t('endLiveCall'),
  };

  const loadSession = useCallback(async () => {
    try {
      const res = await api.get(`/sessions/${sessionId}`);
      const s = res.data.session as Session;
      setSession(s);
      const sessionLang = (s.language || 'AUTO').toUpperCase();
      if (sessionLang === 'AR' || sessionLang === 'EN' || sessionLang === 'AUTO') {
        setLang(sessionLang);
      }
      setActiveManeuver(s.activeManeuver);
      setCompletedManeuvers(parseJsonArray(s.completedManeuvers, []));
      if (s.result) {
        setResult(s.result);
        setRankProgress(parseRankSnapshot(s.result.xpRankSnapshot));
        setActiveStage("feedback");
      } else {
        setActiveStage(s.currentStage || "history");
      }
    } catch (err) {
      // Session not found or access denied — redirect to dashboard
      if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 403)) {
        navigate('/student', { replace: true });
      }
    }
  }, [sessionId, navigate]);

  const updateSpeechLanguage = useCallback(
    async (next: "AUTO" | "AR" | "EN") => {
      setLang(next);
      if (!sessionId) return;
      try {
        await api.patch(`/sessions/${sessionId}/language`, { language: next });
        setSession((prev) => (prev ? { ...prev, language: next } : prev));
      } catch {
        // Keep UI selection even if persist fails — STT still uses local lang.
      }
    },
    [sessionId],
  );

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const initExaminerViva = useCallback(async () => {
    if (!sessionId) return;
    setSending(true);
    setChatError("");
    try {
      const res = await api.post(`/sessions/${sessionId}/examiner-viva/init`);
      setSession((prev) => {
        if (!prev) return prev;
        if (prev.messages.some((m) => m.id === res.data.message.id)) return prev;
        return { ...prev, messages: [...prev.messages, res.data.message] };
      });
    } catch {
      setChatError(t("completeSessionError"));
    } finally {
      setSending(false);
    }
  }, [sessionId, t]);

  useEffect(() => {
    if (!enableHistoryExaminer && showExaminerPanel) {
      setShowExaminerPanel(false);
    }
  }, [enableHistoryExaminer, showExaminerPanel]);

  useEffect(() => {
    if (!showExaminerPanel || !session || !enableHistoryExaminer) return;
    const hasOpening = session.messages.some(
      (m) => m.stage === HISTORY_EXAMINER_STAGE && m.role === "EXAMINER",
    );
    if (!hasOpening) void initExaminerViva();
  }, [showExaminerPanel, session, initExaminerViva, enableHistoryExaminer]);

  const examInProgress = !!session && !result;

  useEffect(() => {
    if (!session || result || refreshPromptCheckedRef.current) return;
    refreshPromptCheckedRef.current = true;
    if ((location.state as { fromCaseStart?: boolean } | null)?.fromCaseStart) return;
    const nav = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.type === 'reload' && session.status !== 'COMPLETED') {
      setExitPrompt('refresh');
    }
  }, [session, result, location.state]);

  useEffect(() => {
    if (!examInProgress) return;

    window.history.pushState({ synozaExamGuard: true }, "");

    const onPopState = () => {
      window.history.pushState({ synozaExamGuard: true }, "");
      setExitPrompt('navigation');
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [examInProgress]);

  const requestExit = useCallback(() => {
    if (!examInProgress) {
      navigate("/student");
      return;
    }
    setExitPrompt('navigation');
  }, [examInProgress, navigate]);

  const cancelExit = useCallback(() => {
    setExitPrompt(null);
  }, []);

  const confirmExit = useCallback(async () => {
    setExiting(true);
    patientLiveCall.stopCall();
    examinerLiveCall.stopCall();
    stopListening();
    try {
      await api.post(`/sessions/${sessionId}/abandon`);
    } catch {
      /* leave even if abandon fails */
    }
    setExiting(false);
    setExitPrompt(null);
    dispatchEntitlementsChanged();
    navigate("/student");
  }, [navigate, patientLiveCall, examinerLiveCall, sessionId, stopListening]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  let vitals: VitalSigns = {};
  let examImages: ExamImage[] = [];
  try {
    if (session) {
      vitals = JSON.parse(session.case.vitalSigns);
      examImages = parseJsonArray(session.case.examImages, []);
    }
  } catch {
    /* empty */
  }

  const startManeuver = async (maneuverId: string) => {
    if (maneuverId === activeManeuver || sessionLocked) return;
    setSending(true);
    try {
      const res = await api.post(`/sessions/${sessionId}/maneuver/start`, {
        maneuverId,
      });
      setActiveManeuver(maneuverId);
      setSolvedManeuver(null);
      setVivaActive(true);
      setActiveStage("examination");
      setSession((prev) =>
        prev
          ? {
              ...prev,
              activeManeuver: maneuverId,
              currentStage: "examination",
              messages: prev.messages.some((m) => m.id === res.data.message.id)
                ? prev.messages
                : [...prev.messages, res.data.message],
            }
          : prev,
      );
    } finally {
      setSending(false);
    }
  };

  const completeManeuver = async () => {
    if (!activeManeuver) return;
    setSending(true);
    try {
      const res = await api.post(`/sessions/${sessionId}/maneuver/complete`, {
        maneuverId: activeManeuver,
      });
      const updatedCompleted = res.data.completedManeuvers as string[];
      setCompletedManeuvers(updatedCompleted);
      setVivaActive(false);
      // Show the "maneuver solved" panel with the model answer instead of
      // advancing immediately; the student proceeds when ready.
      setSolvedManeuver(activeManeuver);
    } finally {
      setSending(false);
    }
  };

  const proceedAfterSolved = async () => {
    const solvedId = solvedManeuver ?? activeManeuver;
    if (!solvedId) return;
    setSolvedManeuver(null);
    const currentIndex = caseManeuvers.findIndex((m) => m.id === solvedId);
    const next = caseManeuvers[currentIndex + 1];
    if (next) {
      await startManeuver(next.id);
    } else {
      setActiveManeuver(null);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              activeManeuver: null,
              completedManeuvers: JSON.stringify(completedManeuvers),
            }
          : prev,
      );
      changeStage(getNextMainStageAfter('examination', stationConfig));
    }
  };

  const changeStage = (stage: string) => {
    if (sessionLocked && stage !== "feedback") return;
    setActiveStage(stage);
    api.patch(`/sessions/${sessionId}/stage`, { stage });
    if (stage === "feedback" && session?.result) {
      setResult(session.result);
    }
    if (stage === "examination" && !activeManeuver) {
      const next = getNextManeuver(completedManeuvers, caseManeuvers);
      if (next) startManeuver(next);
    }
  };

  useEffect(() => {
    if (!session || result || activeStage !== "examination" || activeManeuver || sending) return;
    if (completedManeuvers.length >= caseManeuvers.length) return;
    const next = getNextManeuver(completedManeuvers, caseManeuvers);
    if (next) void startManeuver(next);
  }, [session, result, activeStage, activeManeuver, completedManeuvers, sending, caseManeuvers]);

  useEffect(() => {
    if (!sessionLocked) return;
    patientLiveCall.stopCall();
    examinerLiveCall.stopCall();
    stopListening();
  }, [sessionLocked, patientLiveCall, examinerLiveCall, stopListening]);

  const completeSession = useCallback(async (options?: { timedOut?: boolean }) => {
    setCompleting(true);
    setCompleteError("");
    const evaluationLanguage = 'EN';
    try {
      const res = await api.post(`/sessions/${sessionId}/complete`, {
        language: evaluationLanguage,
        ...(options?.timedOut ? { timedOut: true } : {}),
      });
      setResult(res.data.result);
      const progress = parseRankSnapshot(res.data.rankProgress ?? res.data.result?.xpRankSnapshot);
      setRankProgress(progress);
      if (progress?.promoted) setPromotionModal(progress);
      dispatchEntitlementsChanged();
      setSession((prev) =>
        prev ? { ...prev, result: res.data.result, status: "COMPLETED" } : prev,
      );
      setActiveStage("feedback");
    } catch (err) {
      autoCompleteTriggeredRef.current = false;
      if (!axios.isAxiosError(err) || !err.response) {
        setCompleteError(t("chatErrorOffline"));
      } else {
        setCompleteError(String(err.response.data?.error || t("completeSessionError")));
      }
    } finally {
      setCompleting(false);
    }
  }, [sessionId, t]);

  const triggerTimeUpComplete = useCallback(() => {
    if (autoCompleteTriggeredRef.current) return;
    autoCompleteTriggeredRef.current = true;
    void completeSession({ timedOut: true });
  }, [completeSession]);

  useEffect(() => {
    if (!session?.startedAt || result) return;
    const startedAtMs = new Date(session.startedAt).getTime();
    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
      const remaining = Math.max(0, STATION_SECONDS - elapsed);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        triggerTimeUpComplete();
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [session?.startedAt, result, triggerTimeUpComplete]);

  useEffect(() => {
    if (!session || result || completing) return;
    if (secondsLeft > 0) return;
    triggerTimeUpComplete();
  }, [session, result, completing, secondsLeft, triggerTimeUpComplete]);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const historyPatientMessages = session.messages.filter(
    (m) =>
      m.stage === "history" && (m.role === "STUDENT" || m.role === "PATIENT"),
  );

  const historyExaminerMessages = session.messages.filter(
    (m) =>
      m.stage === HISTORY_EXAMINER_STAGE &&
      (m.role === "STUDENT" || m.role === "EXAMINER"),
  );

  const activeHistoryMessages = showExaminerPanel && enableHistoryExaminer
    ? historyExaminerMessages
    : historyPatientMessages;

  const examinerVivaComplete = historyExaminerMessages.some(
    (m) => m.role === "EXAMINER" && isVivaClosingMessage(m.content),
  );

  const maneuverMessages = activeManeuver
    ? session.messages.filter(
        (m) =>
          m.stage === maneuverStage(activeManeuver) &&
          (m.role === "STUDENT" || m.role === "EXAMINER"),
      )
    : [];

  const diagnosisMessages = session.messages.filter(
    (m) =>
      m.stage === "diagnosis" &&
      (m.role === "STUDENT" || m.role === "EXAMINER"),
  );

  const activeManeuverMeta = caseManeuvers.find(
    (m) => m.id === activeManeuver,
  );

  const feedbackResult = result ?? session.result ?? null;

  return (
    <div className="h-dvh overflow-hidden bg-slate-100 dark:bg-slate-950 flex flex-col">
      <ConfirmDialog
        open={exitPrompt !== null}
        title={exitPrompt === 'refresh' ? t("refreshExamTitle") : t("exitExamTitle")}
        message={exitPrompt === 'refresh' ? t("refreshExamMessage") : t("exitExamMessage")}
        confirmLabel={t("leaveExam")}
        cancelLabel={t("stayInExam")}
        confirming={exiting}
        variant="danger"
        onConfirm={() => void confirmExit()}
        onCancel={cancelExit}
      />
      <RankPromotionModal
        rankProgress={promotionModal}
        isAr={isAr}
        onClose={() => setPromotionModal(null)}
      />
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={requestExit}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label={t("back")}
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Synoza OSCE
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
              {isAr ? session.case.titleAr : session.case.titleEn}
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ConnectionStatus />
            {enableHistoryExaminer && (
            <button
              onClick={() => setShowExaminerPanel((v) => !v)}
              className={`hidden sm:block text-xs font-bold px-3 py-1.5 rounded border ${
                showExaminerPanel
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200"
                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
              }`}
            >
              {t("viewExaminer")}
            </button>
            )}
            <div
              className={`px-3 py-1 rounded font-mono text-sm font-bold ${secondsLeft < 120 ? "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"}`}
            >
              {formatTime(secondsLeft)}
            </div>
            <button
              onClick={requestExit}
              className="bg-red-500 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-600"
            >
              {t("quit")}
            </button>
          </div>
        </div>

        {/* Stage tabs */}
        <div className="flex gap-0 mt-2 -mb-px overflow-x-auto">
          {visibleStages.map((stage) => {
            const Icon = STAGE_ICONS[stage];
            return (
              <button
                key={stage}
                onClick={() => changeStage(stage)}
                disabled={sessionLocked && stage !== "feedback"}
                className={`flex items-center gap-1.5 px-5 py-2.5 text-sm border-b-2 whitespace-nowrap transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                  activeStage === stage
                    ? "border-primary text-primary font-semibold bg-primary/5"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                <Icon size={15} /> {t(stage)}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden md:flex flex-col shrink-0">
          {activeStage === "examination" ? (
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center gap-2 mb-1">
                <Stethoscope size={18} className="text-primary" />
                <h2 className="font-bold text-sm text-slate-800 dark:text-white">
                  {t("physicalExam")}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                {t("physicalExamDesc")}
              </p>
              <div className="space-y-2 mb-4">
                {caseManeuvers.map((m) => {
                  const active = activeManeuver === m.id;
                  const done = completedManeuvers.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      disabled={sending || active}
                      onClick={() => !sending && !active && startManeuver(m.id)}
                      className={`w-full text-left px-3 py-3 rounded-lg border text-sm transition-all ${
                        active
                          ? "border-primary bg-primary text-white shadow-md"
                          : done
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                            : "border-slate-200 dark:border-slate-700 hover:border-primary/50 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      <p className="font-semibold">
                        {m.nameEn}
                      </p>
                      <p
                        className={`text-[10px] mt-0.5 ${active ? "text-white/80" : ""}`}
                      >
                        {active
                          ? t("activeViva")
                          : done
                            ? t("completed")
                            : t("clickToStart")}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                  {t("vitalSigns")}
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["bp", "hr", "temp", "spo2"] as const).map((key) => {
                    const v = vitals[key];
                    return (
                      <div
                        key={key}
                        className="border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800"
                      >
                        <p className="text-[9px] font-bold text-slate-400 uppercase">
                          {key}
                        </p>
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                          {v?.value || "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <UserCircle size={28} className="text-slate-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">
                    {session.case.patientName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {session.case.patientAge} {isAr ? "سنة" : "yo"} ·{" "}
                    {session.case.patientGender}
                  </p>
                </div>
              </div>
              <h3 className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                {t("vitalSigns")}
              </h3>
              <div className="grid grid-cols-2 gap-1.5 mb-4">
                {(["bp", "hr", "temp", "spo2"] as const).map((key) => {
                  const v = vitals[key];
                  return (
                    <div
                      key={key}
                      className="border border-slate-200 dark:border-slate-700 rounded p-2 bg-slate-50 dark:bg-slate-800"
                    >
                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                        {key}
                      </p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {v?.value || "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 relative">
          {completeError && !result && secondsLeft <= 0 && !completing && (
            <div className="shrink-0 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 px-4 py-2 flex items-center justify-between gap-3">
              <p className="text-sm text-red-700 dark:text-red-300">{completeError}</p>
              <button
                type="button"
                onClick={() => void completeSession()}
                className="text-xs font-bold text-red-700 dark:text-red-300 underline shrink-0"
              >
                {t("completeSession")}
              </button>
            </div>
          )}
          {completing && (
            <div className="absolute inset-0 z-20 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
              <div className="card p-8 text-center max-w-sm mx-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="font-semibold text-slate-900 dark:text-white">{t("generatingFeedback")}</p>
                <p className="text-sm text-slate-500 mt-2">{t("feedbackGeneratedFromChat")}</p>
              </div>
            </div>
          )}
          {activeStage === "feedback" ? (
            feedbackResult ? (
              <div className="flex-1 overflow-y-auto p-4">
                <FeedbackView
                  result={feedbackResult}
                  rankProgress={rankProgress}
                  t={t}
                  session={session}
                  isAr={isAr}
                  onRegenerate={completeSession}
                  regenerating={completing}
                  onBackToCases={session.case.isFreeTier ? () => navigate('/student') : undefined}
                />
              </div>
            ) : (
              <FeedbackPendingView
                t={t}
                completing={completing}
                onGoToDiagnosis={() => changeStage("diagnosis")}
                onGenerate={() => void completeSession()}
              />
            )
          ) : activeStage === "examination" ? (
            <>
              <ExaminationStepsBar
                isAr={isAr}
                t={t}
                activeManeuver={activeManeuver}
                completedManeuvers={completedManeuvers}
                onStartManeuver={startManeuver}
                sending={sending}
                caseManeuvers={caseManeuvers}
              />
              <ExaminationView
                session={session}
                isAr={isAr}
                t={t}
                activeManeuver={activeManeuver}
                activeManeuverMeta={activeManeuverMeta}
                vivaActive={vivaActive}
                examImages={examImages}
                messages={maneuverMessages}
                input={input}
                setInput={setInput}
                sendMessage={sendMessage}
                sending={sending}
                chatError={chatError}
                completeManeuver={completeManeuver}
                solved={solvedManeuver === activeManeuver}
                onProceed={proceedAfterSolved}
                chatEndRef={chatEndRef}
                lang={lang}
                setLang={updateSpeechLanguage}
                isListening={isListening}
                isProcessing={isProcessing}
                isMicSupported={isMicSupported}
                onToggleMic={toggleMic}
                micError={micError}
                completedManeuvers={completedManeuvers}
                onStartManeuver={startManeuver}
                caseManeuvers={caseManeuvers}
                sessionLocked={sessionLocked}
                {...liveCallInputProps}
              />
            </>
          ) : activeStage === "investigations" ? (
            <InvestigationsView
              t={t}
              isAr={isAr}
              labResults={session.case.labResults}
            />
          ) : activeStage === "diagnosis" ? (
            <DiagnosisView
              t={t}
              sendMessage={sendMessage}
              sending={sending}
              chatError={chatError}
              completeSession={completeSession}
              completing={completing}
              completeError={completeError}
              sessionLocked={sessionLocked}
            />
          ) : (
            <HistoryChatView
              t={t}
              session={session}
              messages={activeHistoryMessages}
              input={input}
              setInput={setInput}
              sendMessage={sendMessage}
              sending={sending}
              chatError={chatError}
              chatEndRef={chatEndRef}
              lang={lang}
              setLang={updateSpeechLanguage}
              showExaminerPanel={showExaminerPanel}
              setShowExaminerPanel={setShowExaminerPanel}
              enableHistoryExaminer={enableHistoryExaminer}
              examinerVivaComplete={examinerVivaComplete}
              isListening={isListening}
              isProcessing={isProcessing}
              isMicSupported={isMicSupported}
              onToggleMic={toggleMic}
              micError={micError}
              sessionLocked={sessionLocked}
              {...liveCallInputProps}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ExaminationStepsBar({
  isAr,
  t,
  activeManeuver,
  completedManeuvers,
  onStartManeuver,
  sending,
  caseManeuvers,
}: {
  isAr: boolean;
  t: (k: string, opts?: Record<string, unknown>) => string;
  activeManeuver: string | null;
  completedManeuvers: string[];
  onStartManeuver: (id: string) => void;
  sending: boolean;
  caseManeuvers: readonly ExamManeuverMeta[];
}) {
  return (
    <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 py-2 shrink-0">
      <div className="flex gap-2 overflow-x-auto">
        {caseManeuvers.map((m) => {
          const active = activeManeuver === m.id;
          const done = completedManeuvers.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              disabled={sending || active}
              onClick={() => !sending && !active && onStartManeuver(m.id)}
              className={`shrink-0 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                active
                  ? "border-primary bg-primary text-white"
                  : done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-primary/50"
              }`}
            >
              {m.nameEn}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExaminationView({
  session,
  isAr,
  t,
  activeManeuver,
  activeManeuverMeta,
  vivaActive,
  examImages,
  messages,
  input,
  setInput,
  sendMessage,
  sending,
  chatError,
  completeManeuver,
  solved = false,
  onProceed,
  chatEndRef,
  lang,
  setLang,
  isListening,
  isProcessing,
  isMicSupported,
  onToggleMic,
  micError,
  completedManeuvers,
  onStartManeuver,
  caseManeuvers,
  isLiveCall,
  isLiveCallBusy,
  isLiveCallMicListening,
  isLiveCallSpeaking,
  isLiveCallSupported,
  onToggleLiveCall,
  liveCallLabel,
  endLiveCallLabel,
  sessionLocked = false,
}: {
  session: Session;
  isAr: boolean;
  t: (k: string, opts?: Record<string, unknown>) => string;
  activeManeuver: string | null;
  activeManeuverMeta?: ExamManeuverMeta;
  vivaActive: boolean;
  examImages: ExamImage[];
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text?: string) => Promise<{ success: boolean; reply?: string }>;
  sending: boolean;
  chatError: string;
  completeManeuver: () => void;
  solved?: boolean;
  onProceed?: () => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  lang: "AUTO" | "AR" | "EN";
  setLang: (l: "AUTO" | "AR" | "EN") => void;
  isListening: boolean;
  isProcessing: boolean;
  isMicSupported: boolean;
  onToggleMic: () => void;
  micError: string;
  completedManeuvers: string[];
  onStartManeuver: (id: string) => void;
  caseManeuvers: readonly ExamManeuverMeta[];
  isLiveCall?: boolean;
  isLiveCallBusy?: boolean;
  isLiveCallMicListening?: boolean;
  isLiveCallSpeaking?: boolean;
  isLiveCallSupported?: boolean;
  onToggleLiveCall?: () => void;
  liveCallLabel?: string;
  endLiveCallLabel?: string;
  sessionLocked?: boolean;
}) {
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const structuredFindings = parseStructuredFindings(session.case.physicalExam);
  const maneuverModelAnswer = activeManeuver ? structuredFindings[activeManeuver] ?? '' : '';
  const consolidatedFindings = caseManeuvers
    .filter((m) => completedManeuvers.includes(m.id) && (structuredFindings[m.id] ?? '').trim())
    .map((m) => ({ id: m.id, name: m.nameEn, findings: structuredFindings[m.id] }));

  if (!activeManeuver || !activeManeuverMeta) {
    const nextId = getNextManeuver(completedManeuvers, caseManeuvers);
    const nextMeta = caseManeuvers.find((m) => m.id === nextId);
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-500">
        <div className="max-w-sm">
          {sending ? (
            <>
              <Loader2 size={40} className="mx-auto mb-3 animate-spin text-primary" />
              <p className="font-medium">{t("paymentProcessing")}</p>
            </>
          ) : nextMeta ? (
            <>
              <Eye size={48} className="mx-auto mb-3 text-slate-300" />
              <p className="font-medium">{t("continueToStep", { step: nextMeta.nameEn })}</p>
              <button
                type="button"
                onClick={() => onStartManeuver(nextMeta.id)}
                className="btn-primary mt-4 px-6 py-2.5 inline-flex items-center gap-2"
              >
                {nextMeta.nameEn}
                <ChevronRight size={16} />
              </button>
            </>
          ) : (
            <>
              <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-500" />
              <p className="font-medium">{t("examinationComplete")}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const stationImages = examImages.filter(
    (img) => !img.maneuver || img.maneuver === activeManeuver,
  );
  const fallbackUrl =
    DEFAULT_MANEUVER_IMAGES[activeManeuver] || DEFAULT_MANEUVER_IMAGES.inspection;
  const displayImages =
    stationImages.length > 0
      ? stationImages.map((img) => ({
          ...img,
          url: resolveExamImageUrl(activeManeuver, img.url),
        }))
      : [
          {
            url: fallbackUrl,
            caption: activeManeuverMeta.nameEn,
          },
        ];

  const currentMedia = displayImages[Math.min(activeMediaIndex, displayImages.length - 1)] || displayImages[0];
  const mediaType = inferMediaType(currentMedia);

  // Separate opening maneuver instruction from active chat turns
  const isOpeningInstruction = (content: string) =>
    /I am evaluating your clinical|Describe your findings systematically|Look at the patient and images carefully|evaluating your clinical/i.test(
      content,
    );

  const initialInstructionMsg = messages.find(
    (m) => m.role === 'EXAMINER' && isOpeningInstruction(m.content),
  );

  const activeChatMessages = initialInstructionMsg
    ? messages.filter((m) => m !== initialInstructionMsg)
    : messages;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-100/70 dark:bg-slate-950 p-3 sm:p-5">
      <div className="w-full max-w-3xl mx-auto space-y-4">

        {/* Card 2: Media Player Box */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between text-xs font-bold px-1">
            <span className="text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              {activeManeuverMeta.nameEn}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {mediaType.toUpperCase()} {activeMediaIndex + 1} OF {displayImages.length}
              </span>
              {displayImages.length > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveMediaIndex((i) => Math.max(0, i - 1))}
                    disabled={activeMediaIndex === 0}
                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 disabled:opacity-30"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMediaIndex((i) => Math.min(displayImages.length - 1, i + 1))}
                    disabled={activeMediaIndex === displayImages.length - 1}
                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 disabled:opacity-30"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner flex items-center justify-center min-h-[200px] max-h-[360px] sm:max-h-[420px]">
            {mediaType === 'video' ? (
              <video
                src={currentMedia.url}
                controls
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                playsInline
                className="w-full max-h-[360px] sm:max-h-[420px] object-contain mx-auto bg-black rounded-xl"
              >
                <track kind="captions" />
              </video>
            ) : mediaType === 'audio' ? (
              <div className="p-8 bg-slate-900 w-full flex flex-col items-center justify-center gap-3">
                <audio
                  src={currentMedia.url}
                  controls
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full max-w-md"
                />
              </div>
            ) : (
              <img
                src={currentMedia.url}
                alt={currentMedia.caption || activeManeuverMeta.nameEn}
                className="w-full max-h-[360px] sm:max-h-[420px] object-contain mx-auto bg-black rounded-xl"
              />
            )}
          </div>
          {currentMedia.caption && (
            <p className="text-xs text-slate-500 dark:text-slate-400 px-1 italic" dir="auto">
              {currentMedia.caption}
            </p>
          )}
        </div>

        {/* Card 2.5: Examiner Guidance Instruction (Placed OUTSIDE the interactive chat) */}
        {initialInstructionMsg && (
          <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/30 p-3.5 sm:p-4 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                <Sparkles size={14} />
              </span>
              <p className="text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                {t("clinicalExaminer")} · {activeManeuverMeta.nameEn} Guidance
              </p>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed" dir="auto">
              {initialInstructionMsg.content}
            </p>
          </div>
        )}

        {/* Card 3: Clinical Examiner Conversation Flow (Realistic Medical Chat) */}
        <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 sm:p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 font-bold text-xs">
                <Stethoscope size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                  {t("clinicalExaminer")}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Interactive Examination Chat</span>
                </div>
              </div>
            </div>
            {isLiveCall && (
              <span className="text-[10px] font-bold text-emerald-500 animate-pulse flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                LIVE CALL
              </span>
            )}
          </div>

          <div className="space-y-3 max-h-95 overflow-y-auto pr-1">
            {activeChatMessages.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 p-5 text-center border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-xs sm:text-sm font-semibold leading-relaxed text-slate-500 dark:text-slate-400" dir="auto">
                  {isAr
                    ? "ابدأ بوصف أو نطق ملاحظاتك السريرية أدناه للرد على الممتحن..."
                    : "Type or speak your clinical observations below to start the examination..."}
                </p>
              </div>
            ) : (
              activeChatMessages.map((m, idx) => {
                const isStudent = m.role === 'STUDENT';
                return (
                  <div
                    key={m.id || idx}
                    className={`flex items-end gap-2 ${isStudent ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isStudent && (
                      <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mb-1 text-[10px] font-black uppercase">
                        Ex
                      </div>
                    )}
                    <div
                      className={`max-w-[88%] sm:max-w-[82%] px-4 py-3 rounded-2xl text-sm sm:text-base font-semibold leading-relaxed shadow-xs transition-all ${
                        isStudent
                          ? 'bg-linear-to-br from-teal-700 to-teal-600 text-white rounded-br-xs'
                          : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/60 dark:border-slate-700/60'
                      }`}
                    >
                      {!isStudent && (
                        <p className="text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-1 text-start" dir="auto">
                          {t("clinicalExaminer")}
                        </p>
                      )}
                      <div className="whitespace-pre-line text-start break-words" dir="auto" style={{ unicodeBidi: 'plaintext' }}>
                        {m.content}
                      </div>
                    </div>
                    {isStudent && (
                      <div className="w-7 h-7 rounded-full bg-teal-800 text-white flex items-center justify-center shrink-0 mb-1 text-[10px] font-black uppercase">
                        Dr
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {sending && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mb-1 text-[10px] font-black uppercase">
                  Ex
                </div>
                <div className="rounded-2xl rounded-bl-xs bg-slate-100 dark:bg-slate-800/90 border border-slate-200/60 dark:border-slate-700/60 px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-xs">
                  <Loader2 size={15} className="animate-spin text-teal-600" />
                  <span>{t("examinerTyping")}</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Card 4 / Solved Action */}
        {solved ? (
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4 shadow-xs">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">
                  {t("maneuverSolvedTitle")}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("maneuverSolvedDesc")}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700/80 dark:text-emerald-400/80 mb-1">
                {t("modelAnswerLabel")}
              </p>
              <div
                className="rounded-xl bg-slate-900 text-slate-100 text-sm leading-relaxed p-3.5 whitespace-pre-line"
                dir="auto"
              >
                {maneuverModelAnswer || t("modelAnswerUnavailable")}
              </div>
            </div>

            {consolidatedFindings.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                  {t("consolidatedLogTitle")}
                </p>
                <div className="space-y-2.5">
                  {consolidatedFindings.map((row) => (
                    <div key={row.id} dir="auto">
                      <p className="text-[11px] font-bold text-teal-700 dark:text-teal-400 uppercase">
                        {row.name}
                      </p>
                      <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">
                        {row.findings}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={onProceed}
              className="w-full btn-primary py-3 inline-flex items-center justify-center gap-2 text-base font-bold shadow-md"
            >
              {t("proceedToNextStep")}
              <ChevronRight size={18} />
            </button>
          </div>
        ) : (
          /* Observation Input & Actions Box */
          <div className="space-y-3 pt-1">
            {(isLiveCall || micError) && (
              <LiveCallMicStatus
                isLiveCall={isLiveCall}
                isBusy={isLiveCallBusy}
                isMicListening={isLiveCallMicListening}
                isSpeaking={isLiveCallSpeaking}
                error={isLiveCall ? micError : undefined}
              />
            )}

            {/* Header row above text box: Left (Clinical Observation + Status), Right (Language Pills + Live Call) */}
            <div className="flex items-center justify-between px-1 gap-2 flex-wrap text-[10px] font-black tracking-wider uppercase">
              <div className="flex items-center gap-3">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-amber-500" />
                  {t("clinicalObservationInput")}
                </span>
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  {t("vivaEngineActive")}
                </span>
              </div>

              {/* Language Pills + Live call on top of text box */}
              <div className="flex items-center gap-2">
                {/* Speech language pills */}
                <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-0.5 text-[11px] font-bold shadow-xs">
                  <button
                    type="button"
                    onClick={() => setLang('AUTO')}
                    className={`px-2.5 py-0.5 rounded-full transition-all ${
                      lang === 'AUTO'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('AR')}
                    className={`px-2.5 py-0.5 rounded-full transition-all ${
                      lang === 'AR'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    عربي
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('EN')}
                    className={`px-2.5 py-0.5 rounded-full transition-all ${
                      lang === 'EN'
                        ? 'bg-teal-700 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    EN
                  </button>
                </div>

                {/* Live Call Toggle */}
                {isLiveCallSupported && (
                  <button
                    type="button"
                    onClick={onToggleLiveCall}
                    disabled={sending}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all ${
                      isLiveCall
                        ? 'bg-red-600 text-white animate-pulse'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                    }`}
                    title={isLiveCall ? endLiveCallLabel : liveCallLabel}
                  >
                    <PhoneCall size={12} />
                    <span>{isLiveCall ? 'END CALL' : 'LIVE CALL'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Full-width Input Box with Mic and Send */}
            <div className="rounded-full border-2 border-slate-700 dark:border-slate-400 bg-white dark:bg-slate-900 p-1.5 pl-4 pr-1.5 flex items-center gap-2 shadow-xs">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !sending && !sessionLocked) {
                      sendMessage();
                    }
                  }
                }}
                placeholder={t("typeClinicalObservation")}
                className="flex-1 bg-transparent border-0 text-sm focus:outline-hidden text-slate-800 dark:text-white placeholder:text-slate-400"
                disabled={sending || sessionLocked}
              />

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Mic button */}
                <button
                  type="button"
                  onClick={onToggleMic}
                  disabled={!isMicSupported || sending || sessionLocked}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-[#854d0e] hover:bg-[#713f12] text-white'
                  }`}
                  title="Voice Input"
                >
                  <Mic size={16} />
                </button>

                {/* Send button */}
                <button
                  type="button"
                  onClick={() => {
                    if (input.trim() && !sending && !sessionLocked) {
                      sendMessage();
                    }
                  }}
                  disabled={!input.trim() || sending || sessionLocked}
                  className="w-9 h-9 rounded-full bg-slate-600 hover:bg-slate-700 disabled:opacity-40 text-white flex items-center justify-center transition-all"
                  title="Send"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function HistoryChatView({
  t,
  session,
  messages,
  input,
  setInput,
  sendMessage,
  sending,
  chatError,
  chatEndRef,
  lang,
  setLang,
  showExaminerPanel,
  setShowExaminerPanel,
  enableHistoryExaminer,
  examinerVivaComplete,
  isListening,
  isProcessing,
  isMicSupported,
  onToggleMic,
  micError,
  isLiveCall,
  isLiveCallBusy,
  isLiveCallMicListening,
  isLiveCallSpeaking,
  isLiveCallSupported,
  onToggleLiveCall,
  liveCallLabel,
  endLiveCallLabel,
  sessionLocked = false,
}: {
  t: (k: string) => string;
  session: Session;
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text?: string) => Promise<{ success: boolean; reply?: string }>;
  sending: boolean;
  chatError: string;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  lang: "AUTO" | "AR" | "EN";
  setLang: (l: "AUTO" | "AR" | "EN") => void;
  showExaminerPanel: boolean;
  setShowExaminerPanel: (value: boolean) => void;
  enableHistoryExaminer: boolean;
  examinerVivaComplete: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isMicSupported: boolean;
  onToggleMic: () => void;
  micError: string;
  isLiveCall?: boolean;
  isLiveCallBusy?: boolean;
  isLiveCallMicListening?: boolean;
  isLiveCallSpeaking?: boolean;
  isLiveCallSupported?: boolean;
  onToggleLiveCall?: () => void;
  liveCallLabel?: string;
  endLiveCallLabel?: string;
  sessionLocked?: boolean;
}) {
  const isExaminerChat = showExaminerPanel && enableHistoryExaminer;

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-3 sm:p-4 min-h-0">
      <div className={`grid gap-2 sm:gap-3 mb-2 sm:mb-4 shrink-0 ${enableHistoryExaminer ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          type="button"
          disabled={sessionLocked}
          onClick={() => setShowExaminerPanel(false)}
          className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-4 rounded-xl border-2 text-left transition-all min-w-0 ${
            !showExaminerPanel || !enableHistoryExaminer
              ? "bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-600 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
        >
          <div
            className={`w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 ${
              !showExaminerPanel || !enableHistoryExaminer
                ? "bg-sky-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            }`}
          >
            <UserCircle className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p
              className={`text-[9px] sm:text-[11px] font-bold uppercase tracking-wide sm:tracking-wider leading-tight ${
                !showExaminerPanel || !enableHistoryExaminer
                  ? "text-sky-700 dark:text-sky-300"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {t("patientEncounter")}
            </p>
            <p
              className={`text-xs sm:text-sm font-semibold truncate leading-tight mt-0.5 ${
                !showExaminerPanel || !enableHistoryExaminer
                  ? "text-sky-900 dark:text-sky-100"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {session.case.patientName}
            </p>
          </div>
        </button>

        {enableHistoryExaminer && (
        <button
          type="button"
          disabled={sessionLocked}
          onClick={() => setShowExaminerPanel(true)}
          className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-4 rounded-xl border-2 text-left transition-all min-w-0 ${
            showExaminerPanel
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-600 shadow-sm"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
        >
          <div
            className={`w-8 h-8 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0 ${
              showExaminerPanel
                ? "bg-amber-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400"
            }`}
          >
            <Shield className="w-4 h-4 sm:w-[22px] sm:h-[22px]" />
          </div>
          <div className="min-w-0">
            <p
              className={`text-[9px] sm:text-[11px] font-bold uppercase tracking-wide sm:tracking-wider leading-tight ${
                showExaminerPanel
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {t("examinerBox")}
            </p>
            <p
              className={`text-xs sm:text-sm font-medium leading-tight mt-0.5 truncate ${
                showExaminerPanel
                  ? "text-amber-900 dark:text-amber-100"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              {t("vivaQuestions")}
            </p>
          </div>
        </button>
        )}
      </div>

      <div className="card flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
          <div className="px-3 py-2 sm:px-4 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase min-w-0 truncate">
              {isExaminerChat
                ? t("examinerBox")
                : `${t("interviewLog")}: ${session.case.patientName}`}
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <SpeechLanguageToggle
                value={lang}
                onChange={setLang}
                disabled={sending || isLiveCall}
                labels={{
                  auto: t('speechLangAuto'),
                  ar: t('speechLangAr'),
                  en: t('speechLangEn'),
                }}
              />
              <LiveCallButton
                isLiveCall={isLiveCall}
                isLiveCallBusy={isLiveCallBusy}
                isLiveCallSupported={isLiveCallSupported}
                onToggleLiveCall={onToggleLiveCall}
                liveCallLabel={t("liveCall")}
                endLiveCallLabel={t("endLiveCall")}
                disabled={sending}
              />
            </div>
          </div>
        </div>

        <ChatScrollArea
          endRef={chatEndRef}
          scrollDeps={[messages, sending]}
          forceScroll={sending}
          empty={messages.length === 0}
          className="bg-white dark:bg-slate-900"
          emptyContent={
            isExaminerChat ? (
              <div className="flex flex-col items-center text-slate-400 dark:text-slate-500 py-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <Shield
                    size={32}
                    className="text-slate-300 dark:text-slate-500"
                  />
                </div>
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  {t("examinerBox")}
                </p>
                <p className="text-sm mt-1 text-center max-w-sm">
                  {t("startExaminerViva")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-slate-400 dark:text-slate-500 py-8">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <UserCircle
                    size={32}
                    className="text-slate-300 dark:text-slate-500"
                  />
                </div>
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  {t("simulatedInterview")}
                </p>
                <p className="text-sm mt-1 text-center max-w-sm">
                  {t("startInterview")}
                </p>
              </div>
            )
          }
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "STUDENT" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[80%] px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl text-xs sm:text-sm leading-snug ${
                  msg.role === "STUDENT"
                    ? "bg-primary text-white rounded-br-md"
                    : msg.role === "EXAMINER"
                      ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 rounded-bl-md"
                      : "bg-teal-50 dark:bg-slate-800 border border-teal-100 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-md"
                }`}
              >
                <span dir="auto">{msg.content}</span>
              </div>
            </div>
          ))}
          {sending && (
            <ChatTypingIndicator
              label={
                isExaminerChat ? t("examinerTyping") : t("patientTyping")
              }
            />
          )}
        </ChatScrollArea>

        <div className="shrink-0 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          {(isLiveCall || micError) && (
            <LiveCallMicStatus
              isLiveCall={isLiveCall}
              isBusy={isLiveCallBusy}
              isMicListening={isLiveCallMicListening}
              isSpeaking={isLiveCallSpeaking}
              error={isLiveCall ? micError : undefined}
            />
          )}
          <SimulationChatInput
            input={input}
            setInput={setInput}
            onSend={() => sendMessage()}
            sending={sending}
            placeholder={isExaminerChat ? t("askExaminer") : t("askPatient")}
            chatError={chatError}
            isListening={isListening}
            isProcessing={isProcessing}
            isMicSupported={isMicSupported}
            onToggleMic={onToggleMic}
            micListeningLabel={t("micListening")}
            micNotSupportedLabel={t("micNotSupported")}
            micProcessingLabel={t("micProcessing")}
            micError={micError}
            disabled={sessionLocked || isLiveCall || (isExaminerChat && examinerVivaComplete)}
            isLiveCall={isLiveCall}
          />
        </div>
      </div>
    </div>
  );
}

function DiagnosisView({
  t,
  sendMessage,
  sending,
  chatError,
  completeSession,
  completing,
  completeError,
  sessionLocked = false,
}: {
  t: (k: string) => string;
  sendMessage: (text?: string) => Promise<{ success: boolean; reply?: string }>;
  sending: boolean;
  chatError: string;
  completeSession: () => void | Promise<void>;
  completing: boolean;
  completeError: string;
  sessionLocked?: boolean;
}) {
  const [impression, setImpression] = useState("");
  const [management, setManagement] = useState("");

  const buildSubmission = () => {
    const parts: string[] = [];
    if (impression.trim()) {
      parts.push(`${t("diagnosticImpression")}:\n${impression.trim()}`);
    }
    if (management.trim()) {
      parts.push(`${t("initialManagement")}:\n${management.trim()}`);
    }
    return parts.join("\n\n");
  };

  const handleCompleteAndEvaluate = async () => {
    const text = buildSubmission();
    if (text) {
      const result = await sendMessage(text);
      if (!result.success) return;
      setImpression("");
      setManagement("");
    }
    await completeSession();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 md:py-12 w-full">
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 text-primary text-[11px] font-semibold tracking-wider uppercase bg-white dark:bg-slate-900 shadow-sm">
            <Stethoscope size={14} />
            {t("diagnosticFinalizationStation")}
          </span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-center text-slate-900 dark:text-white mb-3">
          {t("clinicalFormulation")}
        </h1>
        <p className="text-center text-slate-500 dark:text-slate-400 max-w-2xl mx-auto mb-10 text-sm md:text-base leading-relaxed">
          {t("clinicalFormulationDesc")}
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="min-w-0 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-4 text-teal-600 dark:text-teal-400">
              <Search size={18} />
              <span className="text-xs font-bold tracking-wider uppercase">
                {t("diagnosticImpression")}
              </span>
            </div>
            <textarea
              className="w-full min-h-[220px] max-h-[420px] overflow-y-auto rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              placeholder={t("diagnosticImpressionPlaceholder")}
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              disabled={sending || sessionLocked}
            />
          </div>

          <div className="min-w-0 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 p-6">
            <div className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400">
              <ClipboardCheck size={18} />
              <span className="text-xs font-bold tracking-wider uppercase">
                {t("initialManagement")}
              </span>
            </div>
            <textarea
              className="w-full min-h-[220px] max-h-[420px] overflow-y-auto rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-4 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              placeholder={t("initialManagementPlaceholder")}
              value={management}
              onChange={(e) => setManagement(e.target.value)}
              disabled={sending || sessionLocked}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 mb-6">
          {(chatError || completeError) && (
            <p className="text-sm text-red-500 text-center">{chatError || completeError}</p>
          )}
          <div className="flex items-center justify-center">
            <button
              onClick={() => void handleCompleteAndEvaluate()}
              disabled={completing || sending || sessionLocked}
              className="btn-primary px-10 py-3 text-base min-w-55 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {completing || sending ? (
                <>
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {completing ? t("generatingFeedback") : t("examinerTyping")}
                </>
              ) : (
                t("completeSession")
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClinicalStationPanel({
  maneuverId,
  examImages,
  isAr,
  t,
  compact = false,
}: {
  maneuverId: string;
  examImages: ExamImage[];
  isAr: boolean;
  t: (k: string) => string;
  compact?: boolean;
}) {
  const [selectedImg, setSelectedImg] = useState<{ url: string; caption?: string; mediaType?: string } | null>(null);

  const stationImages = examImages.filter(
    (img) => !img.maneuver || img.maneuver === maneuverId,
  );
  const fallbackUrl =
    DEFAULT_MANEUVER_IMAGES[maneuverId] || DEFAULT_MANEUVER_IMAGES.inspection;
  const displayImages =
    stationImages.length > 0
      ? stationImages.map((img) => ({
          ...img,
          url: resolveExamImageUrl(maneuverId, img.url),
        }))
      : [
          {
            url: fallbackUrl,
            caption: t("clinicalStation"),
            captionAr: t("clinicalStation"),
          },
        ];

  return (
    <>
      <div
        className={`bg-white dark:bg-slate-900 ${
          compact
            ? 'p-0 space-y-1.5'
            : 'rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4'
        }`}
      >
        {!compact && (
          <p className="text-xs font-bold text-slate-500 uppercase">
            {t("patientSlideGallery")}
          </p>
        )}

        <div className={compact ? 'grid grid-cols-1 gap-2' : 'grid gap-3'}>
          {displayImages.map((img, i) => {
            const mediaType = inferMediaType(img);
            const caption = (isAr ? img.captionAr : img.caption) || img.caption || img.captionAr;
            return (
              <div
                key={`${img.url}-${i}`}
                className={`relative rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950 group cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 ${
                  compact ? 'w-full max-h-24 sm:max-h-28 flex items-center justify-center' : ''
                }`}
                onClick={() => setSelectedImg({ url: img.url, caption, mediaType })}
              >
                {mediaType === 'video' ? (
                  <video
                    src={img.url}
                    controls
                    controlsList="nodownload"
                    onContextMenu={(e) => e.preventDefault()}
                    playsInline
                    className={`w-full object-contain mx-auto bg-black ${compact ? 'max-h-24 sm:max-h-28' : 'max-h-80'}`}
                  >
                    <track kind="captions" />
                  </video>
                ) : mediaType === 'audio' ? (
                  <div className={`px-4 bg-slate-900 w-full ${compact ? 'py-2' : 'py-6'}`}>
                    <audio
                      src={img.url}
                      controls
                      controlsList="nodownload"
                      onContextMenu={(e) => e.preventDefault()}
                      className="w-full"
                    />
                  </div>
                ) : (
                  <img
                    src={img.url}
                    alt={caption || t("clinicalStation")}
                    className={`w-full object-contain mx-auto ${compact ? 'max-h-24 sm:max-h-28' : 'max-h-80'}`}
                  />
                )}
                {caption && (
                  <div
                    className={`w-full bg-slate-950/80 backdrop-blur-sm text-slate-100 font-medium leading-tight ${
                      compact
                        ? 'absolute bottom-0 inset-x-0 px-2 py-0.5 text-[10px] truncate'
                        : 'px-3 py-1.5 text-xs bg-slate-900/90'
                    }`}
                    dir="auto"
                  >
                    {caption}
                  </div>
                )}
                {/* Zoom badge */}
                <div className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/60 text-white/80 opacity-70 group-hover:opacity-100 transition-opacity">
                  <Maximize2 size={12} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lightbox / Zoom Modal */}
      {selectedImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setSelectedImg(null)}
        >
          <button
            type="button"
            onClick={() => setSelectedImg(null)}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white transition-colors"
            title="Close"
          >
            <X size={20} />
          </button>
          <div
            className="max-w-3xl max-h-[85vh] flex flex-col items-center justify-center overflow-hidden rounded-xl bg-slate-950 border border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedImg.mediaType === 'video' ? (
              <video
                src={selectedImg.url}
                controls
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                autoPlay
                playsInline
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
            ) : selectedImg.mediaType === 'audio' ? (
              <div className="p-8 w-full min-w-70">
                <audio
                  src={selectedImg.url}
                  controls
                  controlsList="nodownload"
                  onContextMenu={(e) => e.preventDefault()}
                  autoPlay
                  className="w-full"
                />
              </div>
            ) : (
              <img
                src={selectedImg.url}
                alt={selectedImg.caption || t("clinicalStation")}
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
            )}
            {selectedImg.caption && (
              <div className="w-full p-3 bg-slate-900 text-slate-200 text-center text-sm font-medium" dir="auto">
                {selectedImg.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

interface LabSection {
  id: string;
  title: string;
  titleAr?: string;
  content: string;
  contentAr?: string;
}

const EXTRA_INVESTIGATION_OPTIONS: Array<{
  id: string;
  title: string;
  titleAr: string;
  match: RegExp;
}> = [
  {
    id: 'cbc',
    title: 'CBC / Full blood count',
    titleAr: 'صورة دم كاملة',
    match: /cbc|full blood|blood count|صورة دم/i,
  },
  {
    id: 'renal',
    title: 'U&E / Renal profile',
    titleAr: 'وظائف كلى وأملاح',
    match: /renal|u&e|electrolyte|كلى/i,
  },
  {
    id: 'lft',
    title: 'Liver function tests',
    titleAr: 'وظائف كبد',
    match: /liver|lft|كبد/i,
  },
  {
    id: 'bnp',
    title: 'BNP / NT-proBNP',
    titleAr: 'BNP / NT-proBNP',
    match: /bnp|nt-probnp/i,
  },
  {
    id: 'tft',
    title: 'Thyroid function tests',
    titleAr: 'وظائف الغدة الدرقية',
    match: /thyroid|tft|درقية/i,
  },
  {
    id: 'ddimer',
    title: 'D-dimer',
    titleAr: 'D-dimer',
    match: /d-dimer|ddimer/i,
  },
];

function slugInvestigationId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseInvestigationSections(labResults: string): LabSection[] {
  try {
    const parsed = JSON.parse(labResults);
    if (Array.isArray(parsed.sections)) {
      return parsed.sections.map((section: LabSection, index: number) => ({
        ...section,
        id: section.id || `case-${index}-${slugInvestigationId(section.title)}`,
      }));
    }
  } catch {
    /* plain text fallback */
  }
  if (labResults.trim()) {
    return [
      {
        id: 'case-default',
        title: 'Investigations',
        content: labResults,
      },
    ];
  }
  return [];
}

function buildInvestigationCatalog(caseSections: LabSection[]): LabSection[] {
  const catalog: LabSection[] = caseSections.map((section) => ({ ...section }));
  const usedIds = new Set(catalog.map((s) => s.id));

  for (const extra of EXTRA_INVESTIGATION_OPTIONS) {
    const alreadyCovered = caseSections.some(
      (section) => extra.match.test(section.title) || extra.match.test(section.titleAr || ''),
    );
    if (alreadyCovered || usedIds.has(extra.id)) continue;
    catalog.push({
      id: extra.id,
      title: extra.title,
      titleAr: extra.titleAr,
      content: '',
      contentAr: '',
    });
    usedIds.add(extra.id);
  }

  return catalog;
}

function InvestigationsView({
  t,
  isAr,
  labResults,
}: {
  t: (k: string) => string;
  isAr: boolean;
  labResults: string;
}) {
  const caseSections = parseInvestigationSections(labResults);
  const catalog = buildInvestigationCatalog(caseSections);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleInvestigation = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedSections = catalog.filter((section) => selectedIds.has(section.id));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
      <div className="flex flex-col lg:flex-row lg:h-full gap-4 p-4 min-h-0 lg:overflow-hidden">
      <div className="lg:w-[38%] xl:w-[34%] shrink-0 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm lg:overflow-hidden lg:min-h-0">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center">
              <FlaskConical size={18} className="text-teal-600 dark:text-teal-400" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              {t('investigationsCatalogTitle')}
            </h3>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            {t('investigationsCatalogDesc')}
          </p>
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto lg:overscroll-y-contain p-4 space-y-2.5 pb-6">
          {catalog.map((section) => {
            const active = selectedIds.has(section.id);
            const label = isAr ? section.titleAr || section.title : section.title;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => toggleInvestigation(section.id)}
                className={`w-full text-start px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all ${
                  active
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-100 shadow-sm ring-1 ring-teal-200 dark:ring-teal-800'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span dir="auto">{label}</span>
                  {active && <CheckCircle2 size={16} className="shrink-0 text-teal-600 dark:text-teal-400" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-xl lg:overflow-hidden lg:min-h-0 min-h-[240px]">
        <div className="px-5 py-4 border-b border-slate-800 shrink-0 flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <h3 className="text-xs sm:text-sm font-bold tracking-[0.14em] text-slate-200 uppercase">
            {t('investigationsConsoleTitle')}
          </h3>
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto lg:overscroll-y-contain p-5 sm:p-6 pb-8">
          {selectedSections.length === 0 ? (
            <div className="min-h-[180px] lg:min-h-[220px] lg:h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-5">
                <FlaskConical size={28} className="text-slate-400" />
              </div>
              <p className="text-lg font-semibold text-slate-200 mb-2">
                {t('investigationsConsoleOffline')}
              </p>
              <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
                {t('investigationsConsoleHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedSections.map((section) => {
                const title = isAr
                  ? section.titleAr || section.title
                  : section.title;
                const body = section.content.trim()
                  ? isAr
                    ? section.contentAr || section.content
                    : section.content
                  : t('investigationsNormalResult');

                return (
                  <div
                    key={section.id}
                    className="rounded-xl border border-slate-700/80 bg-slate-800/60 p-4 sm:p-5"
                  >
                    <h4 className="text-sm font-bold text-teal-300 mb-2 tracking-wide uppercase">
                      {title}
                    </h4>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed" dir="auto">
                      {body}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function FeedbackPendingView({
  t,
  completing,
  onGoToDiagnosis,
  onGenerate,
}: {
  t: (k: string) => string;
  completing: boolean;
  onGoToDiagnosis: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="card max-w-lg w-full p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center mx-auto mb-4">
          <Lightbulb size={28} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          {t("feedbackNotReadyTitle")}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
          {t("feedbackNotReadyDesc")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" onClick={onGoToDiagnosis} className="btn-secondary text-sm">
            {t("goToDiagnosis")}
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={completing}
            className="btn-primary text-sm inline-flex items-center justify-center gap-2"
          >
            {completing ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {t("generatingFeedback")}
              </>
            ) : (
              t("completeSession")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackView({
  result,
  rankProgress,
  t,
  session,
  isAr,
  onRegenerate,
  regenerating,
  onBackToCases,
}: {
  result: Record<string, unknown>;
  rankProgress?: RankSnapshot | null;
  t: (key: string) => string;
  session: Session;
  isAr: boolean;
  onRegenerate?: () => void | Promise<void>;
  regenerating?: boolean;
  onBackToCases?: () => void;
}) {
  const [downloadingReport, setDownloadingReport] = useState(false);

  const totalScore = Number(result.totalScore ?? 0);
  const commScore = Number(result.communicationScore ?? 0);
  const histScore = Number(result.historyTakingScore ?? 0);
  const clinScore = Number(result.clinicalReasonScore ?? 0);
  const orgScore = Number(result.organizationScore ?? 0);
  const closScore = Number(result.closingScore ?? 0);

  const dateStr = session.startedAt
    ? new Date(session.startedAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  const feedbackSections = [
    {
      key: 'strengths',
      title: 'STRENGTHS',
      icon: <Star size={18} className="text-amber-300" />,
      content: String(result.strengths ?? ''),
    },
    {
      key: 'weaknesses',
      title: 'WEAKNESSES',
      icon: <AlertTriangle size={18} className="text-amber-400" />,
      content: String(result.weaknesses ?? ''),
    },
    {
      key: 'missedQuestions',
      title: 'MISSED QUESTIONS',
      icon: <HelpCircle size={18} className="text-sky-300" />,
      content: String(result.missedQuestions ?? ''),
    },
    {
      key: 'clinicalErrors',
      title: 'CLINICAL ERRORS',
      icon: <XCircle size={18} className="text-rose-400" />,
      content: String(result.clinicalErrors ?? ''),
    },
    {
      key: 'recommendations',
      title: 'RECOMMENDATIONS',
      icon: <Lightbulb size={18} className="text-yellow-300" />,
      content: String(result.recommendations ?? ''),
    },
    {
      key: 'idealApproach',
      title: 'IDEAL APPROACH',
      icon: <Target size={18} className="text-emerald-300" />,
      content: String(result.idealApproach ?? ''),
    },
  ];

  const downloadReport = async () => {
    setDownloadingReport(true);
    try {
      await downloadOsceReportPdf({
        sessionId: session.id,
        stationTitle: session.case.titleEn,
        patientName: session.case.patientName,
        result,
        isAr: false,
        labels: {
          certificateTitle: t("reportCertificateTitle"),
          officialReport: t("reportOfficialDocument"),
          totalScore: t("totalScore"),
          station: t("reportStation"),
          patient: t("reportPatient"),
          date: t("reportDate"),
          sessionId: t("reportSessionId"),
          scoreCommunication: t("scoreCommunication"),
          scoreHistory: t("scoreHistory"),
          scoreClinicalReason: t("scoreClinicalReason"),
          scoreOrganization: t("scoreOrganization"),
          scoreClosing: t("scoreClosing"),
          strengths: t("strengths"),
          weaknesses: t("weaknesses"),
          missedQuestions: t("missedQuestions"),
          clinicalErrors: t("clinicalErrors"),
          recommendations: t("recommendations"),
          idealApproach: t("idealApproach"),
          fullReport: t("fullReport"),
          certifiedSeal: t("reportCertifiedSeal"),
          platformName: t("appName"),
        },
      });
    } finally {
      setDownloadingReport(false);
    }
  };

  const formatContentPoints = (rawText: string) => {
    if (!rawText.trim()) return <p className="text-slate-400 italic">None noted.</p>;
    const lines = rawText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length <= 1 && !rawText.includes('•') && !rawText.includes('- ')) {
      return <p className="whitespace-pre-wrap">{rawText}</p>;
    }

    return (
      <ul className="space-y-1.5">
        {lines.map((line, idx) => {
          const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim();
          return (
            <li key={idx} className="flex items-start gap-2">
              <span className="text-slate-400 font-bold leading-tight select-none">•</span>
              <span className="flex-1">{cleanLine}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">
            {t("osceEvaluationReport")}
          </h2>
          <p className="text-xs text-slate-500">
            {t("feedbackGeneratedFromChat")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void downloadReport()}
            disabled={downloadingReport}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2 text-sm shadow-md shadow-primary/20"
          >
            {downloadingReport ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {t("downloadReport")}
          </button>
          {onRegenerate && (
            <button
              type="button"
              onClick={() => void onRegenerate()}
              disabled={regenerating}
              className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              {regenerating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                t("regenerateReport")
              )}
            </button>
          )}
          {onBackToCases && (
            <button
              type="button"
              onClick={onBackToCases}
              className="btn-secondary inline-flex items-center gap-2 px-4 py-2 text-sm"
            >
              <ArrowLeft size={16} />
              OSCE cases
            </button>
          )}
        </div>
      </div>

      {/* Main Certificate / Report Sheet */}
      <div className="bg-[#fcfbf7] dark:bg-slate-900 border-2 border-[#e8e4d8] dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-xl relative overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Certificate Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#e8e4d8] dark:border-slate-800">
          <div>
            <span className="text-3xl sm:text-4xl font-extrabold text-[#12242b] dark:text-emerald-400 tracking-tight font-sans">
              synoza
            </span>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 tracking-wide">
              OSCE Evaluation Certificate
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 tracking-wide">
              Official Evaluation Report
            </span>
            <div className="w-24 sm:w-28 h-0.5 bg-[#c25e4a] ml-auto mt-1 rounded-full" />
          </div>
        </div>

        {/* Station & Patient Meta Card */}
        <div className="bg-white/90 dark:bg-slate-800/80 rounded-2xl border border-[#ece7dc] dark:border-slate-700/80 p-5 mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-center shadow-xs">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">STATION</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                {session.case.titleEn}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">DATE</p>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5">
                {dateStr}
              </p>
            </div>
          </div>

          <div className="space-y-3 md:border-l md:border-slate-200 dark:md:border-slate-700 md:pl-5">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">PATIENT</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight mt-0.5">
                {session.case.patientName}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">SESSION ID</p>
              <p className="text-xs font-mono font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                {session.id.slice(0, 12)}
              </p>
            </div>
          </div>

          <div className="flex justify-start md:justify-end">
            <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full border-2 border-[#769b82]/50 bg-[#e9f1eb]/80 dark:bg-emerald-950/40 p-1 flex items-center justify-center shrink-0 shadow-inner">
              <div className="w-full h-full rounded-full border border-dashed border-[#769b82]/70 flex flex-col items-center justify-center text-center p-1">
                <span className="text-[8px] text-[#4d7359] dark:text-emerald-400 leading-none">✦</span>
                <span className="text-[10px] font-extrabold tracking-wider text-[#2d5239] dark:text-emerald-300 leading-tight uppercase">SYNOZA</span>
                <span className="text-[7px] font-bold tracking-wide text-[#4d7359] dark:text-emerald-400 leading-none uppercase">CERTIFIED</span>
                <span className="text-[9px] font-black tracking-widest text-[#2d5239] dark:text-emerald-300 leading-tight uppercase">OSCE</span>
                <span className="text-[8px] text-[#4d7359] dark:text-emerald-400 leading-none">✦</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scores Card */}
        <div className="bg-[#faf5ec] dark:bg-slate-800/70 rounded-2xl border border-[#ebe2ce] dark:border-slate-700/80 p-5 mt-5 grid grid-cols-1 sm:grid-cols-6 gap-4 items-center shadow-xs">
          <div className="sm:col-span-1 text-center sm:text-left sm:border-r sm:border-[#ebe2ce] dark:sm:border-slate-700 sm:pr-4">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">TOTAL SCORE</p>
            <p className="text-4xl sm:text-5xl font-black text-[#1b4332] dark:text-emerald-400 mt-1 tracking-tight">
              {totalScore}%
            </p>
          </div>

          <div className="sm:col-span-5 grid grid-cols-5 gap-2 text-center">
            <div className="flex flex-col items-center justify-center p-1">
              <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-700/80 flex items-center justify-center mb-1 text-slate-600 dark:text-slate-300 shadow-2xs">
                <MessageSquare size={16} />
              </div>
              <p className="text-[9px] sm:text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">
                Communication
              </p>
              <div className="w-6 h-0.5 bg-slate-300 dark:bg-slate-600 my-1 rounded-full" />
              <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                {commScore}%
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-1">
              <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-700/80 flex items-center justify-center mb-1 text-slate-600 dark:text-slate-300 shadow-2xs">
                <FileText size={16} />
              </div>
              <p className="text-[9px] sm:text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">
                History
              </p>
              <div className="w-6 h-0.5 bg-slate-300 dark:bg-slate-600 my-1 rounded-full" />
              <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                {histScore}%
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-1">
              <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-700/80 flex items-center justify-center mb-1 text-slate-600 dark:text-slate-300 shadow-2xs">
                <Brain size={16} />
              </div>
              <p className="text-[9px] sm:text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">
                Clinical Reasoning
              </p>
              <div className="w-6 h-0.5 bg-slate-300 dark:bg-slate-600 my-1 rounded-full" />
              <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                {clinScore}%
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-1">
              <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-700/80 flex items-center justify-center mb-1 text-slate-600 dark:text-slate-300 shadow-2xs">
                <Layers size={16} />
              </div>
              <p className="text-[9px] sm:text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">
                Organization
              </p>
              <div className="w-6 h-0.5 bg-slate-300 dark:bg-slate-600 my-1 rounded-full" />
              <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                {orgScore}%
              </p>
            </div>

            <div className="flex flex-col items-center justify-center p-1">
              <div className="w-8 h-8 rounded-lg bg-white/80 dark:bg-slate-700/80 flex items-center justify-center mb-1 text-slate-600 dark:text-slate-300 shadow-2xs">
                <Flag size={16} />
              </div>
              <p className="text-[9px] sm:text-[10px] font-medium text-slate-600 dark:text-slate-300 leading-tight">
                Closing
              </p>
              <div className="w-6 h-0.5 bg-slate-300 dark:bg-slate-600 my-1 rounded-full" />
              <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-white">
                {closScore}%
              </p>
            </div>
          </div>
        </div>

        {/* 6 Feedback Section Cards */}
        <div className="space-y-4 mt-6">
          {feedbackSections.map((section) => (
            <div
              key={section.key}
              className="bg-white/90 dark:bg-slate-800/80 rounded-2xl border border-[#ece7dc] dark:border-slate-700/80 p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-4 shadow-xs"
            >
              <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:w-44 shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#122b34] text-white flex items-center justify-center shrink-0 shadow-sm">
                  {section.icon}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    {section.title}
                  </h4>
                  <div className="w-10 h-0.5 bg-slate-200 dark:bg-slate-700 mt-1 rounded-full hidden sm:block" />
                </div>
              </div>

              <div
                className="w-full sm:border-l sm:border-slate-200 dark:sm:border-slate-700 sm:pl-5 flex-1 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
                dir="ltr"
              >
                {formatContentPoints(section.content)}
              </div>
            </div>
          ))}
        </div>

        {/* Full AI Report Card on Web */}
        <div className="bg-white/90 dark:bg-slate-800/80 rounded-2xl border border-[#ece7dc] dark:border-slate-700/80 p-4 sm:p-6 shadow-xs space-y-3 mt-6">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700/80">
            <div className="w-10 h-10 rounded-full bg-[#122b34] text-white flex items-center justify-center shrink-0 shadow-sm">
              <FileText size={18} />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                {t("fullReport") || "FULL AI REPORT"}
              </h4>
              <div className="w-10 h-0.5 bg-slate-200 dark:bg-slate-700 mt-1 rounded-full" />
            </div>
          </div>

          <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed" dir="auto">
            {result.fullReport ? (
              <div className="whitespace-pre-line space-y-2 font-normal">
                {String(result.fullReport)
                  .replace(/^#{1,3}\s+/gm, '')
                  .replace(/\*\*(.+?)\*\*/g, '$1')
                  .trim()}
              </div>
            ) : (
              (() => {
                const str = String(result.strengths ?? '');
                const wk = String(result.weaknesses ?? '');
                const mq = String(result.missedQuestions ?? '');
                const ce = String(result.clinicalErrors ?? '');
                return (
                  <div className="space-y-3 font-normal">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {String(result.recommendations || result.idealApproach || "The candidate completed the interactive clinical OSCE session covering systematic history taking and physical examination findings.")}
                    </p>
                    {str && (
                      <div>
                        <span className="font-bold text-teal-700 dark:text-teal-400">Communication & Professionalism: </span>
                        <span>{str}</span>
                      </div>
                    )}
                    {wk && (
                      <div>
                        <span className="font-bold text-amber-700 dark:text-amber-400">History Taking & Areas of Improvement: </span>
                        <span>{wk}</span>
                      </div>
                    )}
                    {mq && (
                      <div>
                        <span className="font-bold text-sky-700 dark:text-sky-400">Clinical Examination Findings: </span>
                        <span>{mq}</span>
                      </div>
                    )}
                    {ce && (
                      <div>
                        <span className="font-bold text-rose-700 dark:text-rose-400">Clinical Reasoning & Critical Errors: </span>
                        <span>{ce}</span>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Certificate Signature & Seal Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center pt-8 mt-8 border-t border-[#e8e4d8] dark:border-slate-800">
          {/* Doctor Signature */}
          <div className="text-center sm:text-left">
            <div className="h-12 flex items-center justify-center sm:justify-start">
              <svg className="h-11 w-40 text-[#1e3a8a] dark:text-[#60a5fa]" viewBox="0 0 160 55" fill="none">
                <path
                  d="M18 42 C14 25, 22 10, 28 8 C33 6, 36 15, 33 28 C30 40, 22 46, 26 48 C30 50, 42 20, 48 18 C54 16, 52 28, 56 30 C60 32, 68 22, 74 24 C80 26, 78 35, 84 32 C90 29, 98 25, 105 28 C112 31, 108 38, 118 30 C125 24, 134 26, 142 28 M22 28 C45 22, 85 26, 148 24 M35 48 C65 42, 105 38, 138 34"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="w-40 h-0.5 bg-[#d4cebd] dark:bg-slate-700 my-1 mx-auto sm:mx-0" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Dr. Mahmoud Nasser
            </p>
          </div>

          {/* Center: Synoza Connected Logo & Slogan with Dividers */}
          <div className="flex items-center justify-center gap-4 px-2">
            <div className="hidden sm:block h-10 w-px bg-[#d4cebd] dark:bg-slate-700" />
            <div className="text-center flex flex-col items-center justify-center">
              <div className="w-7 h-7 flex items-center justify-center mb-1 text-[#3f6766] dark:text-[#5eead4]">
                <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                  <circle cx="12" cy="5" r="2.8" />
                  <circle cx="5.5" cy="18" r="2.8" />
                  <circle cx="18.5" cy="18" r="2.8" />
                  <line x1="12" y1="5" x2="5.5" y2="18" stroke="currentColor" strokeWidth="2.2" />
                  <line x1="12" y1="5" x2="18.5" y2="18" stroke="currentColor" strokeWidth="2.2" />
                  <line x1="5.5" y1="18" x2="18.5" y2="18" stroke="currentColor" strokeWidth="2.2" />
                </svg>
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                Building Clinical Connections
              </p>
            </div>
            <div className="hidden sm:block h-10 w-px bg-[#d4cebd] dark:bg-slate-700" />
          </div>

          {/* Official Green Scalloped Seal Stamp */}
          <div className="flex justify-center sm:justify-end">
            <div className="w-22 h-22 flex items-center justify-center">
              <svg viewBox="0 0 120 120" className="w-20 h-20 text-[#50806b] dark:text-[#6ba78e] select-none" fill="none">
                {/* Scalloped outer edge (certificate rosette) */}
                <path
                  d="M 60 4 Q 63 4 66 6 Q 69 8 72 7 Q 75 6 78 9 Q 81 12 84 12 Q 87 12 90 16 Q 93 20 95 21 Q 98 22 100 27 Q 102 32 103 34 Q 105 36 107 42 Q 108 47 108 50 Q 109 53 109 60 Q 109 67 108 70 Q 108 73 107 78 Q 105 84 103 86 Q 102 88 100 93 Q 98 98 95 99 Q 93 100 90 104 Q 87 108 84 108 Q 81 108 78 111 Q 75 114 72 113 Q 69 112 66 114 Q 63 116 60 116 Q 57 116 54 114 Q 51 112 48 113 Q 45 114 42 111 Q 39 108 36 108 Q 33 108 30 104 Q 27 100 25 99 Q 22 98 20 93 Q 18 88 17 86 Q 15 84 13 78 Q 12 73 12 70 Q 11 67 11 60 Q 11 53 12 50 Q 12 47 13 42 Q 15 36 17 34 Q 18 32 20 27 Q 22 22 25 21 Q 27 20 30 16 Q 33 12 36 12 Q 39 12 42 9 Q 45 6 48 7 Q 51 8 54 6 Q 57 4 60 4 Z"
                  fill="currentColor"
                  fillOpacity="0.14"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                />
                {/* Concentric rings */}
                <circle cx="60" cy="60" r="46" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="60" cy="60" r="43" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 2" />
                <circle cx="60" cy="60" r="32" stroke="currentColor" strokeWidth="1" />

                {/* Top Curved Text */}
                <path id="topSealCurveWeb" d="M 24 60 A 36 36 0 0 1 96 60" fill="none" />
                <text className="text-[7px] font-black uppercase tracking-[0.16em]" fill="currentColor">
                  <textPath href="#topSealCurveWeb" startOffset="50%" textAnchor="middle">
                    ★ SYNOZA PLATFORM ★
                  </textPath>
                </text>

                {/* Bottom Curved Text */}
                <path id="botSealCurveWeb" d="M 96 60 A 36 36 0 0 1 24 60" fill="none" />
                <text className="text-[6.5px] font-black uppercase tracking-[0.14em]" fill="currentColor">
                  <textPath href="#botSealCurveWeb" startOffset="50%" textAnchor="middle">
                    • OFFICIAL DOCUMENT •
                  </textPath>
                </text>

                {/* Laurel Wreath */}
                <path
                  d="M 40 60 C 40 70, 48 77, 60 78 C 72 77, 80 70, 80 60"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  fill="none"
                />
                <path
                  d="M 42 55 Q 40 62 44 65 M 46 64 Q 45 70 51 72 M 53 71 Q 55 76 60 76 M 67 71 Q 65 76 60 76 M 74 64 Q 75 70 69 72 M 78 55 Q 80 62 76 65"
                  stroke="currentColor"
                  strokeWidth="1"
                  fill="none"
                />

                {/* Center 3-lobed Propeller Emblem */}
                <g transform="translate(60,56) scale(0.68)">
                  <circle cx="0" cy="0" r="3.5" fill="currentColor" />
                  <path d="M 0 -3.5 C 5 -12, 14 -10, 8 -3 C 5 0, 3 0, 0 0" fill="currentColor" />
                  <path d="M 0 -3.5 C 5 -12, 14 -10, 8 -3 C 5 0, 3 0, 0 0" transform="rotate(120)" fill="currentColor" />
                  <path d="M 0 -3.5 C 5 -12, 14 -10, 8 -3 C 5 0, 3 0, 0 0" transform="rotate(240)" fill="currentColor" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        {/* Bottom Dark Security Ribbon */}
        <div className="bg-[#12242b] -mx-6 -mb-6 sm:-mx-10 sm:-mb-10 mt-8 px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] font-medium text-slate-300 tracking-wider">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>SECURE · VERIFIED · TRUSTED</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Globe size={14} />
            <span>WWW.SYNOZAA.COM</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <QrCode size={14} />
          </div>
        </div>
      </div>

      {/* XP & Rank Progress Breakdown */}
      <XpBreakdownSection result={result} rankProgress={rankProgress} isAr={isAr} />
    </div>
  );
}
