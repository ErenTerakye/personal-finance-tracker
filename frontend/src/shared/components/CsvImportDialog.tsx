import { FormEvent, useEffect, useState } from "react";
import "./CsvImportDialog.css";
import { Search, Upload } from "lucide-react";
import type {
  ActivityImportPreview,
  ImportSummary,
  TransactionImportPreview,
} from "../../types";
import { localizedNotice } from "../i18n/notices";
import { useI18n } from "../i18n/I18nProvider";
import { SubmitButton } from "./actions";
import { ModalDialog } from "./dialogs";
import { ErrorBanner } from "./feedback";
import { Field } from "./fields";

export function CsvImportDialog({
  open,
  title,
  description,
  result,
  preview,
  error,
  uploading,
  previewing = false,
  onClose,
  onImport,
  onPreview,
  onReset,
}: {
  open: boolean;
  title: string;
  description: string;
  result: ImportSummary | null;
  preview?: TransactionImportPreview | ActivityImportPreview | null;
  error: string;
  uploading: boolean;
  previewing?: boolean;
  onClose: () => void;
  onImport: (csvText: string, allowDuplicates?: boolean) => Promise<unknown>;
  onPreview?: (csvText: string) => Promise<unknown>;
  onReset: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) {
      // Closing the workflow intentionally clears sensitive file contents and options.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFile(null);
      setCsvText("");
      setAllowDuplicates(false);
    }
  }, [open]);

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      return;
    }
    const text = csvText || (await readFileText(file));
    if (onPreview && !preview) {
      setCsvText(text);
      await onPreview(text);
      return;
    }
    await onImport(text, allowDuplicates);
  }

  return (
    <ModalDialog
      open={open}
      title={title}
      description={description}
      onClose={() => {
        onReset();
        onClose();
      }}
    >
      {error ? <ErrorBanner message={error} /> : null}
      <form className="dialog-form" onSubmit={submitImport}>
        <Field
          id="csv-file"
          label={t("csv.fileLabel")}
          hint={t("csv.fileHint")}
        >
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              onReset();
              setFile(event.target.files?.[0] ?? null);
            }}
          />
        </Field>
        {preview ? (
          <ImportPreviewSummary
            preview={preview}
            allowDuplicates={allowDuplicates}
            onAllowDuplicatesChange={setAllowDuplicates}
          />
        ) : null}
        {result ? <ImportResultSummary result={result} /> : null}
        <div className="dialog-actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
          >
            {t("common.cancel")}
          </button>
          <SubmitButton
            busy={uploading || previewing}
            icon={onPreview && !preview ? Search : Upload}
            disabled={!file}
          >
            {onPreview && !preview ? t("csv.previewBtn") : t("csv.importBtn")}
          </SubmitButton>
        </div>
      </form>
    </ModalDialog>
  );
}

async function readFileText(file: File): Promise<string> {
  const textReader = (file as File & { text?: () => Promise<string> }).text;
  if (textReader) {
    return textReader.call(file);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("Could not read the CSV file.")),
    );
    reader.readAsText(file);
  });
}

function ImportPreviewSummary({
  preview,
  allowDuplicates,
  onAllowDuplicatesChange,
}: {
  preview: TransactionImportPreview | ActivityImportPreview;
  allowDuplicates: boolean;
  onAllowDuplicatesChange: (value: boolean) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="import-summary preview" role="status" aria-live="polite">
      <strong>{t("csv.previewReady")}</strong>
      <span>
        {t("csv.previewSummary", {
          valid: preview.valid_count,
          duplicate: preview.duplicate_count,
          invalid: preview.invalid_count,
        })}
      </span>
      {preview.duplicate_count ? (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={allowDuplicates}
            onChange={(event) => onAllowDuplicatesChange(event.target.checked)}
          />
          <span>{t("csv.importDuplicates")}</span>
        </label>
      ) : null}
      <ul className="preview-list">
        {preview.rows.slice(0, 8).map((row) => (
          <li key={`${row.line_number}-${row.status}`}>
            <strong>
              {t("csv.linePreview", {
                line: row.line_number,
                status: t(`common.${row.status}`) || row.status,
              })}
            </strong>
            <span>{previewRowDetail(row, t)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function previewRowDetail(
  row:
    | TransactionImportPreview["rows"][number]
    | ActivityImportPreview["rows"][number],
  t: (key: string) => string,
) {
  if (row.error) return row.error;
  if ("activity" in row) {
    const activity = row.activity;
    return activity
      ? `${t(`activity.kinds.${activity.kind}`)} ${activity.amount} · ${activity.balance_effects.join(", ")}`
      : "";
  }
  return `${t(`common.${row.transaction?.type}`) || row.transaction?.type} ${row.transaction?.amount} ${row.original_category !== row.transaction?.category ? `${row.original_category} -> ` : ""}${row.transaction?.category}`;
}

function ImportResultSummary({ result }: { result: ImportSummary }) {
  const { t } = useI18n();

  return (
    <div className="import-summary" role="status" aria-live="polite">
      <strong>{localizedNotice(result, t)}</strong>
      <span>
        {t("csv.importedSummary", {
          imported: result.imported_count,
          skipped: result.skipped_count,
        })}
      </span>
      {result.errors.length ? (
        <ul>
          {result.errors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
