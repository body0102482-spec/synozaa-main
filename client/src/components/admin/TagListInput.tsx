import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagListInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TagListInput({ value, onChange, placeholder, disabled }: TagListInputProps) {
  const [draft, setDraft] = useState('');

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addTag(draft);
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-900/30 px-2.5 py-1 text-xs font-medium text-violet-700 dark:text-violet-300"
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  className="text-violet-500 hover:text-violet-800"
                  onClick={() => onChange(value.filter((item) => item !== tag))}
                  aria-label={`Remove ${tag}`}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      <input
        className="input-field"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => addTag(draft)}
      />
    </div>
  );
}
