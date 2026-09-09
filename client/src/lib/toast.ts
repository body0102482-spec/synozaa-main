export type ToastType = 'success' | 'error';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function subscribeToToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
}

export function showToast(message: string, type: ToastType = 'success', durationMs = 3200) {
  const id = nextId++;
  // Keep at most 4 toasts on screen
  toasts = [...toasts, { id, type, message }].slice(-4);
  emit();
  window.setTimeout(() => dismissToast(id), durationMs);
}
