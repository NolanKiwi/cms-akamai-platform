'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface Ctx {
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<Ctx | null>(null);

const VARIANT_STYLES: Record<ToastVariant, { icon: any; cls: string }> = {
  success: { icon: CheckCircle2, cls: 'border-l-success bg-success/5' },
  error: { icon: AlertCircle, cls: 'border-l-destructive bg-destructive/5' },
  info: { icon: Info, cls: 'border-l-primary bg-primary/5' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (input: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = ++idRef.current;
      const toast: Toast = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant || 'info',
      };
      setToasts((t) => [...t, toast]);
      setTimeout(() => remove(id), 4500);
    },
    [remove],
  );

  const ctx: Ctx = {
    toast: push,
    success: (title, description) => push({ title, description, variant: 'success' }),
    error: (title, description) => push({ title, description, variant: 'error' }),
    info: (title, description) => push({ title, description, variant: 'info' }),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-end gap-2 px-4 sm:right-4 sm:left-auto sm:max-w-sm">
        {toasts.map((t) => {
          const { icon: Icon, cls } = VARIANT_STYLES[t.variant];
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex w-full items-start gap-3 rounded-md border border-l-4 bg-background p-3 shadow-lg',
                cls,
              )}
              role="status"
              aria-live="polite"
            >
              <Icon
                className={cn(
                  'mt-0.5 h-4 w-4 shrink-0',
                  t.variant === 'success' && 'text-success',
                  t.variant === 'error' && 'text-destructive',
                  t.variant === 'info' && 'text-primary',
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
