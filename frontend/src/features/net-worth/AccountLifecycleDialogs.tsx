import { Archive, History, Pencil, Save, Trash2 } from "lucide-react";
import { useMemo, useReducer, useState } from "react";
import { api } from "../../api/client";
import { SubmitButton } from "../../shared/components/actions";
import { ModalDialog } from "../../shared/components/dialogs";
import { ErrorBanner } from "../../shared/components/feedback";
import { Field } from "../../shared/components/fields";
import { formatDate, todayIso } from "../../shared/format/dates";
import { money } from "../../shared/format/money";
import { useMutation } from "../../shared/hooks/useMutation";
import { useResource } from "../../shared/hooks/useResource";
import { useI18n } from "../../shared/i18n/I18nProvider";
import type {
  AccountInput,
  AccountRecord,
  BalanceSnapshot,
  NetWorthAccountAnalytics,
  NetWorthOverview,
} from "../../types";

export type DialogState =
  | { kind: "add" }
  | { kind: "checkIn" }
  | { kind: "inspector"; account: AccountRecord }
  | { kind: "balance"; account: AccountRecord; snapshot?: BalanceSnapshot }
  | { kind: "edit"; account: AccountRecord }
  | { kind: "archive"; account: AccountRecord }
  | { kind: "history"; account: AccountRecord }
  | null;

export function AccountInspectorDialog({
  open,
  account,
  onClose,
  onAction,
}: {
  open: boolean;
  account: AccountRecord;
  onClose: () => void;
  onAction: (dialog: DialogState) => void;
}) {
  const { t } = useI18n();
  return (
    <ModalDialog
      open={open}
      title={account.name}
      description={t("netWorth.inspector.description", {
        type: t(`netWorth.account.${account.type}`),
      })}
      onClose={onClose}
      initialFocusId="account-inspector-history"
      className="account-inspector-dialog"
    >
      <dl className="inspector-summary">
        <div>
          <dt>{t("netWorth.inspector.balance")}</dt>
          <dd>
            {account.resolved_balance === null
              ? t("netWorth.account.unresolved")
              : money(account.resolved_balance)}
          </dd>
        </div>
        <div>
          <dt>{t("common.date")}</dt>
          <dd>
            {account.resolved_balance_date
              ? formatDate(account.resolved_balance_date)
              : t("netWorth.account.noEarlierBalance")}
          </dd>
        </div>
      </dl>
      <div className="inspector-actions">
        <button
          id="account-inspector-history"
          className="button secondary"
          type="button"
          onClick={() => onAction({ kind: "history", account })}
        >
          <History aria-hidden="true" />
          {t("netWorth.actions.history")}
        </button>
        {!account.archived_on ? (
          <>
            <button
              className="button secondary"
              type="button"
              onClick={() => onAction({ kind: "edit", account })}
            >
              <Pencil aria-hidden="true" />
              {t("netWorth.inspector.editName")}
            </button>
            <button
              className="button danger"
              type="button"
              onClick={() => onAction({ kind: "archive", account })}
            >
              <Archive aria-hidden="true" />
              {t("netWorth.actions.archive")}
            </button>
          </>
        ) : null}
      </div>
    </ModalDialog>
  );
}

export function toAccountRecord(
  account: NetWorthAccountAnalytics,
  data: NetWorthOverview,
): AccountRecord {
  return {
    id: account.account_id,
    name: account.name,
    type: account.type,
    archived_on: account.archived_on,
    created_at: "",
    as_of: data.summary.as_of,
    resolved_balance: account.current_balance,
    resolved_balance_date: account.current_balance_date,
    currency: data.currency,
  };
}

export function AddAccountDialog({ open, onClose, onChanged }: DialogProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<AccountInput>({
    name: "",
    type: "asset",
    initial_balance: "",
    initial_balance_date: todayIso(),
  });
  const mutation = useMutation(api.createAccount, { onSuccess: onChanged });
  return (
    <ModalDialog
      open={open}
      title={t("netWorth.dialog.addTitle")}
      description={t("netWorth.dialog.addDescription")}
      onClose={onClose}
      initialFocusId="account-name"
    >
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <form
        className="net-worth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation.mutate(form);
        }}
      >
        <Field id="account-name" label={t("netWorth.form.name")}>
          <input
            id="account-name"
            name="name"
            required
            autoComplete="off"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </Field>
        <fieldset>
          <legend>{t("netWorth.form.type")}</legend>
          <div className="account-type-options">
            {(["asset", "liability"] as const).map((type) => (
              <label key={type}>
                <input
                  type="radio"
                  name="account-type"
                  checked={form.type === type}
                  onChange={() => setForm({ ...form, type })}
                />
                <span>{t(`netWorth.account.${type}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field
          id="initial-balance"
          label={t("netWorth.form.initialBalance")}
          hint={t("netWorth.form.liabilityHint")}
        >
          <input
            id="initial-balance"
            name="initial_balance"
            inputMode="decimal"
            pattern="[0-9]+(?:\.[0-9]{1,2})?"
            required
            value={form.initial_balance}
            onChange={(event) =>
              setForm({ ...form, initial_balance: event.target.value })
            }
          />
        </Field>
        <Field id="initial-date" label={t("netWorth.form.effectiveDate")}>
          <input
            id="initial-date"
            name="initial_balance_date"
            type="date"
            max={todayIso()}
            required
            value={form.initial_balance_date}
            onChange={(event) =>
              setForm({ ...form, initial_balance_date: event.target.value })
            }
          />
        </Field>
        <DialogActions
          busy={mutation.status === "pending"}
          onClose={onClose}
          submit={t("netWorth.actions.addAccount")}
        />
      </form>
    </ModalDialog>
  );
}

export function BalanceDialog({
  open,
  account,
  snapshot,
  onClose,
  onChanged,
}: DialogProps & { account: AccountRecord; snapshot?: BalanceSnapshot }) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(snapshot?.amount ?? "");
  const [effectiveDate, setEffectiveDate] = useState(
    snapshot?.effective_date ?? todayIso(),
  );
  const mutation = useMutation(
    () => api.setBalanceSnapshot(account.id, effectiveDate, amount),
    { onSuccess: onChanged },
  );
  return (
    <ModalDialog
      open={open}
      title={
        snapshot
          ? t("netWorth.dialog.correctTitle")
          : t("netWorth.dialog.balanceTitle")
      }
      description={t("netWorth.dialog.balanceDescription", {
        name: account.name,
        type: t(`netWorth.account.${account.type}`),
      })}
      onClose={onClose}
      initialFocusId="balance-amount"
    >
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <form
        className="net-worth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation.mutate(undefined);
        }}
      >
        <Field id="balance-amount" label={t("common.amount")}>
          <input
            id="balance-amount"
            name="amount"
            inputMode="decimal"
            pattern="[0-9]+(?:\.[0-9]{1,2})?"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <Field
          id="balance-date"
          label={t("netWorth.form.effectiveDate")}
          hint={t("netWorth.form.replaceHint")}
        >
          <input
            id="balance-date"
            name="effective_date"
            type="date"
            max={todayIso()}
            required
            value={effectiveDate}
            disabled={Boolean(snapshot)}
            onChange={(event) => setEffectiveDate(event.target.value)}
          />
        </Field>
        <DialogActions
          busy={mutation.status === "pending"}
          onClose={onClose}
          submit={t("common.save")}
        />
      </form>
    </ModalDialog>
  );
}

export function EditAccountDialog({
  open,
  account,
  onClose,
  onChanged,
}: DialogProps & { account: AccountRecord }) {
  const { t } = useI18n();
  const [name, setName] = useState(account.name);
  const mutation = useMutation(() => api.updateAccount(account.id, { name }), {
    onSuccess: onChanged,
  });
  return (
    <ModalDialog
      open={open}
      title={t("netWorth.dialog.editTitle")}
      description={t("netWorth.dialog.editDescription", {
        type: t(`netWorth.account.${account.type}`),
      })}
      onClose={onClose}
      initialFocusId="edit-account-name"
    >
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <form
        className="net-worth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation.mutate(undefined);
        }}
      >
        <Field id="edit-account-name" label={t("netWorth.form.name")}>
          <input
            id="edit-account-name"
            name="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <DialogActions
          busy={mutation.status === "pending"}
          onClose={onClose}
          submit={t("common.save")}
        />
      </form>
    </ModalDialog>
  );
}

export function ArchiveDialog({
  open,
  account,
  onClose,
  onChanged,
}: DialogProps & { account: AccountRecord }) {
  const { t } = useI18n();
  const [closingDate, setClosingDate] = useState(todayIso());
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation(
    () =>
      api.archiveAccount(account.id, {
        closing_date: closingDate,
        confirm_zero_balance: confirmed,
      }),
    { onSuccess: onChanged },
  );
  return (
    <ModalDialog
      open={open}
      title={t("netWorth.dialog.archiveTitle", { name: account.name })}
      description={t("netWorth.dialog.archiveDescription")}
      onClose={onClose}
    >
      {mutation.status === "error" ? (
        <ErrorBanner message={mutation.error.message} />
      ) : null}
      <form
        className="net-worth-form"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation.mutate(undefined);
        }}
      >
        <Field id="closing-date" label={t("netWorth.form.closingDate")}>
          <input
            id="closing-date"
            name="closing_date"
            type="date"
            max={todayIso()}
            required
            value={closingDate}
            onChange={(event) => setClosingDate(event.target.value)}
          />
        </Field>
        <label className="confirmation-check">
          <input
            type="checkbox"
            required
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          <span>{t("netWorth.form.confirmZero")}</span>
        </label>
        <DialogActions
          busy={mutation.status === "pending"}
          onClose={onClose}
          submit={t("netWorth.actions.archive")}
          danger
        />
      </form>
    </ModalDialog>
  );
}

export function SnapshotHistoryDialog({
  open,
  account,
  onClose,
  onChanged,
  onEditSnapshot,
}: DialogProps & {
  account: AccountRecord;
  onEditSnapshot: (snapshot: BalanceSnapshot) => void;
}) {
  const { t } = useI18n();
  const [refreshKey, refresh] = useReducer((value: number) => value + 1, 0);
  const [confirmation, setConfirmation] = useState<
    | { kind: "snapshot"; snapshot: BalanceSnapshot }
    | { kind: "account"; snapshot: BalanceSnapshot }
    | null
  >(null);
  const load = useMemo(
    () => (signal: AbortSignal) => api.balanceSnapshots(account.id, signal),
    [account.id],
  );
  const resource = useResource(load, `${account.id}:${refreshKey}`);
  const deleteSnapshot = useMutation(
    (snapshot: BalanceSnapshot) =>
      api.deleteBalanceSnapshot(account.id, snapshot.effective_date),
    {
      onSuccess: (response) => {
        setConfirmation(null);
        onChanged(response);
        refresh();
      },
    },
  );
  const deleteAccount = useMutation(() => api.deleteAccount(account.id), {
    onSuccess: (response) => {
      setConfirmation(null);
      onChanged(response);
    },
  });
  const snapshots = resource.data?.balance_snapshots ?? [];
  const confirmationSnapshot = confirmation?.snapshot;
  return (
    <>
      <ModalDialog
        open={open}
        title={t("netWorth.dialog.historyTitle", { name: account.name })}
        description={t("netWorth.dialog.historyDescription")}
        onClose={onClose}
      >
        {resource.status === "error" ? (
          <ErrorBanner
            message={resource.error.message}
            onRetry={resource.refetch}
          />
        ) : null}
        {resource.status === "loading" ? (
          <p>{t("netWorth.loading")}</p>
        ) : (
          <ul className="snapshot-list">
            {snapshots.map((snapshot) => (
              <li key={snapshot.id}>
                <div>
                  <strong>{money(snapshot.amount)}</strong>
                  <span>{formatDate(snapshot.effective_date)}</span>
                </div>
                {!account.archived_on ? (
                  <div>
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => onEditSnapshot(snapshot)}
                    >
                      <Pencil aria-hidden="true" size={16} />
                      <span>{t("common.edit")}</span>
                    </button>
                    {snapshots.length > 1 ? (
                      <button
                        className="icon-button danger"
                        type="button"
                        aria-label={t("netWorth.actions.deleteSnapshot", {
                          date: formatDate(snapshot.effective_date),
                        })}
                        onClick={() => {
                          deleteSnapshot.reset();
                          setConfirmation({ kind: "snapshot", snapshot });
                        }}
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {!account.archived_on && snapshots.length === 1 ? (
          <div className="eligible-delete">
            <p>{t("netWorth.confirm.deleteAccountDetail")}</p>
            <button
              className="button danger"
              type="button"
              onClick={() => {
                deleteAccount.reset();
                setConfirmation({ kind: "account", snapshot: snapshots[0] });
              }}
            >
              <Trash2 aria-hidden="true" size={17} />
              <span>{t("netWorth.actions.deleteAccount")}</span>
            </button>
          </div>
        ) : null}
      </ModalDialog>
      <ModalDialog
        open={confirmation !== null}
        title={
          confirmation?.kind === "snapshot" && confirmationSnapshot
            ? t("netWorth.actions.deleteSnapshot", {
                date: formatDate(confirmationSnapshot.effective_date),
              })
            : t("netWorth.confirm.deleteAccount", { name: account.name })
        }
        description={
          confirmation?.kind === "snapshot" && confirmationSnapshot
            ? t("netWorth.confirm.deleteSnapshot", {
                amount: money(confirmationSnapshot.amount),
                date: formatDate(confirmationSnapshot.effective_date),
              })
            : confirmationSnapshot
              ? t("netWorth.confirm.deleteAccountSnapshot", {
                  amount: money(confirmationSnapshot.amount),
                  date: formatDate(confirmationSnapshot.effective_date),
                })
              : undefined
        }
        onClose={() => setConfirmation(null)}
        initialFocusId="net-worth-delete-cancel"
      >
        {confirmation?.kind === "snapshot" &&
        deleteSnapshot.status === "error" ? (
          <ErrorBanner message={deleteSnapshot.error.message} />
        ) : null}
        {confirmation?.kind === "account" &&
        deleteAccount.status === "error" ? (
          <ErrorBanner message={deleteAccount.error.message} />
        ) : null}
        <footer className="dialog-actions">
          <button
            id="net-worth-delete-cancel"
            className="button secondary"
            type="button"
            onClick={() => setConfirmation(null)}
          >
            {t("common.cancel")}
          </button>
          <button
            className="button danger"
            type="button"
            disabled={
              deleteSnapshot.status === "pending" ||
              deleteAccount.status === "pending"
            }
            onClick={() => {
              if (confirmation?.kind === "snapshot") {
                void deleteSnapshot.mutate(confirmation.snapshot);
              } else if (confirmation?.kind === "account") {
                void deleteAccount.mutate(undefined);
              }
            }}
          >
            <Trash2 aria-hidden="true" size={17} />
            <span>
              {confirmation?.kind === "snapshot"
                ? t("netWorth.actions.deleteSnapshotConfirm")
                : t("netWorth.actions.deleteAccount")}
            </span>
          </button>
        </footer>
      </ModalDialog>
    </>
  );
}

function DialogActions({
  busy,
  onClose,
  submit,
  danger = false,
}: {
  busy: boolean;
  onClose: () => void;
  submit: string;
  danger?: boolean;
}) {
  const { t } = useI18n();
  return (
    <footer className="dialog-actions">
      <button className="button secondary" type="button" onClick={onClose}>
        {t("common.cancel")}
      </button>
      <SubmitButton
        busy={busy}
        icon={danger ? Archive : Save}
        variant={danger ? "danger" : "primary"}
      >
        {submit}
      </SubmitButton>
    </footer>
  );
}

type DialogProps = {
  open: boolean;
  onClose: () => void;
  onChanged: (response: { notice: string; notice_code?: string }) => void;
};
