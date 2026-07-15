import { AlertCircle, RefreshCw, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/I18nProvider";

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="alert" role="alert">
      <span className="alert-icon" aria-hidden="true">
        <AlertCircle size={18} />
      </span>
      <span className="alert-message">{message}</span>
      {onRetry ? (
        <button
          className="button secondary alert-action"
          type="button"
          onClick={onRetry}
        >
          <RefreshCw aria-hidden="true" size={17} />
          <span>{t("common.retry")}</span>
        </button>
      ) : null}
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
