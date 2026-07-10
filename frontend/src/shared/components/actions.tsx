import { Loader2, Plus, type LucideIcon } from "lucide-react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";

export function IconButton({
  icon: Icon,
  label,
  variant = "ghost",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      className={`icon-button ${variant}`}
      type="button"
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon aria-hidden="true" size={18} />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export function ActionButton({
  icon: Icon,
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button className={`button ${variant}`} type="button" {...props}>
      <Icon aria-hidden="true" size={18} />
      <span>{children}</span>
    </button>
  );
}

export function DownloadLink({
  icon: Icon,
  children,
  variant = "secondary",
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  icon: LucideIcon;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <a className={`button ${variant}`} {...props}>
      <Icon aria-hidden="true" size={18} />
      <span>{children}</span>
    </a>
  );
}

export function SubmitButton({
  busy,
  icon: Icon = Plus,
  children,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  busy?: boolean;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      {...props}
      className={`button ${variant}`}
      type="submit"
      disabled={busy || props.disabled}
    >
      {busy ? (
        <Loader2 className="spin" aria-hidden="true" size={18} />
      ) : (
        <Icon aria-hidden="true" size={18} />
      )}
      <span>{children}</span>
    </button>
  );
}
