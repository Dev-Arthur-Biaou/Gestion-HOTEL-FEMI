"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconAlert, IconCheck, IconInfo, IconUndo, IconX } from "@/components/icons";

type Tone = "success" | "error" | "info" | "warning";

type Toast = {
  id: number;
  tone: Tone;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  duration: number;
};

type ToastInput = Omit<Toast, "id" | "duration"> & { duration?: number };

const ToastContext = createContext<{ push: (t: ToastInput) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const TONE_STYLE: Record<Tone, { bar: string; icon: ReactNode; ring: string }> = {
  success: {
    bar: "bg-success",
    ring: "text-success",
    icon: <IconCheck width={16} height={16} />,
  },
  error: { bar: "bg-danger", ring: "text-danger", icon: <IconAlert width={16} height={16} /> },
  warning: { bar: "bg-warning", ring: "text-warning", icon: <IconAlert width={16} height={16} /> },
  info: { bar: "bg-info", ring: "text-info", icon: <IconInfo width={16} height={16} /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      counter.current += 1;
      const id = counter.current;
      const duration = input.duration ?? (input.action ? 9000 : 5000);
      setToasts((list) => [...list.slice(-3), { ...input, id, duration }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[min(92vw,26rem)] flex-col gap-2.5">
        {toasts.map((toast) => {
          const tone = TONE_STYLE[toast.tone];
          return (
            <div
              key={toast.id}
              role="status"
              className="anim-slide pointer-events-auto flex overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-lift)]"
            >
              <div className={`w-1.5 shrink-0 ${tone.bar}`} />
              <div className="flex flex-1 items-start gap-3 p-3.5">
                <span className={`mt-0.5 ${tone.ring}`}>{tone.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">{toast.title}</p>
                  {toast.message && (
                    <p className="mt-0.5 text-[0.8rem] leading-snug text-muted">{toast.message}</p>
                  )}
                  {toast.action && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm mt-2"
                      onClick={() => {
                        toast.action?.onClick();
                        dismiss(toast.id);
                      }}
                    >
                      <IconUndo width={14} height={14} />
                      {toast.action.label}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Fermer la notification"
                  className="rounded-lg p-1 text-muted transition hover:bg-sand hover:text-ink"
                  onClick={() => dismiss(toast.id)}
                >
                  <IconX width={15} height={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
