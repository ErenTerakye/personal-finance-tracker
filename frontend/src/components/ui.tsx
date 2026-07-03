import {
  AlertCircle,
  X,
  Loader2,
  Plus,
  type LucideIcon
} from "lucide-react";
import {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  FormEvent,
  ReactNode,
  useEffect,
  useId,
  useRef
} from "react";

export function PageHeader({
  eyebrow,
  title,
  summary,
  actions,
  className = ""
}: {
  eyebrow: string;
  title: string;
  summary: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`page-heading ${className}`.trim()} aria-labelledby="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 id="page-title">{title}</h1>
        <p>{summary}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </section>
  );
}

export function Panel({
  title,
  detail,
  children,
  actions,
  className = "",
  deferred = false
}: {
  title: string;
  detail?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  deferred?: boolean;
}) {
  return (
    <article className={`panel ${className} ${deferred ? "deferred-section" : ""}`.trim()}>
      <header className="panel-header">
        <div>
          <h2>{title}</h2>
          {detail ? <p>{detail}</p> : null}
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </header>
      {children}
    </article>
  );
}

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
  return (
    <div className="notice" role="status" aria-live="polite">
      {message}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action
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

export function Field({
  id,
  label,
  hint,
  children
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function ModalDialog({
  open,
  title,
  description,
  children,
  onClose,
  className = ""
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${className}`.trim()}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
    >
      <header className="modal-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

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
    <button {...props} className={`button ${variant}`} type="submit" disabled={busy || props.disabled}>
      {busy ? <Loader2 className="spin" aria-hidden="true" size={18} /> : <Icon aria-hidden="true" size={18} />}
      <span>{children}</span>
    </button>
  );
}

export function FilterBar({
  title,
  summary,
  children
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className="filter-bar" aria-labelledby={titleId}>
      <header className="filter-bar-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          <p>{summary}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

export function stopForm(event: FormEvent<HTMLFormElement>, handler: () => void) {
  event.preventDefault();
  handler();
}
