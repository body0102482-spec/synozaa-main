import { useState } from 'react';
import { Download, FileText, LoaderCircle } from 'lucide-react';
import { downloadHistorySheet, type HistorySheetMetadata } from '../../lib/historySheet';
import { useTranslation } from 'react-i18next';

interface HistorySheetSectionProps {
  caseId: string;
  historySheet?: HistorySheetMetadata | null;
  canAccess?: boolean;
}

export function HistorySheetSection({
  caseId,
  historySheet,
  canAccess = true,
}: HistorySheetSectionProps) {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  if (!canAccess) return null;

  const fileType = historySheet?.mimeType === 'application/pdf' ? 'PDF' : 'DOCX';
  const onDownload = async () => {
    if (!historySheet || downloading) return;
    setDownloading(true);
    setError('');
    try {
      await downloadHistorySheet(caseId, historySheet.fileName);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : t('historySheetDownloadFailed'));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="rounded-xl border border-cyan-100 dark:border-cyan-900/60 bg-cyan-50/70 dark:bg-cyan-950/20 p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
        <FileText size={16} className="shrink-0 text-teal-700 dark:text-teal-300" />
        <span>{t('historySheetTitle')}</span>
      </div>
      {historySheet ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-slate-600 dark:text-slate-300" title={historySheet.fileName}>
            {historySheet.fileName} <span className="text-slate-400">({fileType})</span>
          </p>
          <button
            type="button"
            onClick={() => void onDownload()}
            disabled={downloading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
          >
            {downloading ? <LoaderCircle size={14} className="animate-spin" /> : <Download size={14} />}
            {t('historySheetDownload')}
          </button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('historySheetUnavailable')}</p>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
