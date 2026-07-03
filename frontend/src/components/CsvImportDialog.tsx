import { FormEvent, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import type { ImportSummary } from "../types";
import { ErrorBanner, Field, ModalDialog, SubmitButton } from "./ui";

export function CsvImportDialog({
  open,
  title,
  description,
  result,
  error,
  uploading,
  onClose,
  onImport,
  onReset
}: {
  open: boolean;
  title: string;
  description: string;
  result: ImportSummary | null;
  error: string;
  uploading: boolean;
  onClose: () => void;
  onImport: (csvText: string) => Promise<void>;
  onReset: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) {
      setFile(null);
    }
  }, [open]);

  async function submitImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      return;
    }
    await onImport(await readFileText(file));
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
        <Field id="csv-file" label="CSV file" hint="Use the same columns as the CLI CSV commands.">
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
            Cancel
          </button>
          <SubmitButton busy={uploading} icon={Upload} disabled={!file}>
            Import CSV
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
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Could not read the CSV file.")));
    reader.readAsText(file);
  });
}

function ImportResultSummary({ result }: { result: ImportSummary }) {
  return (
    <div className="import-summary" role="status" aria-live="polite">
      <strong>{result.notice}</strong>
      <span>
        Imported {result.imported_count}, skipped {result.skipped_count}.
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
