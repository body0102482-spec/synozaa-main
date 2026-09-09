import { Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AdminStickySaveBarProps {
  onSave: () => void;
  onCancel?: () => void;
  saving?: boolean;
  disabled?: boolean;
  saveLabel?: string;
}

export function AdminStickySaveBar({
  onSave,
  onCancel,
  saving = false,
  disabled = false,
  saveLabel,
}: AdminStickySaveBarProps) {
  const { t } = useTranslation();

  return (
    <div className="sticky bottom-0 z-30 mt-8 -mx-1 px-1 py-3 border-t border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary inline-flex items-center gap-2">
            <X size={16} />
            {t('cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || disabled}
          className="btn-primary inline-flex items-center gap-2 min-w-[8.5rem] justify-center"
        >
          <Save size={16} />
          {saving ? t('saving') : saveLabel ?? t('save')}
        </button>
      </div>
    </div>
  );
}
