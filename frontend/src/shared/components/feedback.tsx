import { AlertCircle } from "lucide-react";
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
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{message}</p>
      {action ? <div>{action}</div> : null}
    </div>
  );
}
