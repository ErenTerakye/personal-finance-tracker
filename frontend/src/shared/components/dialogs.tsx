import { X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from "react";
import "./dialogs.css";
import { useI18n } from "../i18n/I18nProvider";

export function ModalDialog({
  open,
  title,
  description,
  children,
  onClose,
  className = "",
  initialFocusId,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  initialFocusId?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const lastOutsideFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { t } = useI18n();

  function restoreOpenerFocus() {
    const opener = openerRef.current;
    openerRef.current = null;
    if (!opener) {
      return;
    }

    const focusTarget = opener;
    let attempts = 0;
    function restoreFocus() {
      if (!focusTarget.isConnected) {
        return;
      }
      focusTarget.focus();
      attempts += 1;
      if (document.activeElement !== focusTarget && attempts < 3) {
        requestAnimationFrame(restoreFocus);
      }
    }
    requestAnimationFrame(restoreFocus);
  }

  useEffect(() => {
    function rememberOutsideFocus(event: FocusEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        !dialogRef.current?.contains(target)
      ) {
        lastOutsideFocusRef.current = target;
      }
    }

    function rememberOutsideActivation(event: MouseEvent) {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(
              "button, a[href], input, select, textarea, [tabindex]",
            )
          : null;
      if (target && !dialogRef.current?.contains(target)) {
        lastOutsideFocusRef.current = target;
      }
    }

    function rememberKeyboardActivation(event: KeyboardEvent) {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && !dialogRef.current?.contains(target)) {
        lastOutsideFocusRef.current = target;
      }
    }

    document.addEventListener("focusin", rememberOutsideFocus, true);
    document.addEventListener("click", rememberOutsideActivation, true);
    document.addEventListener("keydown", rememberKeyboardActivation, true);
    return () => {
      document.removeEventListener("focusin", rememberOutsideFocus, true);
      document.removeEventListener("click", rememberOutsideActivation, true);
      document.removeEventListener("keydown", rememberKeyboardActivation, true);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    function handleNativeCancel(event: Event) {
      event.preventDefault();
      dialog?.close();
    }

    function handleNativeClose() {
      onClose();
      restoreOpenerFocus();
    }

    dialog.addEventListener("cancel", handleNativeCancel);
    dialog.addEventListener("close", handleNativeClose);
    return () => {
      dialog.removeEventListener("cancel", handleNativeCancel);
      dialog.removeEventListener("close", handleNativeClose);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      const activeElement =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      openerRef.current =
        activeElement && activeElement !== document.body
          ? activeElement
          : (lastOutsideFocusRef.current ??
            document.querySelector<HTMLElement>("[data-dialog-return-focus]"));
      dialog.showModal();
      if (initialFocusId) {
        document.getElementById(initialFocusId)?.focus();
      }
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [initialFocusId, open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal ${className}`.trim()}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
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
