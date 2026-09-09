import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Wifi, WifiOff, ServerCrash } from 'lucide-react';
import { pingServer } from '../lib/api';
import { debounce } from '../lib/debounce';

type Status = 'online' | 'unstable' | 'server-offline' | 'internet-offline';

export function ConnectionStatus() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('online');
  const [latency, setLatency] = useState(0);
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      if (!navigator.onLine) {
        setStatus('internet-offline');
        setLatency(-1);
        return;
      }

      const result = await pingServer();
      if (!result.online) {
        setStatus('server-offline');
        setLatency(-1);
      } else if (result.latencyMs > 500) {
        setStatus('unstable');
        setLatency(result.latencyMs);
      } else {
        setStatus('online');
        setLatency(result.latencyMs);
      }
    } finally {
      checkingRef.current = false;
    }
  }, []);

  const debouncedCheck = useRef(debounce(() => void check(), 2000)).current;

  useEffect(() => {
    void check();
    const intervalId = window.setInterval(() => void check(), 20_000);
    const onConnectivity = () => debouncedCheck();

    window.addEventListener('online', onConnectivity);
    window.addEventListener('offline', onConnectivity);
    window.addEventListener('focus', debouncedCheck);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', onConnectivity);
      window.removeEventListener('offline', onConnectivity);
      window.removeEventListener('focus', debouncedCheck);
    };
  }, [check, debouncedCheck]);

  const statusConfig = {
    online: {
      color: 'bg-green-500',
      text: t('connectionStable'),
      title: t('connectionStable'),
      Icon: Wifi,
    },
    unstable: {
      color: 'bg-yellow-500',
      text: t('connectionUnstable'),
      title: t('connectionUnstable'),
      Icon: Wifi,
    },
    'server-offline': {
      color: 'bg-amber-500',
      text: t('connectionServerOffline'),
      title: t('connectionServerOffline'),
      Icon: ServerCrash,
    },
    'internet-offline': {
      color: 'bg-red-500',
      text: t('connectionNoInternet'),
      title: t('connectionNoInternet'),
      Icon: WifiOff,
    },
  };

  const { color, text, title, Icon } = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div
        title={title}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs cursor-default"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${color} animate-pulse`} />
        <Icon size={12} className="text-slate-400" />
        <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">{text}</span>
        {latency >= 0 && <span className="text-slate-400 hidden md:inline">{latency}ms</span>}
      </div>
    </div>
  );
}
