import { flushSync } from "react-dom";

export type MotionTransitionType =
  | "period-forward"
  | "period-backward"
  | "period-jump"
  | "route-forward"
  | "route-backward"
  | "route-jump";

type ViewTransitionLike = {
  finished?: Promise<unknown>;
  updateCallbackDone?: Promise<unknown>;
  skipTransition?: () => void;
};

type TransitionDocument = Document & {
  startViewTransition?: (options: {
    update: () => void;
    types: string[];
  }) => ViewTransitionLike;
};

let activeTransition: ViewTransitionLike | null = null;

export function cancelActiveViewTransition() {
  activeTransition?.skipTransition?.();
  activeTransition = null;
  document.documentElement.classList.remove("period-view-transition");
  document.documentElement.classList.remove("route-view-transition");
}

/**
 * The sole React/View Transition boundary. flushSync is intentionally scoped
 * here so the browser snapshots the committed DOM, never an intermediate
 * React render. Callers still update synchronously when motion is unavailable.
 */
export function runViewTransition(
  type: MotionTransitionType,
  update: () => void,
): { started: boolean; finished: Promise<void>; updated: Promise<void> } {
  const transitionDocument = document as TransitionDocument;
  const reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  if (!transitionDocument.startViewTransition || reducedMotion) {
    flushSync(update);
    return {
      started: false,
      finished: Promise.resolve(),
      updated: Promise.resolve(),
    };
  }

  // A superseded snapshot must never block the newest interaction. Skipping
  // it preserves the already-committed update and releases snapshot layers.
  activeTransition?.skipTransition?.();
  activeTransition = null;
  const root = document.documentElement;
  const transitionClass = type.startsWith("period-")
    ? "period-view-transition"
    : "route-view-transition";
  root.classList.add(transitionClass);

  let transition: ViewTransitionLike;
  try {
    const candidate = transitionDocument.startViewTransition({
      update: () => flushSync(update),
      types: [type],
    });
    if (!candidate) {
      root.classList.remove(transitionClass);
      flushSync(update);
      return {
        started: false,
        finished: Promise.resolve(),
        updated: Promise.resolve(),
      };
    }
    transition = candidate;
  } catch {
    root.classList.remove(transitionClass);
    flushSync(update);
    return {
      started: false,
      finished: Promise.resolve(),
      updated: Promise.resolve(),
    };
  }

  activeTransition = transition;
  const updated = Promise.resolve(transition.updateCallbackDone).then(
    () => undefined,
    () => undefined,
  );
  const finished = Promise.resolve(transition.finished)
    .then(
      () => undefined,
      () => undefined,
    )
    .finally(() => {
      if (activeTransition === transition) {
        activeTransition = null;
        root.classList.remove(transitionClass);
      }
    });

  return { started: true, finished, updated };
}
