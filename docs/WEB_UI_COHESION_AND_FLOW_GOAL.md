# Web UI Cohesion and Flow Goal

## Document Status

- **Status:** Implemented and verified on July 16, 2026
- **Audit date:** July 16, 2026
- **Scope:** The complete React Web UI, its primary destinations, secondary management surfaces,
  shared shell, cross-route workflows, naming, iconography, and interaction conventions
- **Target:** Baseline 2026-capable browsers under the policy in `AGENTS.md`
- **Primary audience:** An implementation agent, contributors, reviewers, and future maintainers
- **Architecture boundary:** Frontend-first. Small API additions are allowed only when they remove
  duplicated requests or make an explicitly required cross-feature summary practical.
- **Source of truth for:** The shipped Web UI cohesion, navigation, and cross-route flow
- **Supersedes for navigation decisions:** The four-route proposal in `WEB_UI_OVERHAUL_GOAL.md`
- **Related documents:** `WEB_UI_OVERHAUL_GOAL.md`, `OVERVIEW_ANIMATION_AUDIT_GOAL.md`,
  `WEB_UI_COHESION_AND_FLOW_RELEASE.md`, `ARCHITECTURE.md`, and `PROJECT_PLAN.md`

## Agent Mission

Turn the current collection of individually designed finance pages into one coherent product.

This is not a request to make every page use the same card grid, header treatment, or interaction
model. The goal is a shared product grammar: predictable navigation, stable naming, consistent
controls, clear page purposes, deliberate transitions between tasks, and recognizable visual
relationships. Each destination should still use the composition best suited to its job.

The implementation may substantially reorganize routes, rename user-facing destinations, merge or
split feature surfaces, replace icons, change the shell, and revise page layouts. Preserve finance
domain behavior and local-first trust unless a requirement below explicitly changes the UI contract.

## Executive Decision

Use four primary destinations:

| Destination      | Canonical route | User question                                                  | Primary page action | Recommended icon                        |
| ---------------- | --------------- | -------------------------------------------------------------- | ------------------- | --------------------------------------- |
| **Overview**     | `/`             | “What is my financial position, and what needs attention now?” | Add transaction     | `House` or an equally plain home symbol |
| **Transactions** | `/transactions` | “What money moved, and how do I add, find, or correct it?”     | Add transaction     | `ReceiptText`                           |
| **Budgets**      | `/budgets`      | “How is this month tracking against my limits?”                | Set budget          | `Target`                                |
| **Accounts**     | `/accounts`     | “What do I own and owe, and are my balances current?”          | Update balances     | `WalletCards`                           |

Move lower-frequency setup and maintenance work into a secondary **Manage** area:

| Manage section | Canonical route       | Purpose                                                         | Recommended icon |
| -------------- | --------------------- | --------------------------------------------------------------- | ---------------- |
| Automations    | `/manage/automations` | Review and apply recurring transaction templates                | `Repeat2`        |
| Categories     | `/manage/categories`  | Normalize imported category aliases                             | `Tags`           |
| Data           | `/manage/data`        | Import, export, local-storage explanation, and data portability | `Database`       |
| Preferences    | `/manage/preferences` | Currency, language, theme, and future ledger-wide preferences   | `Settings2`      |

The four primary destinations belong in the persistent rail and compact bottom navigation. Manage
belongs in a visually separated utility region on wide screens and a clearly labeled “Manage”
entry from compact app chrome. It must remain easy to discover, but it must not compete with daily
finance work for one of the limited mobile navigation positions.

### Route migration

- `/` changes from the current Net worth page to the new unified Overview.
- `/cash-flow` redirects to `/` while preserving relevant `month` and `year` query parameters.
- `/net-worth` redirects to `/accounts`.
- The current root Net worth experience moves to `/accounts` and is renamed Accounts.
- `/rules` redirects to `/manage/automations`.
- Existing bookmarked query state should be translated where practical rather than discarded.
- Redirects remain covered by route tests and browser history tests.

These are real application routes and navigation links, not an ARIA tab widget. Do not assign
`role="tab"` to primary navigation. Use tabs only for peer panels within one destination when
content changes without representing a new top-level place.

## Why This Structure Is Better

### 1. It removes two competing home pages

Net worth and Cash flow both currently behave like overview destinations. One is the root route,
while the other summarizes the selected month, includes a net-worth teaser, and acts like a
dashboard. This makes “where should I start?” harder than it should be.

The new Overview owns orientation and prioritization. Accounts owns the detailed asset/liability
workspace. Monthly cash-flow analysis becomes a major Overview section rather than a competing
top-level destination.

### 2. It reserves primary navigation for frequent, durable concepts

Transactions, budgets, and accounts are core financial objects and repeated user jobs. Category
aliases, recurring templates, CSV tools, and preferences matter, but they are setup or maintenance
work. Promoting all of them equally makes the product structure reflect implementation modules
rather than user frequency and intent.

### 3. It uses explicit labels

“Activity,” “Plan,” and “Automations” sound polished but require interpretation. Desktop and compact
navigation currently compound this by changing labels to “Entries,” “Budgets,” and “Rules.”
Primary destination names must remain stable across viewport sizes:

- Overview
- Transactions
- Budgets
- Accounts

Compact layouts may visually truncate only as a last resort. They must not substitute a different
concept. If a label cannot fit, revise spacing or icon size before renaming it.

### 4. It stops the global action from changing identity by route

The current persistent create control means “add/update account” on Net worth and “add transaction”
elsewhere. A global control must not change its object without an exceptionally clear mode change.

“Add transaction” becomes the stable global command. Account, budget, and management actions live
in their page context. This improves predictability and makes keyboard shortcuts or a future command
menu safe to introduce.

### 5. It permits distinct pages without visual fragmentation

The destination archetypes are intentionally different:

- Overview is an editorial decision surface.
- Transactions is a chronological ledger.
- Budgets is a planning and exception-management board.
- Accounts is a portfolio and balance-maintenance workspace.
- Manage is a quieter configuration environment.

They should share foundations, states, control behavior, and layout rhythm without sharing one
page template.

## Current-State Findings

The current UI has many strong individual ideas, but the following issues prevent it from feeling
like one complete package:

### Navigation and naming

- Five destinations receive equal primary emphasis even though Automations is lower-frequency.
- Net worth and Cash flow both function as summary/home experiences.
- Labels change between wide and compact navigation:
  - Net worth becomes Worth.
  - Activity becomes Entries.
  - Plan becomes Budgets.
  - Automations becomes Rules.
- The route names, feature folder names, page titles, navigation labels, and historical labels do
  not consistently describe the same concept.
- Primary-route links are described in source comments as application tabs, which risks confusing
  route navigation with the ARIA tabs pattern.

### Iconography

- Several icons are generic dashboard or settings symbols rather than direct representations of the
  destination.
- The compact active icons receive route-specific fill and duplicate-path treatments. This makes the
  icon system harder to maintain and gives some destinations more visual emphasis than others.
- The current Rules/Automations icon communicates controls or settings, not recurring work.
- Icons and labels sometimes explain different concepts.

### Shell and action hierarchy

- The global create action changes meaning on the Net worth route.
- Desktop and compact shell treatments expose different visual priorities.
- Theme and language controls occupy persistent prime space even though they are utility actions.
- Page-level primary actions sometimes duplicate shell actions and sometimes introduce unrelated
  secondary actions at the same weight.

### Page composition

- Net worth, Cash flow, Transactions, Budgets, and Automations each use a different page-opening
  grammar.
- Shared `PageHeader` usage does not guarantee shared information hierarchy; some pages bypass it,
  some combine period controls into the heading, and others lead with a custom hero.
- Pages use different metaphors—editorial balance story, portfolio studio, activity feed, allocation
  board, automation hero—without enough common typography, spacing, action placement, or state
  behavior to identify them as siblings.
- Panels, bespoke cards, bordered collections, orbit graphics, charts, tables, lists, inspectors,
  and dialogs do not always share the same density or interaction states.

### Cross-feature flow

- Overview can send the user to other routes, but destination context is not always retained or
  clearly acknowledged.
- Net worth and cash flow use different time models without a shared explanation.
- Budget inspection and transaction filtering are related but feel like separate applications.
- Recurring entries create transactions, yet the completion path does not strongly connect back to
  the resulting ledger entries.
- Data import/export is scattered by object type, while local storage and portability are global
  product concepts.

### Responsive behavior

- Five bottom-navigation items leave little room for clear labels and future growth.
- A fixed bottom bar can obscure content or divide long ledger cards if spacing calculations drift.
- Route-specific page compositions adapt independently, producing different compact densities and
  action locations.
- Some desktop secondary panels become large standalone regions rather than being re-prioritized for
  compact use.

## Product Outcome

When this goal is complete, a user should be able to answer all of the following without learning
the implementation:

1. Where do I start?
2. Where do I record money movement?
3. Where do I compare spending with my intent?
4. Where do I maintain balances for assets and debts?
5. Where do I configure recurring work, categories, imports, exports, and preferences?
6. What action is most important on this page?
7. Where will a link take me, and will it preserve the context I selected?

A portfolio reviewer should perceive one authored application within the first minute, even though
each destination has a purpose-built composition.

## Experience Principles

### One product grammar, multiple page archetypes

Consistency means stable rules, not identical layouts. Reuse the same hierarchy, tokens,
interactive states, language patterns, and responsive logic. Allow the content model to determine
whether the body is a narrative, ledger, board, chart workspace, or settings list.

### Navigation reflects user intent

Primary destinations represent durable concepts and frequent jobs. Low-frequency configuration does
not receive equal prominence merely because it has a feature module.

### The route title is the destination name

The navigation label, document title, page `<h1>`, and user-facing route name should normally match.
Editorial subtitles may add personality, but must not replace orientation.

### One dominant action per context

Every route has one clear primary page action. The global Add transaction command remains stable.
Secondary actions use menus, grouped controls, or quieter button variants.

### Summary leads to action

Overview data should answer “so what?” and provide a direct path to the relevant detailed workspace.
Detailed pages should acknowledge incoming context and make the next action obvious.

### Shared time language, route-specific time controls

Cash flow and budgets use a calendar month. Transactions can use a date range or period filter.
Accounts use an as-of date and history range. These concepts must share control styling and date
formatting, but they must not be forced into one misleading global period selector.

### Progressive disclosure

Search and the most common control stay visible. Advanced filters, exports, destructive actions, and
rare settings are available near their context without occupying permanent prime space.

### Local-first trust is calm and concrete

Explain where data lives, what an import changes, what an export contains, and what deletion means.
Avoid repeated “local” badges that become visual noise.

### Accessibility is part of interaction design

Semantic structure, focus movement, keyboard use, touch targets, reduced motion, forced colors,
zoom/reflow, translated labels, and chart alternatives are required behavior.

## Information Architecture in Detail

### Primary Destination 1: Overview

#### Purpose

Overview is the only orientation page. It combines the minimum useful net-worth and monthly
cash-flow information needed to understand current financial health, then points to detailed
destinations.

#### Required questions

- What is my current net worth?
- Is it moving in a useful direction?
- What happened this month?
- Is anything over budget, stale, or missing?
- What should I review next?

#### Page anatomy

1. **Route header**
   - `<h1>Overview</h1>`
   - A short, data-aware sentence rather than a generic product summary
   - Stable global Add transaction access
   - No second dashboard title

2. **Financial position**
   - Current net worth as of a visible date
   - Assets and liabilities as supporting figures
   - Change over the selected account-history range
   - Data freshness or unresolved-account warning when applicable
   - Direct action: View accounts or Update balances

3. **This month**
   - Selected month, income, expenses, net cash flow, and savings rate as one composition
   - One primary cash-flow trend
   - Month control local to this section
   - Reports/exports in a contextual menu

4. **Attention**
   - Ranked budget pressure
   - Stale or unresolved account balances
   - Missing budget coverage when materially relevant
   - Empty state that explicitly says no action is needed

5. **Recent transactions**
   - Short chronological preview
   - Direct path to filtered Transactions

#### Distinct visual character

Overview may use more whitespace, larger narrative figures, and editorial grouping than other
routes. It must not become a dense card dashboard. Use a small number of strong sections connected
by alignment, rules, and hierarchy.

#### What moves out

- Full account list, account management, balance history editing, and account inspectors move to
  Accounts.
- Complete budget allocation and budget record management remain in Budgets.
- Full ledger filtering, imports, exports, and row actions remain in Transactions.

### Primary Destination 2: Transactions

#### Purpose

Transactions is the operational ledger. It owns transaction capture, search, review, correction,
transaction CSV workflows, and chronological understanding.

#### Required questions

- What money moved?
- Can I find a specific entry quickly?
- Can I add or correct an entry without losing context?
- What filters are active?
- What will an import or export include?

#### Page anatomy

1. **Route header**
   - `<h1>Transactions</h1>`
   - Current result count and applied date context
   - Primary action: Add transaction

2. **Search and filter bar**
   - Search remains visible
   - Date context remains visible
   - Advanced filters open in a popover on wide layouts and a sheet/dialog on compact layouts
   - Applied filters appear as removable, text-labeled tokens or a concise sentence

3. **Ledger**
   - Wide: semantic table or ledger rows with aligned numeric columns
   - Compact: chronological transaction cards/list items optimized for touch
   - Both derive from one content model and expose equivalent information/actions
   - Date grouping and ordering remain clear

4. **Data actions**
   - Transaction import and export live in a contextual Data menu
   - Export scope is explicit
   - Import remains a staged preview-confirm-result flow

#### Distinct visual character

Transactions should be the densest route. It may use stronger row rhythm, tabular figures, sticky
group labels, and compact controls. It should not inherit Overview’s large narrative spacing.

### Primary Destination 3: Budgets

#### Purpose

Budgets is a monthly planning and exception-management workspace. It prioritizes planned-versus-
actual understanding over record administration.

#### Required questions

- How much of my planned spending is used?
- Which categories need attention?
- Which spending is not covered by a budget?
- What changes if I set or edit a limit?

#### Page anatomy

1. **Route header**
   - `<h1>Budgets</h1>`
   - Visible month context
   - Primary action: Set budget

2. **Monthly plan summary**
   - Planned, spent, remaining/over, uncovered
   - Plain-language status
   - Month control local to the route

3. **Category budget workspace**
   - Priority-first default ordering
   - Search and sort are secondary controls
   - Category selection opens a consistent inspector on wide layouts and a sheet/dialog on compact
     layouts
   - Each category links to matching Transactions while preserving month/category context

4. **Record and data maintenance**
   - Raw budget records are available as a secondary disclosure or data-management view
   - Budget CSV import/export lives in a contextual Data menu or the Manage > Data surface
   - Do not give the raw record table equal visual weight to the planning workspace

#### Distinct visual character

Budgets may use proportional bars, progress, grouped statuses, and a focused inspector. It should
feel anticipatory and comparative, while Transactions feels historical.

### Primary Destination 4: Accounts

#### Purpose

Accounts is the asset, liability, balance-history, and net-worth maintenance workspace. “Accounts”
is more actionable and concrete than using “Net worth” for both a metric and a destination.

#### Required questions

- What do I own and owe?
- Which balances are current or unresolved?
- How has net worth changed?
- How do I update, add, archive, or correct an account?

#### Page anatomy

1. **Route header**
   - `<h1>Accounts</h1>`
   - Net-worth summary as supporting orientation
   - Primary action: Update balances when accounts exist; Add account for first use
   - Secondary action: Add account

2. **Portfolio summary**
   - Assets, liabilities, net worth, change, and coverage
   - As-of date and history range controls in one consistent context bar

3. **History and movement**
   - Net-worth history chart with a semantic table alternative
   - Largest or most meaningful movements
   - Clear distinction between account balance changes and transaction cash flow

4. **Account workspace**
   - Assets and liabilities grouped or clearly classified
   - Balance freshness visible
   - Update and manage actions follow one consistent pattern
   - Archived accounts are secondary and opt-in

#### Distinct visual character

Accounts may retain the richer portfolio/workbench composition, but its controls, page opening,
section headings, surfaces, dialogs, and empty states must use the shared system.

### Secondary Destination: Manage

#### Purpose

Manage contains configuration and data-maintenance work that supports the four primary
destinations. It should feel discoverable and complete, not like a dumping ground.

#### Entry and layout

- Wide shell: a separated Manage link near utilities, below primary navigation.
- Compact shell: a labeled Manage button in the app bar or utility menu.
- The Manage landing route may redirect to its last-used section or Automations.
- Wide layout may use a local vertical sub-navigation.
- Compact layout may use a select-like section switcher or horizontally scrollable links with clear
  overflow affordance.
- Use ARIA tabs only if panels are kept mounted and switched in place. Prefer normal links when each
  section has a stable URL and independent loading state.

#### Automations

- Recurring transaction templates only.
- Show active/inactive state, expected day, type, category, amount, and next relevant period.
- Applying templates requires a preview of entries to be created and duplicates to be skipped.
- Completion offers “View created transactions,” preserving the period and identifiable result
  context.

#### Categories

- Category alias normalization only.
- Explain that rules affect future imports and writes according to existing domain behavior.
- Show alias → canonical category in a compact, scannable mapping.
- Offer examples and impact descriptions without mixing in recurring templates.

#### Data

- Separate Transactions and Budgets import/export groups.
- State file format, current-filter scope, replacement/duplicate behavior, and local destination.
- Link to usage documentation where helpful.
- Explain that the SQLite ledger remains local to the machine.
- Do not add database reset or destructive bulk deletion without a separate safety goal.

#### Preferences

- Ledger currency.
- Language and color theme may remain quickly accessible in the shell, but their complete controls
  and explanations also belong here.
- Future global preferences must be added here rather than creating new primary destinations.

## Navigation and Shell Goal

### Wide layout

Use a persistent rail with three zones:

1. Brand and workspace identity
2. Four primary destinations and stable Add transaction command
3. Manage, language, theme, and local-data status

The active route uses text, icon, shape, and/or position—not color alone. Navigation labels remain
visible at normal desktop widths. A collapsed icon-only rail is optional and must not be the default
if it harms discoverability.

### Compact layout

Use a four-item bottom navigation:

- Overview
- Transactions
- Budgets
- Accounts

Keep Add transaction in the compact app bar as a clearly labeled button where space permits and an
icon button with an accessible name on narrow screens. Do not insert the action into the navigation
list or make it look like a fifth destination.

Manage, language, theme, data status, and about/help belong in a utility menu or compact secondary
surface. The menu trigger needs a visible label at intermediate widths and an accessible name at
all widths.

The bottom navigation must:

- Respect safe-area insets.
- Never cover the final content row or dialog controls.
- Keep touch targets at least 24 by 24 CSS pixels, with a product target of at least 44 by 44.
- Preserve labels at 200% text zoom.
- Avoid route-specific icon hacks.
- Use one active-state treatment for all destinations.

### Route behavior

- Use normal `<a href>` navigation semantics.
- Preserve modified clicks, open-in-new-tab behavior, deep links, refresh, and browser history.
- Update the document title to `{Destination} | Personal Finance Tracker`.
- Move programmatic focus to the route `<h1>` or main content after client-side navigation.
- Do not move focus for same-route filter/query changes unless the action opens a focused surface.
- Announce meaningful route or result changes without duplicating visible headings.
- Route transitions remain progressive, reduced-motion-aware, short, and non-blocking under
  `OVERVIEW_ANIMATION_AUDIT_GOAL.md`.

## Naming and Content Standards

### Canonical user-facing vocabulary

| Avoid as destination name | Use                       | Reason                                                             |
| ------------------------- | ------------------------- | ------------------------------------------------------------------ |
| Dashboard / Cash flow     | Overview                  | The route includes financial position, monthly flow, and attention |
| Activity / Entries        | Transactions              | Directly names the domain object and expected task                 |
| Plan                      | Budgets                   | Removes interpretation and matches the underlying records          |
| Net worth                 | Accounts                  | The route manages accounts; net worth is a metric within it        |
| Rules                     | Categories or Automations | Separates two different setup jobs                                 |
| Data options              | Import & export or Data   | Says what the controls do                                          |

Use “cash flow” as two words in user-facing English. Use one spelling consistently in code-facing
names according to the established repository convention.

### Page copy

- Start page summaries with the outcome or task, not a slogan.
- Keep eyebrow text optional. It must add information and must not be the only orientation cue.
- Avoid changing the same concept’s name between header, navigation, button, and dialog.
- Prefer verbs tied to objects: Add transaction, Set budget, Update balances, Apply recurring
  entries.
- Avoid shame-oriented or alarmist finance language.
- Translate by meaning, not by preserving English word length.

## Iconography Goal

Adopt one Lucide icon vocabulary with these rules:

- One canonical icon per destination across all viewports.
- Default to outline icons with a consistent stroke width.
- Do not create route-specific duplicate-icon overlays, selective path hiding, or custom fills to
  simulate a different icon family.
- Active navigation state is carried by the surrounding indicator and text weight; icon fill is
  optional only if every destination supports it consistently.
- Icons supplement visible text. Unfamiliar icon-only actions require tooltips for pointer users and
  accessible names for assistive technology.
- Destructive, warning, success, income, and expense states must include text or structural cues in
  addition to icons and color.
- Decorative icons use `aria-hidden="true"`.

Validate the final icon choices in both English and Turkish. If an icon needs explanation to make
the destination understandable, choose a clearer icon or label.

## Shared Page Grammar

Every primary route should follow the same high-level reading order without using the same visual
template:

1. Route identity
2. Context and primary action
3. Summary or orientation
4. Primary workspace
5. Secondary detail
6. Data/help/advanced actions

### Shared route header contract

Create or evolve a shared route-header primitive with slots for:

- Destination `<h1>`
- One-sentence purpose or current status
- Optional context control
- One primary page action
- Optional quiet secondary/menu action

The primitive defines spacing, responsive stacking, heading hierarchy, and action alignment. It
must allow Overview and Accounts to use a more editorial presentation without bypassing the
contract.

### Shared context bar

Create one visual and behavioral family for:

- Month selection
- Date range
- As-of date
- Search
- Sort
- Filter summary

These controls do not need identical fields. They share height, labels, focus treatment, popover/
sheet behavior, pending state, and responsive wrapping.

### Shared section grammar

Sections share:

- Heading and optional description placement
- Action alignment
- Consistent top spacing
- Rule/surface choices
- Loading, empty, error, and stale-state placement

Not every section should be a card. Use:

- Open editorial sections for Overview
- Rows/tables for Transactions
- Bounded comparison surfaces for Budgets
- Workbench/group surfaces for Accounts
- Quiet settings groups for Manage

### Shared inspector grammar

Budget category details, account details, transaction editing, and similar focused work should share
top-layer behavior:

- Wide: side sheet or appropriately sized dialog when preserving page context is useful
- Compact: full-height or near-full-height dialog/sheet
- Stable title and close location
- Predictable Escape and light-dismiss behavior
- Focus return to the invoking control
- Sticky actions only when content length requires them
- No nested modal flows

## Design-System Foundation

Before substantial route recomposition, consolidate a small shared foundation in
`frontend/src/shared/`.

### Tokens

Use CSS custom properties organized at a level appropriate for this project:

- Literal palette and size values
- Semantic color, typography, spacing, border, surface, and motion roles
- A small number of component tokens only where reuse proves necessary

Required token families:

- Page gutters and maximum widths
- Section rhythm
- Compact and comfortable density
- Type roles and tabular numeric treatment
- Surface, raised surface, rule, strong rule, text, muted text, action, positive, negative, warning,
  and focus colors
- Control heights and touch targets
- Radius family
- Motion durations and easing

Do not encode nontrivial visual values inline. Use logical properties where direction should adapt.

### CSS architecture

- Preserve and use the existing cascade layer order.
- Prefer low-specificity `:where()` defaults and intentional feature overrides.
- Use native CSS nesting and `@scope` only where they improve local reasoning.
- Use container queries for component adaptation when the component’s available space matters more
  than viewport width.
- Treat newly available features as progressive enhancements when core behavior would otherwise
  fail.
- Use dynamic viewport units for compact full-height surfaces.
- Do not add a CSS framework or runtime styling dependency.

### Core reusable patterns

- Route header
- Context/filter bar
- Button and icon button variants
- Menu and popover
- Dialog and side sheet
- Field, field group, error summary, and validation notice
- Segmented control only for mutually exclusive view state
- True tabs only for peer panels
- Summary metric group
- Status marker
- Empty state
- Error recovery
- Skeleton or retained-data pending state
- Ledger row and responsive data table
- Inspector
- Chart frame, tooltip, legend, and data table
- Toast/live-announcement service for brief confirmations

Do not build speculative variants. Each variant must map to a requirement in this document.

## Cross-Destination Flows

The redesign is successful only if routes work together.

### Overview → Transactions

- Recent transaction selection opens the matching transaction context.
- Category selection opens Transactions filtered to that category and month.
- “View all” preserves the Overview month.
- The destination shows a visible filter summary so the user understands why the result set changed.

### Overview → Budgets

- Attention items open the matching budget category and month.
- The category inspector is open or clearly highlighted on arrival.
- Back navigation returns to the same Overview scroll/context where practical.

### Overview → Accounts

- Net-worth summary opens Accounts with the same as-of date when relevant.
- Stale-balance attention opens the appropriate update workflow or highlights unresolved accounts.

### Budgets ↔ Transactions

- A budget category can show matching spending.
- Transactions filtered from Budgets provide a clear return path or preserve browser Back behavior.
- Editing a transaction that affects budget status refreshes or invalidates relevant presented data
  without requiring a full page reload.

### Accounts → Overview

- Updating balances returns to Accounts by default and refreshes the Overview summary on next visit.
- A success message identifies what changed without forcing an automatic route switch.

### Manage Automations → Transactions

- Recurring preview identifies the selected month.
- After applying templates, offer a direct link to created/skipped transaction results.
- Duplicate behavior remains explicit.

### Manage Categories → import flows

- Import previews identify category normalization caused by aliases.
- The user can open Categories without losing an in-progress file selection only if this can be
  implemented safely; otherwise explain that leaving will discard the preview.

## URL and State Model

User-visible context must be deep-linkable where it materially changes the screen:

- Overview month: `month`, `year`
- Overview account as-of date only when non-default: `as_of`
- Transactions: date/period, category, type, search, sort, and page where practical
- Budgets: month, year, category, sort
- Accounts: `as_of`, history `months`, archived visibility when useful
- Manage section: path segment

Rules:

- The URL is the durable state source for route and filters that a user may bookmark or share
  locally.
- Temporary form drafts, open confirmation dialogs, hover state, and transient notices do not need
  URL state.
- Back/forward restores route and filter state without duplicate requests or stale focus.
- Query parameters use canonical names and are removed when values equal defaults.
- Invalid query values degrade to safe defaults and may be normalized with `replaceState`.

## Loading, Empty, Error, and Success States

All routes use the same state philosophy:

### Initial loading

- Preserve page identity and expected structure.
- Avoid replacing the entire application with unrelated centered text after settings load.
- Use a restrained skeleton or static placeholder only when it reduces uncertainty.

### Retained-data refresh

- Keep the last successful data visible.
- Mark the relevant section busy and provide immediate visual feedback.
- Prevent stale responses from replacing newer context.
- Do not announce noisy “loading” messages for every small refresh.

### Empty states

Differentiate:

- No data exists yet.
- No data exists for this period.
- Filters match nothing.
- Data is unresolved or stale.
- Nothing needs attention.

Each state provides the next useful action, not a generic illustration.

### Errors

- Place recoverable errors near the affected region.
- Preserve unaffected content.
- Provide Retry when it can work.
- Form and import errors remain in context and receive appropriate focus/announcement.
- Do not rely on transient toasts for failures that require action.

### Success

- Use brief notices for completed saves/deletes/imports.
- State the object and result.
- Offer a relevant next step when a bulk action creates another set of records.

## Accessibility Requirements

### Structure

- Use `<header>`, `<nav>`, `<main>`, `<aside>`, and `<footer>` only where their landmark meaning is
  useful.
- Keep one route `<h1>` and sequential headings.
- Keep the skip link and focusable main target.
- Use lists for repeated navigation and list content.
- Use semantic tables with captions and scoped headers for tabular data.

### Navigation semantics

- Primary and secondary destinations are links.
- `aria-current="page"` identifies the current destination.
- Do not use ARIA tabs for route navigation.
- If internal tabs are used, implement the complete tabs keyboard pattern and persistent selected
  state.

### Focus and keyboard

- Provide visible `:focus-visible` outlines with sufficient contrast.
- Never use positive `tabindex`.
- Route changes move focus once, predictably.
- Dialogs use native `<dialog>` where it fits and restore focus.
- Menus, popovers, sheets, chart points, and inspectors remain operable with keyboard alone.
- Row actions are discoverable without requiring hover.

### Forms

- Use visible labels and explicit `for`/`id` association.
- Use `<fieldset>` and `<legend>` for grouped choices.
- Use native controls before custom widgets.
- Do not use placeholders as labels.
- Connect hints and errors with `aria-describedby`.
- Validate after interaction and on submit rather than marking untouched required fields invalid.
- Dynamic errors are announced without excessive live-region noise.

### Charts

- Every chart has a clear title and textual summary.
- Interactive chart marks support keyboard focus where inspection is useful.
- A semantic data table alternative is available.
- Color is not the only series or status differentiator.

### Visual access

- Meet WCAG AA text and non-text contrast.
- Support 200% text zoom without clipped labels or lost controls.
- Support forced colors without losing selection, borders, focus, or status.
- Support light and dark themes as designed themes, not mechanical inversion.
- Use relative font sizes and unitless line heights.
- Keep body copy to a readable measure.

### Motion

- Honor `prefers-reduced-motion`.
- Reduced motion removes travel, rolling, scaling, and nonessential continuous effects.
- Do not globally force tiny animation durations.
- Motion never delays state changes, focus, navigation, or downloads.

## Responsive and Input Requirements

Design and verify at minimum:

- 320 CSS pixels wide
- 390 by 844 compact viewport
- 768 CSS pixels wide
- 1024 CSS pixels wide
- 1440 CSS pixels wide
- 200% browser text zoom
- Coarse pointer/touch
- Fine pointer
- Keyboard-only operation

Required behavior:

- Components respond to their container where practical.
- Wide tables become purpose-designed lists/cards on compact screens rather than horizontally
  compressed tables when the data model permits.
- Horizontal scrolling is acceptable for genuinely tabular comparisons, with visible scroll
  affordance.
- Sticky shell elements do not obscure headings, focused controls, last rows, or dialog actions.
- Touch targets grow for coarse pointers.
- Compact layouts prioritize actions and reading order instead of merely stacking desktop columns.

## Performance and Modern Web Standards

- Preserve route-level lazy loading.
- Avoid a global server-state dependency.
- Avoid virtualization unless measured data volume and interaction latency justify it.
- Measure before adding `content-visibility`; when used, pair it with a realistic intrinsic size to
  avoid layout shift.
- Keep interactions responsive and protect INP by isolating large self-contained regions where
  useful.
- Animate opacity and transforms before layout properties.
- Avoid `transition: all`.
- Use native popover, dialog, View Transitions, container queries, `:has()`, `@starting-style`, and
  discrete transitions where they provide a clear benefit and degrade safely.
- Do not add large polyfills for optional presentation behavior.
- Maintain or tighten current CSS and bundle budgets. Do not raise them merely to accommodate the
  redesign.

## Implementation Architecture

Preserve the frontend dependency direction:

```text
app/ -> features/ -> api/
  \       \------> shared/
   \-------------> shared/
```

### App composition

`frontend/src/app/` owns:

- Canonical route definitions and redirects
- Primary/secondary navigation metadata
- Shell composition
- Route focus and document titles
- Cross-feature navigation intents
- Global Add transaction command

Do not let feature modules import each other.

### Feature ownership

Recommended feature boundaries after migration:

- `features/overview/`
- `features/transactions/`
- `features/budgets/`
- `features/accounts/`
- `features/manage/automations/`
- `features/manage/categories/`
- `features/manage/data/`
- `features/manage/preferences/`

The existing dashboard and net-worth implementation may be migrated incrementally. Do not perform a
mechanical folder rename before the destination boundaries and shared data needs are clear.

### Shared ownership

`frontend/src/shared/` owns:

- Visual primitives and shared behavior
- Formatting and i18n
- Charts
- Route-independent hooks
- Theme
- Motion coordination
- Layered CSS and design tokens

Do not move route-specific editorial compositions into shared merely because they look polished.

### API considerations

Prefer composing existing endpoints during the first Overview implementation. Add or revise an
Overview endpoint only if measurement shows avoidable request waterfalls, duplicated calculations,
or inconsistent snapshot timing.

Any API change must:

- Use services rather than domain logic in the router.
- Preserve Decimal and date contracts.
- Regenerate `frontend/src/generated/api.ts`.
- Add focused API and frontend tests.

## Delivery Phases

### Phase 0 — Baseline and inventory

- Capture current wide and compact screenshots for all five current routes.
- Record navigation labels, route/query behavior, focus behavior, page actions, loading states, and
  cross-route links.
- Run current unit, E2E, accessibility, bundle, and build checks.
- Identify unrelated worktree changes and keep them out of this effort.

### Phase 1 — Information architecture and route contracts

- Add canonical destination metadata.
- Implement redirects and query translation.
- Change user-facing names and document titles.
- Replace the five-item compact navigation with four primary destinations.
- Add Manage entry and section routes.
- Make Add transaction globally stable.
- Add route/deep-link/browser-history tests before page redesign.

### Phase 2 — Shared product grammar

- Consolidate destination icons.
- Establish tokens and shared route header/context bar.
- Align buttons, menus, dialogs, fields, notices, empty states, and inspectors.
- Remove route-specific duplicates only after equivalent shared behavior is proven.
- Verify forced colors, reduced motion, keyboard use, and Turkish text expansion.

### Phase 3 — Overview composition

- Build unified Overview from cash-flow, net-worth summary, attention, and recent transactions.
- Keep full account management out of Overview.
- Preserve month and as-of semantics explicitly.
- Add cross-route links with retained context.
- Redirect `/cash-flow` and move root Net worth to Accounts.

### Phase 4 — Detailed destination alignment

- Reframe Net worth as Accounts.
- Align Transactions with the shared header, context bar, ledger, and data menu.
- Align Budgets with the shared header, context bar, inspector, and data actions.
- Preserve each destination’s distinct archetype.

### Phase 5 — Manage decomposition

- Split the mixed Rules page into Automations and Categories.
- Move currency and global preferences to Preferences.
- Consolidate import/export and local-data explanations in Data without removing contextual entry
  points from Transactions and Budgets.
- Add post-automation links to resulting Transactions.

### Phase 6 — Responsive, motion, and accessibility completion

- Verify the four-item compact navigation and utility access.
- Complete wide/compact inspector behavior.
- Apply route and state motion consistently.
- Test reduced motion, forced colors, keyboard, screen-reader landmarks, zoom/reflow, and touch.
- Run automated accessibility scans on every canonical route and Manage section.

### Phase 7 — Cleanup and documentation

- Remove obsolete route names, translations, icons, styles, tests, and redirects that are not part
  of the compatibility plan.
- Update screenshots and portfolio showcase.
- Update `README.md`, `docs/USAGE.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_PLAN.md`, and
  `ROADMAP.md` as applicable.
- Review bundle output and remove unused route CSS.

## Acceptance Criteria

### Information architecture

- Exactly four destinations appear in primary navigation at every viewport.
- Overview, Transactions, Budgets, and Accounts use the same labels in navigation, page titles, and
  document titles.
- Manage is reachable within one clear action from every primary route.
- `/cash-flow`, `/net-worth`, and `/rules` resolve to documented canonical destinations.
- The new Overview is the only top-level summary/orientation route.

### Purpose clarity

- A first-time user can identify where to add a transaction, set a budget, update an account
  balance, and configure recurring entries from labels alone.
- Every primary route has one documented user question and one dominant page action.
- No persistent global action changes object or meaning based on the active route.

### Visual cohesion

- All primary routes use the shared route-header, action, focus, state, and spacing rules.
- Navigation icons use one family and one active-state treatment.
- Shared controls have equivalent dimensions and states across routes.
- No requirement forces all pages into the same card, grid, or hero layout.
- Overview, Transactions, Budgets, Accounts, and Manage remain visually distinguishable by content
  structure rather than unrelated styling systems.

### Cross-route flow

- Overview links preserve period/category/as-of context where specified.
- Budget-to-transaction and automation-to-transaction flows show visible incoming context.
- Browser Back returns to the prior route and filter state.
- No cross-feature implementation import violates architecture boundaries.

### Accessibility

- All canonical routes pass the project’s automated accessibility checks with no serious or critical
  violations.
- Primary navigation is exposed as navigation links, not tabs.
- Keyboard-only users can reach and operate every core workflow.
- Route focus, dialog focus, and focus return are verified.
- Charts include data tables.
- The UI remains usable at 200% text zoom and in forced colors.
- Reduced-motion behavior is explicitly tested.

### Responsive behavior

- Four bottom-navigation labels remain readable at 320 CSS pixels.
- Bottom navigation does not cover the final interactive content.
- No core workflow requires horizontal page scrolling at compact widths.
- Tables or wide comparisons that scroll horizontally expose a clear affordance.
- Touch actions are not hover-dependent.

### Performance and maintainability

- Route lazy loading remains intact.
- Applicable bundle checks pass without increasing thresholds by default.
- No new production UI framework, animation library, or server-state library is added.
- Generated API types remain current.
- Obsolete route CSS and translations are removed after migration.

### Localization

- English and Turkish use the same destination concepts.
- Compact navigation does not use separate short names with different meanings.
- Turkish labels, headings, dialogs, and filter summaries reflow without clipping.

## Verification Plan

Run focused tests while implementing, then all applicable repository checks:

```bash
.venv/bin/python -m pytest
.venv/bin/python -m ruff check .
.venv/bin/python -m mypy
npm test
npm run lint
npm run format:check
npm run generate:api
git diff --exit-code -- frontend/src/generated/api.ts
npm run build
npm run check:bundle
npm run test:e2e
npm run test:e2e:fullstack
```

Add focused coverage for:

- Canonical routes and compatibility redirects
- Navigation labels, icons, and active state
- Stable global Add transaction behavior
- Manage discovery and deep links
- Route focus and document titles
- Query-state restoration with Back/Forward
- Overview-to-detail context handoff
- Budget-to-transaction context handoff
- Automation apply-to-transaction handoff
- Wide and compact navigation
- 320-pixel layout and 200% zoom
- Keyboard navigation and dialogs
- Reduced motion and forced colors
- English and Turkish navigation/content expansion
- Automated accessibility scans for all canonical routes

## Non-Goals

- Adding authentication, cloud sync, remote accounts, telemetry, or multi-user behavior
- Replacing SQLite or changing the local-first trust model
- Making every route share one page template
- Introducing a large component framework
- Introducing a global server-state library
- Building speculative financial advice, forecasting, investment tracking, or bank connectivity
- Hiding existing domain capability merely to make the UI look simpler
- Renaming backend domain models solely to match user-facing copy
- Using ARIA tabs as a visual styling shortcut
- Adding animation for its own sake

## Risks and Mitigations

### Risk: Overview becomes too dense

**Mitigation:** Limit it to orientation, attention, and links. Keep full management workflows in
their detailed destinations. A datum should appear on Overview only if it changes what the user
does next.

### Risk: Manage becomes a miscellaneous drawer

**Mitigation:** Keep four explicit sections with narrow purposes. Require a documented home for each
new global setting or data workflow.

### Risk: Existing bookmarks break

**Mitigation:** Preserve compatibility redirects and translate known query parameters. Test direct
loads and browser history.

### Risk: Shared components flatten page identity

**Mitigation:** Share behavior and hierarchy, not whole compositions. Keep route-specific editorial
layout in feature modules.

### Risk: A broad redesign creates a long-lived mixed state

**Mitigation:** Deliver in route-safe phases. Establish canonical navigation and shared foundations
first, then migrate one complete destination at a time. Do not leave duplicate primary destinations
visible during the transition.

### Risk: Overview requires too many requests

**Mitigation:** Compose current resources first, measure request and render behavior, then add a
small service-backed endpoint only if needed.

### Risk: Mobile utilities become hard to find

**Mitigation:** Use a visible Manage entry with a text label in compact chrome or a clearly labeled
utility menu. Do not hide it behind an unexplained icon.

## Completion Definition

This goal is complete when:

1. The four-destination information architecture is fully implemented.
2. Overview replaces the competing root Net worth and Cash flow summary routes.
3. Net worth management is clearly housed under Accounts.
4. Rules is decomposed into purposeful Manage sections.
5. Naming and iconography are consistent across viewport sizes and locales.
6. Global and page-specific actions are predictable.
7. Cross-route workflows preserve and explain context.
8. Shared visual and interaction foundations are used across every destination.
9. Each destination retains a composition suited to its purpose.
10. Accessibility, responsive, localization, performance, unit, integration, and E2E checks pass.
11. Generated artifacts and documentation are current.
12. The final diff contains no unrelated user work.
