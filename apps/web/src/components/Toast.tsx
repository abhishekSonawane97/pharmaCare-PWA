'use client';

import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { Check, X, Info } from 'lucide-react';

type ToastTone = 'success' | 'danger' | 'info';
interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  push: (t: { message: string; tone?: ToastTone }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback(({ message, tone = 'info' }: { message: string; tone?: ToastTone }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(ts => [...ts, { id, message, tone }]);
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto bg-[var(--ink)] text-white text-[12.5px] px-3.5 py-2.5 rounded-lg shadow-lg flex items-center gap-2 min-w-[220px] animate-toast"
          >
            {t.tone === 'success' ? <Check size={14} className="text-[var(--brand-300)]" /> :
             t.tone === 'danger' ? <X size={14} className="text-rose-300" /> :
             <Info size={14} className="text-[var(--brand-300)]" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside <ToastProvider>');
  return ctx.push;
}
