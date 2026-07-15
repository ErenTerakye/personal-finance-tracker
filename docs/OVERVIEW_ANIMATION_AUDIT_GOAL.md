# Overview Animation Audit and Implementation Goal

## Document Status

- **Status:** Proposed implementation goal based on a live UI and source audit
- **Audit date:** July 15, 2026
- **Scope:** The Overview route (`/`) and every global-shell interaction reachable while it is active
- **Target:** Baseline 2026 browsers and minimum versions defined in `AGENTS.md`
- **Primary audience:** An AI implementation agent, contributors, and reviewers
- **Source of truth for:** What Overview motion should remain, change, be removed, or be considered optional
- **Architecture boundary:** React behavior in `frontend/src/app/`, Overview workflows in
  `frontend/src/features/dashboard/`, reusable motion behavior in `frontend/src/shared/`, and tests
- **Out of scope:** Redesigning the Overview information architecture, changing finance rules,
  changing API payloads, adding an animation library, or animating other routes except where an
  Overview action enters them

## Agent Mission

Implement the required work in this document so that motion on the Overview route is intentional,
complete in both directions, accessible, performant, and consistent with the product's calm
ledger-editorial design. Preserve the interactions marked **Keep**. Complete all **Required** items.
Treat **Optional** items as polish that must not delay or destabilize the required work.

The result must use native browser and CSS capabilities already allowed by the project. Do not add a
general animation dependency, JavaScript physics engine, carousel, ambient animation, scroll reveal,
parallax effect, or complex legacy-browser polyfill.

## Outcome

When this goal is complete:

1. Every state change provides immediate and proportionate feedback.
2. Entry and exit motion are symmetrical where an element has a meaningful visual lifecycle.
3. Period changes visually explain forward, backward, and non-adjacent movement without blocking
   data loading or rapid input.
4. Actions leaving Overview use one coherent route-transition system, with a no-animation fallback.
5. Pointer, keyboard, and touch users receive equivalent state feedback.
6. `prefers-reduced-motion: reduce` removes spatial and continuous motion while preserving state
   clarity.
7. No shipped View Transition selector, keyframe, direction calculation, or motion class is dead.
8. Animation does not cause focus loss, trapped input, accidental activation, cumulative layout
   shift, or a long interaction delay.

## Audit Basis

The audit covered the live Vite/FastAPI demo with the June and July 2026 fixture data at wide and
390-by-844 compact viewports. It exercised pointer/click and keyboard-operable states, inspected the
rendered accessibility tree and computed animation styles, and reviewed the React and layered CSS
implementation.

The audit specifically inspected:

- First load, retained-data loading, success, error, empty, and retry surfaces.
- Previous/next month changes and the value changes they trigger.
- Wide popover and compact modal-sheet variants of the period picker.
- Month/year picker modes, year stepping, year-page stepping, selection, dismissal, and focus return.
- Export menu entry, dismissal, chevron state, outside/Escape behavior, and artifact links.
- KPI rolling values, trend bars and tooltips, chart-data disclosures, budget-pressure disclosure,
  recent-activity navigation, expense-mix slices and legend, and category navigation.
- Global Overview shell actions: skip link, brand, primary navigation, add entry, language, theme,
  responsive chrome, and focus after route navigation.
- Fine pointer, keyboard, touch-oriented compact layout, and reduced-motion CSS branches.

The in-app audit browser did not expose `document.startViewTransition`; the View Transition finding
therefore comes from source and test inspection. This is still conclusive: the app does not call the
API, and current tests explicitly assert that it is not called.

## Motion Principles for This Work

### Motion explains state

Animate navigation direction, disclosure, value continuity, and top-layer entry/exit. Do not animate
static reading content merely to make the page feel busy.

### Immediate response, short settlement

Controls must react on press immediately. Most control feedback should finish in 100–200 ms,
navigation/disclosure motion in 180–280 ms, and rolling numeric changes in at most the existing
520 ms. Motion must never postpone the underlying state update.

### Transform and opacity first

Prefer `translate`, `scale`, `rotate`, `transform`, and `opacity`. Size interpolation is acceptable
for the two bounded disclosures already using it because their purpose is to reveal document flow.
Do not animate `top`, `left`, large shadows, filters on large surfaces, or unspecified `all`.

### Reduced motion is an alternate design

Reduced motion is not simply a global duration multiplier. Remove directional travel, rotation,
rolling, scaling, and shimmer. Use an instant state change or a very short opacity change only when
that fade materially clarifies entry/exit.

### Progressive enhancement

Core navigation and updates must run synchronously without animation when View Transitions,
`@starting-style`, discrete transitions, or `overlay` are unavailable. Do not add a polyfill for the
project's Baseline 2026 target.

## Executive Findings

### Good and should remain

- Motion tokens are centralized and restrained: 140 ms micro, 190 ms control, 260 ms route, and
  520 ms value durations.
- Buttons animate colors rather than large transforms, and hover styles are gated to a fine pointer.
- The period picker uses native popover on wide layouts and native modal dialog on compact layouts.
- The period picker has modern `@starting-style`, discrete `display`, and `overlay` transitions.
- Compact period-sheet backdrop entry is coordinated with the sheet, and closing returns focus to
  the trigger.
- KPI values preserve numeric continuity with directional digit rolls and expose one static value to
  assistive technology.
- Trend bars interpolate scale and dim non-active peers; keyboard focus creates the same tooltip as
  pointer inspection, while Enter/Space can pin and Escape can dismiss it.
- Expense-mix slices use small, compositor-friendly emphasis and give pointer and keyboard users the
  same selected data.
- Chart tables use native `<details>` plus `interpolate-size`, with a matching rotating disclosure
  marker.
- The budget attention queue expands with a bounded grid-row/opacity transition, rotates its marker,
  and correctly changes `inert`/`aria-hidden` state.
- Most meaningful motion is already disabled in the reduced-motion branch.
- There is no auto-running decorative motion on Overview.
- Theme and language changes are immediate. A full-page theme sweep is not required and should not
  be introduced as mandatory behavior.
- Responsive reflow is not animated, avoiding disorienting movement during viewport changes.

### Main gaps

- Route and period View Transition CSS is unreachable because no code starts a View Transition.
- The export menu animates only on entry; closing is an instant `display: none` in both wide and
  compact variants.
- Chart tooltips animate on insertion but are removed immediately, so no exit animation can run.
- Reduced-motion CSS does not explicitly cover the chart tooltip transition.
- Several Overview exit actions change routes instantly even though active-navigation morph and
  route snapshot CSS exist.
- The period request has `aria-busy` but no immediate visible pending feedback; on a slow local disk
  or cold request, a click can appear to do nothing.
- `.pressure-review` uses `transition: all`, which is too broad and makes future layout changes
  accidentally animatable.
- Generic actionable controls have hover feedback but no consistent touch/pointer press state.
- Picker month/year mode changes are instant, and expense-mix center copy swaps instantly. These are
  acceptable today but candidates for restrained optional polish.

## Complete Interaction Inventory

| Interaction or state | Current motion | Verdict | Goal |
| --- | --- | --- | --- |
| Initial settings load | Static centered loading copy | Keep | Remain immediate; optional subtle opacity only |
| Initial dashboard load | Static loading panel replaced by content | Keep | No mandatory staged card entrance |
| Dashboard error and Retry | Static alert; normal button color transition | Keep | Do not shake or flash errors |
| Previous/next month | Old data retained, then content swaps; rolling values and bars update | Required | Add directional period transition at data commit and visible pending feedback |
| Rapid repeated month clicks | Latest requested period wins; no blocking transition | Keep/Required | Preserve responsiveness; cancel or skip superseded visual transitions |
| Non-adjacent month selection | Instant content swap | Required | Use a short non-directional fade, not an arbitrary slide |
| KPI number changes | Directional 520 ms digit roll | Keep | Preserve, measure for layout stability, reduced motion stays static |
| Trend-bar value changes | Scale interpolation over 520 ms | Keep | Preserve; do not restart all bars unnecessarily |
| Budget progress value changes | Width transition exists but remounting can make it invisible | Required cleanup | Prove a visible update case or remove the dead transition |
| Period trigger, wide | Popover fades/translates in and out | Keep | Preserve modern top-layer lifecycle |
| Period trigger, compact | Dialog sheet and backdrop enter/exit; focus returns | Keep | Preserve native dialog behavior |
| Light dismiss, Escape, close button | Correct dismissal and focus behavior | Keep | Motion must never delay focus restoration beyond exit completion |
| Previous/next year | Content updates instantly | Keep | Immediate update is correct; no number-wheel effect |
| Month/year mode toggle | Chevron rotates; grid swaps instantly | Optional | Optional short shared-axis fade/translate |
| Previous/next year page | Year options swap instantly | Keep/Optional | Keep instant unless mode animation is implemented consistently |
| Month selection | Picker closes and period fetch begins | Required | Coordinate close, pending feedback, and later period commit without overlap |
| Export open, wide | 190 ms fade/translate keyframe; chevron rotates | Change | Convert to a two-way discrete transition |
| Export close, wide | Instant disappearance | Required | Animate opacity/translate out while remaining in top layer |
| Export open/close, compact | Entry keyframe; `hidden` causes instant exit | Required | Provide the same two-way lifecycle without turning it into a modal |
| Export artifact link | Hover/focus color only, then browser download | Keep | Do not delay or animate download initiation |
| Set budget | Instant route switch | Required | Participate in route transition and active-nav indicator handoff |
| Trend bar pointer move | Nearest bar activates; peers dim; tooltip appears | Keep | Preserve immediate tracking; do not add pointer-follow lag |
| Trend bar focus | Same active state and tooltip | Keep | Preserve exact pointer/keyboard parity |
| Trend bar touch | Pointer-down pins tooltip | Keep | Preserve; no hover-only dependency |
| Tooltip Enter/Space/Escape/outside/scroll | Pin/dismiss logic is correct; exit is instant | Required | Keep behavior and add a real exit lifecycle |
| Trend data-table disclosure | Size, opacity, and marker rotation | Keep | Preserve bounded native-details animation |
| Attention Show more/fewer | 260 ms expansion, 190 ms fade, marker rotation | Keep | Preserve `inert` and focusability semantics |
| Attention Review actions | Hover color, then instant Plan route | Required | Add press feedback and route transition |
| All transactions | Hover color, then instant Activity route | Required | Add press feedback and route transition |
| Recent activity rows | Static, non-interactive | Keep | Do not add hover lift or entrance stagger |
| Expense slice hover/focus | 1.055 scale, shadow, peer dimming | Keep | Preserve; no spring/bounce |
| Expense slice click/Enter/Space | Instant Activity route with category | Required | Use route transition; do not delay activation |
| Expense legend hover/focus | Background and linked slice/center update | Keep | Preserve immediate relationship feedback |
| Expense legend click | Instant Activity route with category | Required | Use route transition and add a press state |
| Expense table disclosure | Same native-details pattern | Keep | Preserve |
| Brand while already on Overview | No route/state change | Keep | Do not replay page entrance animation |
| Primary nav from Overview | Instant route switch | Required | Use one progressive route-transition path |
| Add entry | Routes to Activity and opens dialog | Required | Route first, then dialog; avoid overlapping route and modal motion |
| Language toggle | Instant content and layout update | Keep | Do not animate all translated text or layout |
| Theme toggle | Instant palette and icon update | Keep/Optional | Full-page theme animation remains out; icon-only polish is optional |
| Skip link and main focus | Native focus movement | Keep | Never delay or animate focus movement |
| Viewport reflow | Instant | Keep | Never animate breakpoint layout changes |

## Required Work

### P0 — Establish one real motion architecture

#### 1. Add a small, shared View Transition coordinator

Create one frontend utility or hook in `frontend/src/shared/` that:

- Feature-detects `document.startViewTransition`.
- Returns to a synchronous DOM/state update when unsupported.
- Skips View Transitions when `prefers-reduced-motion: reduce` matches.
- Accepts a semantic transition type rather than a selector or animation name.
- Supports route `forward`/`backward` direction and period
  `period-forward`/`period-backward`/`period-jump` types.
- Prevents stale type classes or attributes after completion, rejection, or interruption.
- Handles rapid repeated input by skipping/superseding the obsolete visual transition while still
  committing the newest application state.
- Never waits for a network request inside a View Transition callback.
- Keeps snapshot layers `pointer-events: none` so rapid input continues to reach live controls.

The implementation may use the typed `startViewTransition({ update, types })` API supported by the
Baseline 2026 target. If React requires a synchronous commit for a correct snapshot, use a narrowly
scoped `flushSync` at the coordinator boundary and document why. Do not spread `flushSync` through
features.

#### 2. Make existing View Transition CSS reachable or delete it

Wire the coordinator into route changes and period-data commits. Then audit every selector in the
View Transition section of `overrides.css`:

- Keep only names and types that can actually occur.
- Remove stale comments and selectors from earlier implementations.
- Ensure there is only one element with each active `view-transition-name` in a rendered state.
- Keep persistent rail/app-bar/bottom-navigation snapshots above content without frozen translucent
  artifacts.
- Keep old/new snapshot blending explicit so text never doubles or ghosts.
- Update tests that currently assert `startViewTransition` is never called. New tests must cover
  supported, unsupported, reduced-motion, rapid-navigation, and same-route paths.

#### 3. Animate period changes when new data commits

Do not start the transition when the user clicks a month control; the new data is not ready then.
Keep showing the prior successful data while the request runs. When the newest successful response
is ready:

- Capture direction from the previously presented period to the requested period before replacing
  the presented period.
- Start a short View Transition around the synchronous presented-data commit.
- Slide content by only the existing small `0.35rem` distance for adjacent months.
- Use a non-directional fade for a picker jump.
- Keep the period heading and narrative legible without overlapping snapshots.
- Allow the rolling-number and trend-bar transitions to begin after the new live DOM is committed;
  do not double-animate them inside opaque full-page snapshots.
- Ensure error responses retain the last successful period without replaying value motion.
- Ensure a refetch of the same period does not trigger directional motion.

`usePeriodTransition.direction` is currently calculated but not consumed and becomes `null` after a
successful commit. Fix its lifecycle or replace it with a clearer committed transition descriptor.
Do not leave it as dead state.

#### 4. Animate route changes leaving Overview

Apply one route transition to primary navigation, Brand when it actually changes route, Set budget,
budget review, All transactions, expense category selection, and Add entry.

- Determine direction from the stable `viewOrder`; history back/forward must use history direction
  when it can be known reliably, otherwise use a neutral transition.
- Keep travel subtle: at most a few pixels plus opacity, 220–260 ms.
- Morph the active navigation indicator only when both old and new routes expose it.
- Move programmatic focus to the new `main`/heading after the transition's DOM update, not after a
  decorative timeout.
- When Add entry changes route and then opens a dialog, finish or skip the route transition before
  starting top-layer dialog entry so the two effects do not compete.
- Same-route activation does nothing and must not replay motion.

### P0 — Complete top-layer and transient lifecycles

#### 5. Replace the export entry keyframe with a two-way transition

The export panel must transition both in and out.

- Wide popover: transition `opacity`, a small `translate`, `display`, and `overlay`; use
  `transition-behavior: allow-discrete` and `@starting-style`.
- Compact non-popover: preserve `hidden` semantics, but use a discrete `display` transition so the
  panel remains rendered during exit.
- Include `overlay` only on the actual top-layer variant.
- Keep the chevron rotation synchronized with the panel duration.
- Restore focus to the trigger for keyboard Escape dismissal; do not steal focus on ordinary
  pointer light-dismiss.
- Preserve outside pointer, scrolling constraints, anchored positioning, and download behavior.
- Under reduced motion, close/open instantly or with a maximum 100 ms opacity-only fade; no travel or
  rotation.
- Remove `artifact-popover-enter` if no caller remains.

#### 6. Give chart tooltips a real exit state

The tooltip is currently conditionally removed, so its exit transition cannot run.

- Keep a tooltip container mounted long enough to transition to a hidden state, or coordinate
  removal by waiting for its own finite animations with a short failsafe.
- Prefer the mounted hidden-state approach because pointer movement can switch targets rapidly.
- Use `@starting-style` for entry and a discrete `display` transition if the hidden state uses
  `display: none`.
- Preserve immediate content/position updates when moving between bars; do not replay a full entry
  animation on every nearest-bar change.
- Exit only when inspection truly ends: blur outside the bar group, Escape, scroll, or outside pointer
  for a pinned touch tooltip.
- Explicitly remove tooltip movement under reduced motion.
- Keep the tooltip visual-only and non-interactive; the bar's accessible name remains authoritative.

### P1 — Improve immediate feedback and CSS safety

#### 7. Add visible pending feedback to period controls

`aria-busy` is correct but not visible. Add a restrained busy state adjacent to or within the period
control while retained data is being shown.

- The control must acknowledge input within one animation frame.
- Do not cover or fade the whole dashboard; stale data should remain readable.
- Do not disable previous/next controls because rapid stepping is deliberately supported.
- Prefer a static status mark or a short, low-salience progress indicator.
- If rotation or indeterminate motion is used, stop it under reduced motion and show a static busy
  glyph/state instead.
- Clear pending feedback only when the newest request succeeds or fails; an older response must not
  clear it.

#### 8. Add a consistent press state

Add touch/pointer press feedback to actionable Overview controls that currently expose only hover
feedback: primary/secondary/ghost buttons, icon buttons, period options, export links, expense legend
buttons, and navigation links.

- Use a quick color/border change or at most a very small `scale`/`translate` on the pressed element.
- Never move adjacent layout or shrink a full panel.
- Do not apply press motion to disabled controls.
- Do not require hover capability.
- Remove any spatial press transform under reduced motion while retaining a color/state change.
- Keep native focus-visible outlines visually distinct from pressed state.

#### 9. Replace broad transitions

- Replace `.pressure-review { transition: all ... }` with the exact properties that change.
- Search all Overview-reachable styles for `transition: all` and eliminate them.
- Add `will-change` only to an element during a proven expensive animation; do not leave widespread
  permanent layer promotion.
- Check whether budget progress width transition has a real update lifecycle. If it does, test it; if
  it does not, remove it instead of retaining aspirational CSS.

### P1 — Complete reduced-motion coverage

#### 10. Audit every Overview animation under reduced motion

The reduced-motion test must confirm:

- No route or period View Transition animation runs.
- Rolling values render the final value immediately.
- Trend bars and expense slices update without interpolation.
- Tooltip, export panel, period picker/sheet, modal, attention disclosure, and chart-data disclosure
  do not travel, scale, or rotate.
- Spinner/shimmer effects are stopped or replaced by a static state.
- Press feedback remains clear without spatial movement.
- No animation flashes more than three times per second.

Use explicit selectors for components with motion. Do not depend on a global `* { animation: none }`
rule that can break native control behavior or future scoped components.

## Things to Preserve Without Change

The implementation agent must not remove these merely to simplify the motion system:

- Retained previous-period data while a new request loads.
- Rapid period stepping before React has rendered the previous click.
- Native popover/dialog semantics and wide/compact behavior split.
- Escape, light-dismiss, backdrop-click, focus-return, and arrow-key behavior in the period picker.
- Directional rolling numbers with static screen-reader output.
- Keyboard/touch/pointer parity for trend inspection.
- Touch pinning and outside/scroll dismissal of chart tooltips.
- `inert` and `aria-hidden` changes on collapsed attention content.
- Native `<details>` semantics and accessible data-table alternatives.
- Expense category activation by click, Enter, and Space.
- Instant language reflow and instant breakpoint reflow.
- No ambient animation on recent activity or static panels.

## Optional Improvements

These may be implemented only after all required acceptance criteria pass.

### Picker mode transition

Use a 120–160 ms shared-axis transition between month and year grids. The outgoing grid may fade a
few pixels while the incoming grid fades in. Preserve roving focus, avoid height jumps, and make
rapid toggles settle on the latest mode. Reduced motion is instant.

### Theme icon transition

Crossfade or rotate only the sun/moon icon over at most 140 ms. Do not animate the full-page color
scheme, use a circular wipe, or snapshot sensitive page content. Reduced motion swaps instantly.

### Expense-mix center-copy continuity

Apply a short opacity transition when the active category changes. Do not delay the numeric update,
animate every digit, or replay slice entry motion.

### First-success reveal

A single 140–190 ms opacity reveal for the complete Overview after the first successful load is
acceptable if it does not stagger sections or hide useful content. Do not run it on cached/refetched
period data, locale changes, or browser back navigation.

### Value-motion refinement

After measurement, reduce the rolling-number duration if 520 ms feels sluggish during rapid period
changes. Keep the animation monotonic and restrained; do not add bounce or spring overshoot to money.

## Explicitly Do Not Add

- Scroll-triggered entrance animations for panels or activity rows.
- Parallax, continuous gradients, pulsing cards, count-up-on-every-render, or looping chart motion.
- Bounce/spring overshoot on financial values, errors, or budget warnings.
- Whole-page blur, large-area filter animation, or animated backdrop blur.
- Full-screen theme View Transitions as required behavior.
- A third-party animation or gesture library.
- A JavaScript fallback that emulates View Transitions for unsupported browsers.
- Arbitrary delays whose only purpose is to make an animation visible.
- Animation as the only signal for loading, error, selection, or budget status.

## Expected File Scope

The exact structure may change, but the likely files are:

- `frontend/src/app/App.tsx` — route transition coordination and focus timing.
- `frontend/src/app/AppShell.tsx` — navigation metadata/press state only if needed.
- `frontend/src/features/dashboard/DashboardView.tsx` — pending indicator and Overview transition
  integration.
- `frontend/src/shared/hooks/usePeriodTransition.ts` — correct direction/commit lifecycle.
- `frontend/src/shared/components/PeriodControl.tsx` — pending presentation only if the API is extended.
- `frontend/src/shared/components/RollingNumber.tsx` — only if measurement finds lifecycle defects.
- `frontend/src/shared/charts/ChartTooltip.tsx` — mounted/closing tooltip lifecycle.
- `frontend/src/shared/styles/tokens.css` — motion tokens only; do not duplicate raw durations.
- `frontend/src/shared/styles/components.css` — control, popover, tooltip, disclosure motion.
- `frontend/src/shared/styles/overrides.css` — View Transition and reduced-motion rules.
- `frontend/src/App.test.tsx`, dashboard/hook/chart/component tests — behavioral coverage.
- `frontend/e2e/` — real-browser animation, focus, reduced-motion, and responsive checks.

Place any shared View Transition helper under `frontend/src/shared/`; features may import it without
cross-feature dependencies. Do not move domain or data-fetching rules into animation utilities.

## Test Requirements

### Unit and component tests

Add or update tests for:

1. View Transition supported versus unsupported.
2. Reduced motion bypassing View Transitions.
3. Same-route navigation not starting a transition.
4. Route direction derived from `viewOrder`.
5. Adjacent forward, adjacent backward, and jump period types.
6. New data committing only after the successful resource belongs to the newest request.
7. Rapid period requests not presenting stale data or stale direction.
8. Tooltip opening, target-to-target update, pinning, closing state, and final removal/hide.
9. Export entry/exit state and focus behavior.
10. Compact sheet close, Escape, backdrop click, and trigger focus return.
11. Reduced-motion final states for rolling number, tooltip, popover, disclosure, and press feedback.
12. No `transition: all` in Overview-reachable CSS, enforced by stylelint or the CSS architecture
    check if practical.

Do not assert arbitrary timeouts. Assert state, transition type/class, final visibility, focus,
attributes, and cleanup.

### End-to-end matrix

Run at minimum:

| Axis | Cases |
| --- | --- |
| Viewport | 390×844, 768×1024, 1280×800, 1440×900 |
| Input | Fine pointer, keyboard only, touch/coarse-pointer emulation |
| Motion | `no-preference`, `reduce` |
| Theme | Light, dark, system-derived |
| Locale | English, Turkish |
| Data | Populated month, empty month, error/retry, slow retained-data response |
| Navigation | Overview→Activity, Overview→Plan, Overview→Automations, browser Back/Forward |
| Period | Previous, next, year boundary, picker jump, rapid five-click sequence |

For animation assertions, sample both an in-progress state and the settled state using
`getAnimations()`/computed styles in a real supported browser. Keep tolerances around tokens rather
than hard-coding frame-perfect values.

### Visual checks

Verify manually or with focused screenshots that:

- No old/new heading or monetary value is readable at the same time during a snapshot transition.
- Compact persistent chrome stays above moving content.
- Popovers do not clip, jump to a fallback position mid-transition, or remain in the top layer after
  closing.
- A tooltip does not trail the pointer or leave a ghost after Escape/scroll.
- Rolling numbers do not change line height or cause adjacent copy to jump.
- Attention disclosure does not expose focusable collapsed buttons.
- Turkish labels do not clip while pressed or transitioning.
- Dark-mode drop shadows and dimmed chart peers remain legible.

### Performance checks

- Use DevTools or a trace to verify route/period motion is compositor-led except for the two bounded
  disclosures that intentionally animate document size.
- Confirm no long animation task materially worsens INP.
- Confirm no animation causes unexpected CLS.
- Confirm rapid period changes do not accumulate animations, event listeners, or retained snapshots.
- Confirm `will-change` layers are not permanently allocated across the whole dashboard.

## Verification Commands

Run the complete project frontend checks after implementation:

```bash
npm test
npm run lint
npm run format:check
npm run build
npm run check:bundle
npm run test:e2e
```

Run the full-stack Overview scenarios when backend integration or request timing behavior changes:

```bash
npm run test:e2e:fullstack
```

Also run the repository-wide checks required by `AGENTS.md` if shared Python/static output or
documentation beyond this goal changes.

## Acceptance Criteria

The goal is complete only when all of the following are true:

- [ ] Route transitions are actually started in supported/no-preference browsers and bypassed
      everywhere else.
- [ ] Every existing View Transition selector and type has a reachable caller and a test, or has
      been removed.
- [ ] Adjacent period changes communicate direction; picker jumps use a neutral fade.
- [ ] A period request gives immediate visible feedback without hiding retained data or disabling
      rapid stepping.
- [ ] Superseded period requests/transitions cannot overwrite or visually replay stale data.
- [ ] Export panels animate entry and exit on wide and compact layouts.
- [ ] Chart tooltips have entry and exit lifecycles without pointer lag or stale ghosts.
- [ ] Add entry, Set budget, budget review, All transactions, expense category actions, primary nav,
      and browser history remain functionally correct through route motion.
- [ ] Focus lands correctly after route, popover, sheet, tooltip, and dialog transitions.
- [ ] Buttons and links provide consistent pressed feedback on touch and pointer input.
- [ ] No Overview-reachable rule uses `transition: all`.
- [ ] Reduced motion removes spatial/continuous motion and leaves every state understandable.
- [ ] No static panel, activity row, or financial warning receives decorative ambient motion.
- [ ] Light/dark themes, English/Turkish, narrow/wide layouts, keyboard, pointer, and touch all pass.
- [ ] Unit, lint, format, build, bundle, and end-to-end checks pass.
- [ ] The implementation contains no new animation dependency or legacy polyfill.

## Definition of Done for the Implementing Agent

Before declaring completion, the agent must provide:

1. A concise list of preserved, changed, removed, and optional-skipped behaviors.
2. Test evidence for normal and reduced motion at wide and compact viewports.
3. Confirmation that every Overview interaction in the inventory was rechecked.
4. A list of any intentional deviation from this goal with the measured or accessibility reason.
5. Confirmation that dead motion CSS, unused direction state, obsolete keyframes, and stale tests were
   removed.

Passing tests alone is not sufficient. The final result must also be visually inspected in a real
View Transition-capable Baseline 2026 browser.
