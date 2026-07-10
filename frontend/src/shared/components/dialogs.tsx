import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";
import { useI18n } from "../i18n/I18nProvider";

export function ModalDialog({
  open,
  title,
  description,
  children,
  onClose,
  className = "",
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
  const { t } = useI18n();

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
        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label={t("common.closeDialog")}
        >
          <X aria-hidden="true" size={18} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
