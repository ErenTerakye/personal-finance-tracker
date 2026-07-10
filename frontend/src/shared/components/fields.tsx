import {
  cloneElement,
  type FormEvent,
  isValidElement,
  type ReactNode,
  useId,
} from "react";

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const control = isValidElement<{ "aria-describedby"?: string }>(children)
    ? cloneElement(children, {
        "aria-describedby": describedBy(
          children.props["aria-describedby"],
          hintId,
        ),
      })
    : children;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {control}
    </div>
  );
}

function describedBy(existing?: string, hintId?: string) {
  const ids = new Set(
    [...(existing?.split(/\s+/) ?? []), hintId].filter(Boolean),
  );
  return ids.size ? [...ids].join(" ") : undefined;
}

export function FilterBar({
  title,
  summary,
  children,
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

export function stopForm(
  event: FormEvent<HTMLFormElement>,
  handler: () => void,
) {
  event.preventDefault();
  handler();
}
