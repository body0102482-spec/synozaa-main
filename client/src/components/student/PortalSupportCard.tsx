import { useTranslation } from 'react-i18next';
import { Headphones, ArrowRight } from 'lucide-react';
import { buildSupportWhatsAppUrl } from '../../lib/supportContacts';

interface PortalSupportCardProps {
  isAr?: boolean;
  topic?: 'qbank' | 'general';
  compact?: boolean;
}

export function PortalSupportCard({ isAr = false, topic = 'general', compact = false }: PortalSupportCardProps) {
  const { t } = useTranslation();
  const whatsappUrl = buildSupportWhatsAppUrl(isAr, topic);

  return (
    <div
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
          <Headphones size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{t('portalNeedHelp')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('portalNeedHelpDesc')}</p>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-2.5 text-sm font-semibold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors group"
          >
            <span className="w-7 h-7 rounded-full bg-teal-600/10 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0 group-hover:bg-teal-600/15 transition-colors">
              <Headphones size={14} />
            </span>
            <span>{t('portalContactSupport')}</span>
            <ArrowRight size={14} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </div>
    </div>
  );
}
