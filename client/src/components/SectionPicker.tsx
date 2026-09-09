import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Shuffle, X } from 'lucide-react';

export interface SectionOption {
  id: string;
  label: string;
  shortLabel: string;
  boardLabel?: string;
  caseCount: number;
}

interface SectionPickerProps {
  id: string;
  options: SectionOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  casesLabel: (count: number) => string;
  chooseLabel: string;
  startLabel?: string;
  starting?: boolean;
  onStart?: () => void;
}

export function SectionPicker({
  id,
  options,
  value,
  onChange,
  disabled,
  casesLabel,
  chooseLabel,
  startLabel,
  starting,
  onStart,
}: SectionPickerProps) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const selected = options.find((o) => o.id === value);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const pick = (optionId: string) => {
    onChange(optionId);
  };

  const handleStart = () => {
    if (!value || !onStart) return;
    setOpen(false);
    onStart();
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen(true)}
        className={`input-field w-full min-w-0 pe-10 py-2.5 text-start relative ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-teal-300 dark:hover:border-teal-700'
        }`}
      >
        {selected ? (
          <>
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate leading-snug">
              {selected.shortLabel}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 leading-snug">
              {selected.boardLabel
                ? `${selected.boardLabel} · ${casesLabel(selected.caseCount)}`
                : casesLabel(selected.caseCount)}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{chooseLabel}</p>
        )}
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[9998] flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50 animate-fade-in"
              aria-label="Close"
              onClick={() => setOpen(false)}
            />

            <div
              role="listbox"
              id={listboxId}
              aria-label={chooseLabel}
              className="relative z-10 w-full sm:max-w-md max-h-[min(80vh,560px)] flex flex-col bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl animate-slide-up sm:animate-scale-in overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{chooseLabel}</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>

              <ul className="overflow-y-auto overscroll-contain p-2 space-y-1 flex-1 min-h-0">
                {options.map((section) => {
                  const isSelected = section.id === value;
                  return (
                    <li key={section.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => pick(section.id)}
                        className={`w-full text-start px-3 py-3 rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug break-words">
                              {section.shortLabel}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug break-words">
                              {section.boardLabel
                                ? `${section.boardLabel} · ${casesLabel(section.caseCount)}`
                                : casesLabel(section.caseCount)}
                            </p>
                          </div>
                          {isSelected && (
                            <Check size={18} strokeWidth={2.5} className="text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {onStart && startLabel && (
                <div className="shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50">
                  <button
                    type="button"
                    onClick={handleStart}
                    disabled={!value || starting || disabled}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-3 disabled:opacity-70"
                  >
                    {starting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {startLabel}
                      </>
                    ) : (
                      <>
                        <Shuffle size={18} strokeWidth={2.5} />
                        {startLabel}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
