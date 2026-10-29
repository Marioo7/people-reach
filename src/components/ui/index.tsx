"use client";

import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-muted text-foreground hover:bg-border",
  ghost: "hover:bg-muted text-foreground",
  outline: "border border-border bg-card hover:bg-muted text-foreground",
  danger: "bg-danger text-white hover:opacity-90",
};

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

const fieldBase = "w-full rounded-lg border border-border bg-card px-3 text-sm placeholder:text-muted-foreground disabled:opacity-60";
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(fieldBase, "h-10", className)} {...p} />);
Input.displayName = "Input";
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(fieldBase, "py-2 leading-relaxed", className)} {...p} />);
Textarea.displayName = "Textarea";
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...p }, ref) => <select ref={ref} className={cn(fieldBase, "h-10", className)} {...p} />);
Select.displayName = "Select";

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return <label htmlFor={htmlFor} className={cn("mb-1 block text-sm font-medium", className)}>{children}</label>;
}

export function Checkbox({ checked, onChange, label, id, disabled }: { checked: boolean; onChange(v: boolean): void; label?: ReactNode; id?: string; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm" htmlFor={id}>
      <input id={id} type="checkbox" disabled={disabled} checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>{children}</div>;
}
export const CardHeader = ({ title, description, action }: { title: ReactNode; description?: ReactNode; action?: ReactNode }) => (
  <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
    <div>
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>
);
export const CardBody = ({ className, children }: { className?: string; children: ReactNode }) => <div className={cn("p-5", className)}>{children}</div>;

type Tone = "neutral" | "info" | "success" | "warning" | "danger";
const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning",
  danger: "bg-danger/15 text-danger",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone], className)}>{children}</span>;
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "success" | "warning" | "danger"; children: ReactNode; className?: string }) {
  const Icon = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", tone === "info" && "border-primary/30 bg-primary/5", tone === "success" && "border-success/30 bg-success/10", tone === "warning" && "border-warning/40 bg-warning/10", tone === "danger" && "border-danger/40 bg-danger/10", className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn("skeleton h-4 w-full", className)} aria-hidden />;

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {icon && <div className="rounded-full bg-muted p-3 text-muted-foreground">{icon}</div>}
      <h3 className="text-base font-semibold">{title}</h3>
      {body && <p className="max-w-md text-sm text-muted-foreground">{body}</p>}
      {action}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose(): void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} className={cn("relative max-h-[90vh] w-full overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl", wide ? "max-w-2xl" : "max-w-md")}>
        <button onClick={onClose} className="absolute end-3 top-3 rounded p-1 text-muted-foreground hover:bg-muted" aria-label={t("common.close")}><X className="size-4" /></button>
        <h2 className="mb-3 pe-6 text-lg font-semibold">{title}</h2>
        <div className="space-y-3 text-sm">{children}</div>
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange(p: number): void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm">
      <span className="text-muted-foreground">{t("common.page", { p: page, n: totalPages })}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹</Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>›</Button>
      </div>
    </div>
  );
}

export function StatCard({ label, value, icon, tone = "info" }: { label: string; value: number | string; icon: ReactNode; tone?: Tone }) {
  return (
    <Card>
      <div className="flex items-center gap-4 p-5">
        <div className={cn("rounded-lg p-2.5", TONES[tone])}>{icon}</div>
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="text-sm text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}
