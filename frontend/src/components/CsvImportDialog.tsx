import { FormEvent, useEffect, useState } from "react";
import { Search, Upload } from "lucide-react";
import type { ImportSummary, TransactionImportPreview } from "../types";
import { ErrorBanner, Field, ModalDialog, SubmitButton } from "./ui";
import { localizedNotice, useI18n } from "../i18n";

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
  preview?: TransactionImportPreview | null;
  error: string;
  uploading: boolean;
  previewing?: boolean;
  onClose: () => void;
  onImport: (csvText: string, allowDuplicates?: boolean) => Promise<void>;
  onPreview?: (csvText: string) => Promise<void>;
  onReset: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) {
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
  preview: TransactionImportPreview;
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
            <span>
              {row.error ??
                `${t(`common.${row.transaction?.type}`) || row.transaction?.type} ${row.transaction?.amount} ${row.original_category !== row.transaction?.category ? `${row.original_category} -> ` : ""}${row.transaction?.category}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
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
