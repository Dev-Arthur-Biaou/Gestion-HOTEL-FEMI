"use client";

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { IconAlert, IconRefresh, IconX } from "@/components/icons";
import { formatMoney, STATUS_LABEL, type StayStatus } from "@/lib/money";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "accent" | "ghost" | "danger";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "ghost",
  size = "md",
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn("btn", `btn-${variant}`, size === "sm" && "btn-sm", className)}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const STATUS_STYLE: Record<StayStatus, string> = {
  brouillon: "bg-[rgba(120,109,92,0.13)] text-muted border-[rgba(120,109,92,0.3)]",
  prepare: "bg-[rgba(47,111,237,0.11)] text-info border-[rgba(47,111,237,0.3)]",
  partiel: "bg-[rgba(192,119,8,0.13)] text-warning border-[rgba(192,119,8,0.32)]",
  paye: "bg-[rgba(22,130,93,0.13)] text-success border-[rgba(22,130,93,0.32)]",
  annule: "bg-[rgba(191,58,43,0.11)] text-danger border-[rgba(191,58,43,0.3)]",
};

export function StatusBadge({ status, className }: { status: StayStatus; className?: string }) {
  return (
    <span className={cn("chip border", STATUS_STYLE[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "palm" | "terre" | "or" | "info";
  className?: string;
}) {
  const tones = {
    neutral: "bg-sand text-ink-soft border-line-strong",
    palm: "bg-[rgba(18,101,82,0.1)] text-palm border-[rgba(18,101,82,0.25)]",
    terre: "bg-[rgba(191,81,39,0.1)] text-terre border-[rgba(191,81,39,0.25)]",
    or: "bg-[rgba(221,161,24,0.16)] text-[#8a6206] border-[rgba(221,161,24,0.35)]",
    info: "bg-[rgba(47,111,237,0.1)] text-info border-[rgba(47,111,237,0.25)]",
  };
  return <span className={cn("chip border", tones[tone], className)}>{children}</span>;
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="label">
        {label}
        {required && <span className="ml-1 text-terre">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 flex items-center gap-1 text-[0.74rem] font-semibold text-danger">
          <IconAlert width={12} height={12} />
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1 block text-[0.74rem] leading-snug text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Money({
  value,
  className,
  signed,
}: {
  value: number;
  className?: string;
  signed?: boolean;
}) {
  return (
    <span className={cn("tabular", className)}>
      {signed && value > 0 ? "+" : ""}
      {formatMoney(value)}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="mudcloth grid h-16 w-16 place-items-center rounded-2xl border border-line text-palm">
        {icon}
      </div>
      <div>
        <p className="font-display text-lg font-semibold text-ink">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted">{message}</p>
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-4 flex flex-col items-start gap-3 rounded-2xl border border-[rgba(191,58,43,0.3)] bg-[rgba(191,58,43,0.06)] p-5 sm:flex-row sm:items-center">
      <span className="text-danger">
        <IconAlert width={22} height={22} />
      </span>
      <p className="flex-1 text-sm font-semibold text-ink">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" icon={<IconRefresh width={14} height={14} />} onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <SkeletonBlock className="h-9 w-9 rounded-xl" />
          <SkeletonBlock className="h-4 flex-1" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

function useDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useDismiss(open, onClose);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-[rgba(8,34,29,0.55)] p-4 backdrop-blur-[2px] sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "anim-pop relative my-auto w-full overflow-hidden rounded-3xl border border-line bg-surface shadow-[var(--shadow-lift)]",
          width,
        )}
      >
        <div className="flex items-start gap-4 border-b border-line bg-overlay px-5 py-4">
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[0.8rem] text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-xl border border-line bg-surface p-1.5 text-muted transition hover:border-terre hover:text-terre"
          >
            <IconX width={16} height={16} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-overlay px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useDismiss(open, onClose);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[70] flex justify-end bg-[rgba(8,34,29,0.5)] backdrop-blur-[2px]">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="anim-slide relative flex h-full w-[min(100vw,42rem)] flex-col border-l border-line bg-canvas shadow-[var(--shadow-lift)]"
      >
        <header className="flex items-start gap-4 border-b border-line bg-surface px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            {subtitle && <div className="mt-1 text-[0.82rem] text-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le panneau"
            className="rounded-xl border border-line bg-surface p-1.5 text-muted transition hover:border-terre hover:text-terre"
          >
            <IconX width={16} height={16} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-3.5">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition hover:border-palm"
    >
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-palm" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[1.4rem]" : "left-0.5",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="block text-[0.75rem] leading-snug text-muted">{hint}</span>}
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-sand p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg font-semibold transition",
            size === "sm" ? "px-2.5 py-1 text-[0.74rem]" : "px-3 py-1.5 text-[0.8rem]",
            value === option.value
              ? "bg-surface text-palm shadow-[0_2px_8px_-4px_rgba(8,34,29,0.5)]"
              : "text-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[rgba(18,101,82,0.1)] text-palm">
            {icon}
          </span>
        )}
        <div>
          <h2 className="font-display text-[1.05rem] font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-[0.78rem] text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "danger" | "palm";
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    info: "border-[rgba(47,111,237,0.28)] bg-[rgba(47,111,237,0.07)] text-info",
    warning: "border-[rgba(192,119,8,0.3)] bg-[rgba(221,161,24,0.12)] text-[#8a6206]",
    danger: "border-[rgba(191,58,43,0.3)] bg-[rgba(191,58,43,0.07)] text-danger",
    palm: "border-[rgba(18,101,82,0.28)] bg-[rgba(18,101,82,0.07)] text-palm",
  };
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-3.5", tones[tone])}>
      <span className="mt-0.5 shrink-0">
        <IconAlert width={16} height={16} />
      </span>
      <div className="min-w-0 text-[0.8rem] leading-relaxed text-ink-soft">
        {title && <p className={cn("mb-0.5 font-bold", tones[tone].split(" ").pop())}>{title}</p>}
        {children}
      </div>
    </div>
  );
}
