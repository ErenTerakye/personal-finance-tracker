const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const TRANSITION_CLASS = "theme-view-transition";
const REVEAL_X_PROPERTY = "--theme-reveal-x";
const REVEAL_Y_PROPERTY = "--theme-reveal-y";
const REVEAL_RADIUS_PROPERTY = "--theme-reveal-radius";

let activeTransition: ViewTransition | null = null;
let transitionGeneration = 0;

export function applyThemeChangeWithTransition(
  origin: HTMLElement,
  update: () => void,
) {
  const root = document.documentElement;
  const generation = ++transitionGeneration;
  let updated = false;
  const commit = () => {
    if (updated) return;
    updated = true;
    update();
  };

  activeTransition?.skipTransition();
  activeTransition = null;
  cleanupTransitionState(root);

  if (
    !document.startViewTransition ||
    window.matchMedia?.(REDUCED_MOTION_QUERY).matches
  ) {
    commit();
    return;
  }

  const bounds = origin.getBoundingClientRect();
  const x = bounds.left + bounds.width / 2;
  const y = bounds.top + bounds.height / 2;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  root.style.setProperty(REVEAL_X_PROPERTY, `${x}px`);
  root.style.setProperty(REVEAL_Y_PROPERTY, `${y}px`);
  root.style.setProperty(REVEAL_RADIUS_PROPERTY, `${radius}px`);
  root.classList.add(TRANSITION_CLASS);

  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(commit);
  } catch {
    cleanupTransitionState(root);
    commit();
    return;
  }

  activeTransition = transition;
  void transition.finished
    .catch(() => {})
    .then(() => {
      if (generation !== transitionGeneration) return;
      activeTransition = null;
      cleanupTransitionState(root);
    });
}

function cleanupTransitionState(root: HTMLElement) {
  root.classList.remove(TRANSITION_CLASS);
  root.style.removeProperty(REVEAL_X_PROPERTY);
  root.style.removeProperty(REVEAL_Y_PROPERTY);
  root.style.removeProperty(REVEAL_RADIUS_PROPERTY);
}
