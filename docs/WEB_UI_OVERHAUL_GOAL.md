# Web UI Overhaul Goal

## Document Status

- **Status:** Proposed product and implementation goal
- **Scope:** Complete redesign of the React Web UI
- **Target:** Baseline 2026 browsers defined in `AGENTS.md`
- **Primary audience:** Contributors, reviewers, and portfolio visitors
- **Architecture boundary:** Frontend experience only unless a documented UX requirement exposes a
  small, justified API gap
- **Source of truth for:** Product intent, experience direction, delivery phases, and acceptance
  criteria for the overhaul

## Goal

Replace the current Web UI with a deliberately designed, contemporary personal-finance workspace
that feels authored rather than assembled from generic dashboard patterns. This is a ground-up
experience redesign, not a reskin. Navigation, information architecture, page composition,
interaction models, typography, color, spacing, data visualization, motion, responsive behavior,
content, empty states, and workflow sequencing are all in scope.

The finished interface should make the project immediately credible as a 2026 portfolio piece while
remaining a practical, understandable, local-first finance tracker. A reviewer should be able to see
design judgment, frontend engineering depth, accessibility discipline, and product thinking within
the first minute of use.

## Why This Work Exists

The current UI is functional and has solid workflow coverage, but its presentation is dominated by
an older dashboard template vocabulary:

- Most information is placed in visually similar bordered cards, weakening hierarchy.
- The dashboard presents too many metrics and panels with nearly equal emphasis.
- Navigation, period selection, downloads, and primary actions compete for attention.
- Typography, iconography, spacing, and color communicate utility but not a distinct identity.
- Tables, forms, filters, charts, and status indicators feel like separate controls rather than one
  coherent product system.
- The interface exposes the application's features, but does not consistently guide the user toward
  the next useful financial decision.
- Responsive behavior compresses the desktop composition rather than fully reconsidering workflows
  for small and touch-based screens.

Preserving the existing visual language and adjusting individual components would retain these
structural problems. The overhaul must begin with user tasks and information priority, then produce a
new system around them.

## Product Outcome

The new Web UI should feel like a calm, precise financial journal with the analytical clarity of a
professional tool. It should be information-rich without being visually crowded, expressive without
becoming decorative, and animated without slowing routine work.

The user should be able to:

1. Understand the selected period's financial position in seconds.
2. See the most important change, risk, or opportunity without scanning every panel.
3. Add or find a transaction with minimal navigation and no ambiguous controls.
4. Understand budget pressure and act on it from the same context.
5. Configure category and recurring rules without confronting an undifferentiated settings page.
6. Import, review, and export data with clear previews, consequences, and recovery paths.
7. Use every core workflow by keyboard, touch, pointer, or assistive technology.
8. Move between English and Turkish, light and dark themes, and narrow and wide layouts without loss
   of meaning or capability.

## Experience Principles

### 1. Decision-first, not widget-first

Every screen starts with the question the user is trying to answer. Components exist to support that
answer; they are not arranged simply because data is available.

### 2. One clear emphasis per view

Each route has one dominant region and one obvious primary action. Secondary actions remain
available but visually quieter. Card grids must not be the default page structure.

### 3. Progressive disclosure

Show the summary first, reveal detail on demand, and keep advanced controls close to the context in
which they matter. Filters, downloads, and destructive actions should not permanently occupy prime
screen space.

### 4. Finance without anxiety

Use neutral, direct language and measured visual signals. Negative values and over-budget states must
be clear without turning the entire interface red or using shame-oriented copy.

### 5. Motion explains change

Animation communicates navigation, hierarchy, state change, or data continuity. It must never be
ambient decoration, a delay before interaction, or a substitute for clear layout.

### 6. Native platform capabilities first

Use semantic HTML and modern browser primitives where they improve the experience: Navigation API,
Popover API, native dialogs, same-document View Transitions, container queries, `@scope`,
`@starting-style`, and discrete transitions. All are progressive enhancements; core workflows must
remain usable if an enhancement is unavailable.

### 7. Local-first is visible

Local storage is a trust advantage, not a technical badge competing with the page title. Explain it
briefly in a calm data-status surface and make data ownership, import, export, and deletion behavior
easy to understand.

### 8. Distinct, not fashionable by checklist

Avoid the recognizable “generated dashboard” recipe: blue-purple gradients, excessive pills,
floating glass cards, arbitrary glow, uniform rounded rectangles, oversized marketing copy, and
motion on every element. The design may use contemporary capabilities without imitating a landing
page or banking SaaS template.

## Audiences and Core Jobs

### Primary user: the local ledger owner

- Capture an expense or income entry quickly.
- Review recent activity and correct mistakes.
- Compare actual spending with monthly intent.
- Identify meaningful month-over-month changes.
- Maintain recurring entries and category normalization.
- Move data into or out of the application confidently.

### Secondary user: the portfolio reviewer

- Understand the product without reading documentation first.
- Discover the depth of supported workflows through coherent navigation.
- See responsive, accessible, localized, and animated behavior working as one system.
- Confirm that visual ambition does not compromise code organization or performance.

## New Information Architecture

Use four stable top-level destinations. Labels describe user concepts, not implementation modules.

| Destination | Route | Purpose | Primary action |
| --- | --- | --- | --- |
| Overview | `/` | Read the selected period, changes, risks, and recent activity | Add transaction |
| Activity | `/transactions` | Search, filter, add, edit, import, export, and inspect ledger entries | Add transaction |
| Plan | `/budgets` | Compare planned and actual spending, then create or revise budgets | Set budget |
| Automations | `/rules` | Manage category normalization, recurring entries, and ledger preferences | Context-dependent |

“Dashboard,” “Transactions,” “Budgets,” and “Rules” may remain internal feature names during
migration, but user-facing navigation should use the task-oriented labels above after copy review.

### Global shell

- Desktop uses a narrow, persistent left rail with identity, destinations, a prominent create action,
  and utilities anchored at the bottom. It may expand at larger container widths but must not consume
  content space merely to display labels.
- Compact layouts use a top app bar plus a native-feeling navigation drawer in the top layer. The
  drawer supports Escape, light dismissal, focus transfer, correct `inert` behavior, and touch
  gestures where they can be implemented without fragile pointer-event code.
- The current route and page heading are unambiguous. Route changes move focus to the new heading.
- Theme, language, data status, and help/about information live in a utility menu instead of four
  equal-priority header controls.
- A global “Add transaction” command is reachable from every primary route. On compact screens it is
  placed within easy thumb reach without covering content or the last row.
- Browser history, deep links, modified clicks, refresh, and not-found behavior continue to work.

## Route Experience Definitions

### Overview

The overview is an editorial summary, not a wall of widgets.

1. **Period narrative:** A concise heading states the selected month and its most important outcome,
   such as positive cashflow, overspend, or a material shift. Period navigation is adjacent and does
   not dominate the page.
2. **Primary balance story:** Income, expenses, and net are presented as one comparative composition,
   not three unrelated cards. Values retain full precision where decisions require it.
3. **Trend:** One strong six-month chart provides continuity and direct comparison. It includes an
   accessible table alternative and useful hover, focus, and touch inspection.
4. **Attention queue:** Budget risks and unusual changes are ranked by urgency and impact. If nothing
   needs attention, the UI says so instead of reserving empty warning space.
5. **Recent activity:** A short, scannable ledger preview supports a direct path to the full activity
   view.
6. **Secondary analysis:** Category mix and report downloads are available after the primary story,
   through disclosure or contextual menus rather than competing above the fold.

Remove redundant KPI repetition. A metric appears once unless the second occurrence answers a
different question.

### Activity

- The default view is a readable chronological ledger with sticky date or period grouping and clear
  income/expense differentiation that does not rely on color alone.
- Search is immediately available. Advanced filters open in an anchored popover on wide screens and
  a modal sheet on compact screens.
- Active filters appear as a concise summary with one-click removal and a clear-all action.
- Add and edit use the same validated form model. Desktop may use a side sheet to preserve ledger
  context; compact screens use a full-height dialog/sheet with a stable action region.
- Row actions appear on hover and focus without making touch actions undiscoverable.
- Delete requires explicit confirmation containing the entry's identifying details and returns focus
  predictably after completion or cancellation.
- Import is a staged workflow: choose file, preview classification, resolve or acknowledge issues,
  confirm consequences, show result. Valid, invalid, duplicate, and normalized rows are visually and
  textually distinct.
- Export belongs to a contextual data menu with an explicit statement of whether filters affect the
  exported result.
- Large result sets remain responsive through pagination already supported by the API; virtualization
  should be added only if measured data demonstrates a need.

### Plan

- Begin with “planned versus spent” for the chosen month, not with the budget-editing mechanism.
- Show total planned, total spent, remaining amount, and uncovered spending as one coherent summary.
- Category rows communicate absolute values, proportional use, status, and remaining/over amount.
- Status order prioritizes over-budget and near-limit categories while preserving a user-controlled
  sort option.
- Selecting a category reveals useful context and a direct edit action without navigating away.
- Creating or updating a budget uses visible labels, correct money input behavior, contextual help,
  and a clear description of replacement semantics.
- Empty states distinguish “no budgets exist,” “no spending exists,” and “filters match nothing.”
- Decorative progress bars are not the sole representation of status; text values and status labels
  remain present.

### Automations

Replace the single mixed “Rules” page with internal tabs that represent distinct tasks:

- **Categories:** Alias-to-canonical mappings, examples of affected data, create/edit/delete actions.
- **Recurring:** Template list, active state, next applicable period, create/edit/delete/apply actions.
- **Preferences:** Ledger currency and other genuinely global ledger settings.

These are tabs because they switch peer sections inside one destination. Tabs use the expected ARIA
pattern, arrow-key navigation, persistent deep-linkable state (path segment or query parameter), and
do not become a generic substitute for buttons or filters.

Recurring-template application must preview what will be created and what will be skipped before the
user commits the operation. Destructive or bulk consequences should never be hidden in a toast.

## Visual Direction

### Concept: “Ledger editorial”

The visual system combines the rhythm and precision of a well-typeset financial ledger with a warm,
contemporary digital workspace. Structure comes from typography, alignment, whitespace, rules, and
tonal surfaces—not from enclosing every region in a card.

### Typography

- Use **Instrument Sans Variable** for interface and editorial display text, self-hosted and
  subsetted to the Latin and Turkish glyphs required by the product.
- Use **IBM Plex Mono** for tabular figures, dates, percentages, import diagnostics, and other compact
  data—not for body copy or every control.
- If licensing, bundle size, or Turkish glyph quality fails validation, choose replacements by those
  criteria before implementation; do not silently fall back to a generic product-font stack.
- Enable tabular numerals for financial columns and align decimals where practical.
- Use a restrained type scale with clearly different roles for page title, narrative metric, section
  heading, body, label, and annotation. Avoid tiny uppercase text as the main source of hierarchy.
- Body text remains at least `1rem`; form inputs remain at least `1rem` to prevent mobile zoom.

### Color

Build tokens in perceptual `oklch()` space with sRGB fallbacks generated at build time where needed.
The initial palette direction is:

- **Ink:** deep blue-black for primary text and dark surfaces.
- **Paper:** warm near-white rather than clinical pure white.
- **Cobalt:** focused interactive accent and selection state.
- **Jade:** positive cashflow and healthy status.
- **Vermilion:** expense and destructive state.
- **Amber:** attention and near-limit state.

Color roles—not raw palette names—are consumed by components. Light and dark themes are designed
independently from the same semantic roles; dark mode is not a mechanical inversion. Every text,
icon, focus, border, chart, and state pairing must meet its applicable WCAG contrast requirement.
Positive/negative meaning always includes a label, sign, icon, position, or pattern in addition to
color.

### Shape, elevation, and texture

- Use a small radius family with sharper data surfaces and slightly softer transient surfaces.
- Prefer borders, tonal separation, and whitespace to persistent drop shadows.
- Reserve elevation for top-layer UI, sticky controls, and genuinely overlapping elements.
- Permit one subtle ledger/grid texture or rule treatment in selected large surfaces, provided it
  remains quiet, theme-safe, and absent under reduced-transparency/high-contrast preferences.
- Icons share one stroke system and support labels; they do not replace unfamiliar financial terms.

### Spacing and layout

- Establish a consistent base spacing unit and fluid page gutters using `clamp()`.
- Use a readable maximum content width while allowing charts and ledgers to use wider tracks.
- Use CSS Grid for page composition and container queries for component adaptation.
- Components respond to their available container, not only the viewport.
- Use logical properties so layout is structurally ready for future bidirectional text even though
  English and Turkish are currently left-to-right.

## Component System

Create a small, documented UI foundation in `frontend/src/shared/` before rebuilding feature pages.
It should include:

- Button and icon-button variants with consistent pending, pressed, disabled, destructive, and focus
  states.
- Link, navigation item, segmented control, and true tab patterns with distinct semantics.
- Field primitives for text, money, date, select, radio, checkbox, switch, help, error summary, and
  inline validation.
- Dialog, alert dialog, side sheet, compact bottom/full-height sheet, popover, menu, and tooltip
  primitives based on native top-layer behavior where appropriate.
- Page header, section header, metric composition, status marker, empty state, skeleton, notice, and
  error recovery patterns.
- Data table and compact ledger-list presentations sharing one data model but using layouts suited to
  their containers.
- Chart frame, legend, tooltip, focus cursor, annotation, empty state, and accessible data table.
- Toasts only for brief, noncritical confirmations. Errors and consequences that require action stay
  in context.

Component variants must solve demonstrated product needs. Do not create a large speculative design
system or add a general-purpose component framework simply to accelerate the first pass.

## Forms and Validation

- Use semantic `<form>`, `<fieldset>`, `<legend>`, `<label>`, and native inputs.
- Every control has a stable `name`, visible label, programmatic description, and translated error
  path where applicable.
- Expose up to five exclusive options as radios when space permits; use a select or searchable native
  pattern for longer lists.
- Validate after blur and on final submission; while the user corrects a field, clear resolved errors
  without producing new warnings on every keystroke.
- On failed submission, present a summary, focus it, and link each issue to the relevant field.
- Keep submit controls available until a valid submission begins; then lock duplicate submission and
  expose progress without changing layout.
- Money fields use decimal-friendly input modes and retain the project's exact decimal semantics.
- Touch targets are at least 48 CSS pixels, with larger coarse-pointer targets where needed.
- The mobile keyboard must not cover the focused field or final action region.

## Motion and Interaction Language

Define motion tokens for duration, easing, distance, and sequencing. The default language should feel
quick and composed:

- Micro state changes: approximately 100–160 ms.
- Popovers, menus, and controls: approximately 160–220 ms.
- Sheets and route-level transitions: approximately 220–320 ms.
- Avoid long stagger sequences; important content becomes usable immediately.

Use same-document View Transitions for a limited set of relationships: active navigation indicator,
selected period heading, a ledger row opening into its edit surface, and route content replacement.
Each transition name must be unique in both states and temporary names must be cleaned up. Do not
apply shared-element transitions to every card or chart mark.

Motion requirements:

- Focus moves to the new page heading after route changes, including when a view transition runs.
- Dialog and sheet focus is trapped/restored by the appropriate native or tested primitive.
- Entry/exit animations use `@starting-style` and discrete transitions when supported.
- Charts animate only when animation helps users track a data change; initial page load does not draw
  every mark slowly for spectacle.
- `prefers-reduced-motion: reduce` removes spatial transforms, parallax, smooth scrolling, and View
  Transition animation while preserving immediate state changes.
- No essential information is revealed only through hover, animation, or transient timing.

## Responsive Strategy

Design and test at capability ranges rather than named devices:

- **Compact:** single-column reading order, drawer navigation, touch-first actions, sheets instead of
  anchored multi-column dialogs, ledger rows instead of squeezed tables.
- **Medium:** compact rail or app bar, mixed one/two-column content, contextual popovers where space
  permits.
- **Wide:** persistent rail, controlled content width, denser ledger tables, and complementary
  analysis regions shown side by side only when they remain related.

Use container queries for metrics, filter bars, chart legends, tables, and action groups. Test narrow
windows with long Turkish labels, 200% zoom, large text, landscape mobile, safe-area insets, coarse
pointers, and virtual keyboards. Horizontal scrolling is acceptable for intrinsically tabular data
only when accompanied by a visible scroll affordance and a usable compact alternative.

## Accessibility Quality Bar

Target WCAG 2.2 AA as the minimum, including:

- Complete keyboard operation, logical focus order, persistent visible focus, and no keyboard traps.
- Correct landmarks, heading hierarchy, names, descriptions, relationships, live regions, and
  current/expanded/selected states.
- Route-change and View Transition focus routing.
- Native semantics before ARIA; ARIA patterns are implemented completely when native semantics are
  insufficient.
- Pointer targets of at least 24 by 24 CSS pixels under WCAG minimums and a project design target of
  48 by 48 for primary touch controls.
- Text reflow at 400% zoom without loss of content or function, except essential two-dimensional data.
- No information encoded by color alone and no interaction dependent only on hover.
- Accessible chart summaries and equivalent data tables.
- Language and localized number/date/currency announcements verified in English and Turkish.
- Forced-colors, reduced-motion, reduced-transparency where supported, and light/dark preference
  testing.

Automated scans are a gate, not proof. Manual screen-reader, keyboard-only, zoom, and touch testing
are required for the primary workflows.

## Content and UX Writing

- Use plain, concise financial language. Prefer “Add transaction” to vague labels such as “Add entry.”
- Explain the consequence of actions at the decision point, especially imports, recurring
  application, overwrites, and deletion.
- Distinguish loading, initial empty, filtered empty, unavailable, validation error, and server error
  states.
- Provide a useful next action in empty states without turning every empty surface into an
  illustration or marketing panel.
- Keep English and Turkish strings semantically equivalent, not mechanically identical.
- Avoid all-caps labels except conventional compact data notation where localization and readability
  have been verified.

## Data Visualization Standard

- Start each chart with the question it answers and choose the simplest encoding that answers it.
- Use consistent semantic colors across charts and surrounding totals.
- Axes, baselines, comparison periods, units, and zero/negative values remain explicit.
- Tooltips work with pointer, keyboard focus, and touch; they are supplemental, not the only place
  exact values appear.
- Use direct labels when they reduce legend lookup.
- Avoid 3D effects, decorative gradients, dual axes without a compelling need, and animation that
  distorts comparison.
- Charts must handle empty, single-point, all-zero, extreme-value, negative, and dense-label data.
- Every chart includes an accessible name, concise textual insight, and a table or equivalent list of
  the plotted values.

## Frontend Architecture Constraints

The overhaul must preserve the repository's established dependency direction:

- `app/` owns shell, navigation, route composition, and global settings.
- `features/` own route workflows and may import only `api/` and `shared/`, never other features.
- `api/` remains the browser transport boundary; only `api/client.ts` calls `fetch`.
- `shared/` owns reusable UI foundations, charts, hooks, formatting, i18n, theme, and styles.
- FastAPI and domain behavior remain unchanged unless a specific experience cannot be delivered from
  current data. Any API addition must be separately scoped and tested.
- Do not add a component framework, server-state library, animation framework, CSS-in-JS runtime, or
  global state library without a short architecture decision proving the need and bundle impact.

The existing UI must be replaced incrementally behind stable route and API contracts. Avoid a
long-lived parallel “v2” application or duplicated business workflows.

## CSS and Theme Architecture

- Replace the current large component stylesheet with explicit cascade layers such as reset, tokens,
  base, objects/layout, components, features, and utilities.
- Scope component styles with `@scope` where it improves ownership and does not obscure reusable
  state rules.
- Semantic custom properties form the public styling contract. Feature CSS must not consume raw
  palette values.
- Component state is expressed through attributes and platform pseudo-classes before bespoke class
  flags.
- Use `:focus-visible`, `:user-invalid`, `:has()`, logical properties, container queries, and native
  nesting according to the Baseline 2026 target.
- Minimize global selectors and specificity escalation. `!important` is reserved for documented
  accessibility overrides such as reduced-motion enforcement.
- Light, dark, forced-color, and print/report-related behavior are considered at component creation,
  not patched after route completion.

## Performance and Stability Budgets

Measure both the static hosted showcase and the local FastAPI-backed application on representative
desktop and mid-tier mobile conditions.

- Meet Core Web Vitals “good” thresholds at the 75th percentile target: LCP at or below 2.5 seconds,
  INP at or below 200 ms, and CLS at or below 0.1.
- Route shell and primary action become interactive without waiting for below-the-fold charts.
- No layout shift from font loading, icon loading, skeleton replacement, chart sizing, sticky bars,
  or dialog opening.
- Self-hosted fonts are subsetted, preloaded only when critical, and use metrics-compatible fallback
  behavior.
- Defer offscreen analytical sections with `content-visibility` or route-level lazy loading only when
  measurement shows a benefit and accessibility/find-in-page behavior remains correct.
- Keep production JavaScript within the repository's bundle check. Any budget increase requires a
  recorded explanation and before/after measurement.
- Avoid permanent scroll listeners for visual effects; prefer CSS, Intersection Observer, Resize
  Observer, or container queries as appropriate.
- Long-running mutations expose progress and remain protected from double submission.

## Delivery Plan

### Phase 0: Audit and product definition

- Inventory every route, workflow, state, API dependency, component, translation key, and automated
  test.
- Perform a heuristic UX, accessibility, responsive, and content audit of the current interface.
- Record baseline screenshots, bundle output, Lighthouse/Web Vitals observations, and keyboard paths.
- Define representative demo data that exercises positive, negative, empty, dense, and error states.
- Produce low-fidelity route flows before visual styling begins.

**Exit gate:** Approved information architecture, workflow inventory, prioritized user journeys, and
baseline evidence.

### Phase 1: Visual language and interaction prototypes

- Create moodboard and type/color studies grounded in the “ledger editorial” direction.
- Prototype the shell, overview composition, ledger row/table, budget row, form, dialog/sheet, and
  chart interaction at compact and wide sizes.
- Validate English/Turkish fit, light/dark themes, keyboard flow, reduced motion, and touch behavior.
- Finalize semantic tokens and motion rules only after prototype review.

**Exit gate:** One coherent visual direction and approved prototypes for the highest-risk patterns.

### Phase 2: Shared foundation

- Implement tokens, fonts, theme foundation, layered CSS, focus behavior, and layout primitives.
- Implement and test buttons, fields, tabs, menus, popovers, dialogs, sheets, notices, status markers,
  tables/lists, and chart frames.
- Rebuild the application shell and navigation with route focus management and progressive View
  Transitions.
- Add a development-only component/state gallery if it materially speeds visual and accessibility
  verification; do not ship it as a user route.

**Exit gate:** Shared primitives pass unit, accessibility, theme, locale, motion, and responsive
checks before feature migration.

### Phase 3: Core route migration

Migrate in dependency and user-value order:

1. Activity, establishing ledger, form, filters, import, and destructive-action patterns.
2. Plan, establishing comparative rows and category detail behavior.
3. Overview, composing stable primitives into the final decision-first summary.
4. Automations, introducing deep-linkable task tabs and settings workflows.

Remove superseded CSS and components as each route lands. Do not leave two active visual systems.

**Exit gate:** Every existing browser workflow is available in the new system with no known
regression in local-first behavior, localization, or accessibility.

### Phase 4: Motion, resilience, and edge states

- Add restrained View Transitions and component entry/exit behavior after layouts are stable.
- Complete loading, empty, filtered-empty, offline/unavailable, validation, permission, and server
  error states.
- Test extreme currency values, long categories, dense imports, narrow Turkish copy, slow responses,
  repeated actions, and cancellation.
- Tune responsive behavior with real touch and keyboard testing.

**Exit gate:** Motion passes reduced-motion review and edge states do not break layout or task
completion.

### Phase 5: Portfolio presentation and release

- Update the static showcase to accurately represent the new interface without implying that hosted
  CRUD is live.
- Replace documentation screenshots and update `README.md`, `docs/USAGE.md`, and project roadmap
  references.
- Document design rationale, architecture decisions, performance results, and accessibility evidence
  concisely for reviewers.
- Run the complete Python, frontend, build, bundle, and browser test suite.

**Exit gate:** Release evidence and documentation match the shipped UI; no legacy screenshot or
description remains.

## Validation Matrix

Every primary workflow must be exercised across these dimensions:

| Dimension | Required coverage |
| --- | --- |
| Viewport | Compact phone, landscape phone, tablet/narrow desktop, wide desktop |
| Input | Keyboard only, pointer, coarse touch |
| Theme | Light, dark, system, forced colors where supported |
| Motion | Default and reduced motion |
| Locale | English and Turkish, including long labels and locale formatting |
| Zoom/text | 200% text sizing and 400% browser zoom/reflow |
| Data | Empty, typical, dense, long labels, extreme/negative/zero values |
| Network/API | Fast, slow, aborted, validation error, server error |
| Browser | Chrome 132+, Edge 132+, Safari 19+, Firefox 147+, supported mobile releases |

## Testing Requirements

- Unit-test navigation state, form behavior, validation routing, formatting, chart geometry, and
  reduced-motion/theme preferences.
- Integration-test each feature's successful, empty, loading, filtered, and failure states.
- Playwright-test all primary routes, dialogs/sheets, keyboard navigation, history navigation,
  responsive reflow, locale switching, theme switching, imports, destructive confirmation, and
  route focus management.
- Run automated accessibility scans on every primary route and top-layer workflow in both themes.
- Add visual regression coverage for a focused set of high-value states rather than snapshotting every
  component permutation.
- Manually verify VoiceOver/Safari and at least one second screen-reader/browser pairing.
- Preserve API contract, i18n fallback, request cancellation, stale-response, and mutation-locking
  coverage already present.

The repository-wide commands in `AGENTS.md` remain required. The overhaul is not complete if it
passes frontend screenshots but breaks Python, generated API types, static SPA hosting, or bundle
checks.

## Definition of Done

The overhaul is complete only when all of the following are true:

- All current browser capabilities remain available or have an explicitly approved replacement.
- The four-route information architecture and Automations sub-navigation are implemented and deep
  links work.
- The overview has a single clear financial narrative and no redundant metric grid.
- Activity, Plan, and Automations prioritize their core user jobs and expose secondary controls
  progressively.
- A coherent semantic design system covers typography, color, spacing, shape, elevation, states,
  charts, motion, and responsive behavior in light and dark themes.
- English and Turkish are complete and visually verified.
- Core workflows pass keyboard, screen-reader, touch, zoom/reflow, reduced-motion, and automated
  accessibility testing.
- Core Web Vitals and bundle budgets are met or any exception is explicitly documented with evidence.
- Legacy components, unused tokens, obsolete CSS, screenshots, and copy are removed rather than
  hidden alongside the new system.
- README, usage documentation, screenshots, showcase, and roadmap accurately describe the result.
- A reviewer can complete add, edit, filter, budget, recurring, import, export, theme, and locale
  workflows without prior instruction.
- The result feels like one intentionally designed product rather than a collection of polished
  components.

## Non-Goals

This overhaul does not authorize:

- Authentication, accounts, cloud sync, collaboration, or a hosted database.
- New financial domain capabilities merely to fill visual space.
- Rewriting the Python domain, persistence, CLI, report, or chart-generation layers.
- Replacing React/Vite or introducing a new application framework.
- A general-purpose design system intended for unrelated products.
- Large polyfills for modern platform features.
- Native mobile applications, desktop wrappers, or service workers.
- Manipulative engagement patterns, gamification, financial advice, or predictive claims.

## Explicit Product Decisions to Validate in Phase 1

The following are strong starting decisions, not excuses to skip prototype evidence:

1. User-facing destinations become Overview, Activity, Plan, and Automations.
2. Desktop navigation moves to a rail; compact navigation uses a drawer.
3. Instrument Sans Variable and IBM Plex Mono form the initial typography pairing.
4. The palette uses warm paper/ink neutrals with cobalt, jade, vermilion, and amber semantic roles.
5. Activity editing uses a contextual side sheet on wide layouts and a full-height sheet/dialog on
   compact layouts.
6. Automations uses deep-linkable Categories, Recurring, and Preferences tabs.
7. Overview prioritizes one cashflow story, one trend, one attention queue, and recent activity.
8. View Transitions are limited to navigational continuity and a few selected object relationships.

If testing invalidates one of these decisions, record the evidence and replacement in this document
or a linked architecture/design decision. Do not drift through unrecorded one-off styling choices.

## Required Artifacts

Implementation should leave behind:

- Current-state audit and workflow inventory.
- Approved low-fidelity flows and high-fidelity key-screen designs.
- Semantic token reference and component/state inventory.
- Motion and responsive behavior notes.
- Accessibility test record and known limitations.
- Before/after performance and bundle measurements.
- Updated automated tests, documentation, screenshots, and static showcase.
- Short release retrospective explaining the major tradeoffs and what the redesign demonstrates as a
  portfolio project.
