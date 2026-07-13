import { AlertCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="alert" role="alert">
      <AlertCircle aria-hidden="true" size={18} />
      <span>{message}</span>
    </div>
  );
}

export function Notice({ message }: { message: string }) {
  if (!message) {
    return null;
  }
  return <div className="notice">{message}</div>;
}

export function EmptyState({
  title,
  message,
  action,
  icon: Icon,
  eyebrow,
}: {
  title: string;
  message: string;
  action?: ReactNode;
  icon?: LucideIcon;
  eyebrow?: string;
}) {
  return (
    <div className="empty-state">
      {Icon ? (
        <span className="empty-state-icon" aria-hidden="true">
          <Icon size={24} strokeWidth={1.8} />
        </span>
      ) : null}
      <div className="empty-state-copy">
        {eyebrow ? <span>{eyebrow}</span> : null}
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {action ? <div className="empty-state-action">{action}</div> : null}
    </div>
  );
}
